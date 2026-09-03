#!/usr/bin/env python3
"""Build data/bus-timetable.json from the PTV open GTFS feed.

Real departure times, from the official source, rather than a link telling
people to go and look. Mallacoota's stops are named by landmark in the feed —
"Bendigo Bank/Maurice Ave", not "Mallacoota" — which is why searching for the
town name finds nothing.

The feed is about 290MB, so it is not committed and not fetched in CI. Download
it, run this, commit the result:

  curl -o /tmp/ptv-gtfs.zip https://data.ptv.vic.gov.au/downloads/gtfs.zip
  python3 tools/refresh-transport.py /tmp/ptv-gtfs.zip

Licensed CC BY 4.0 by the Department of Transport and Planning, Victoria.
"""

from __future__ import annotations

import collections
import csv
import datetime
import io
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "bus-timetable.json"

# Regional coach feed inside the bundle.
MODE = "5"
# Stops that are in or immediately around Mallacoota, as the feed names them.
LOCAL_STOPS = {"Bendigo Bank/Maurice Ave", "Township/Gipsy Point Rd", "Genoa Hotel/Alexanders Rd"}
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def rows(zf: zipfile.ZipFile, name: str) -> list[dict]:
    return list(csv.DictReader(zf.read(name).decode("utf-8-sig").splitlines()))


def describe_days(service: dict) -> str:
    days = [SHORT[i] for i, day in enumerate(DAYS) if service[day] == "1"]
    if not days:
        return ""
    if days == SHORT:
        return "Daily"
    if days == SHORT[:5]:
        return "Weekdays"
    return ", ".join(days)


def main(archive: str) -> None:
    outer = zipfile.ZipFile(archive)
    feed = zipfile.ZipFile(io.BytesIO(outer.read(f"{MODE}/google_transit.zip")))

    stops = {r["stop_id"]: r["stop_name"].strip() for r in rows(feed, "stops.txt")}
    wanted = {sid for sid, name in stops.items() if name in LOCAL_STOPS}
    trips = {t["trip_id"]: t for t in rows(feed, "trips.txt")}
    calendar = {c["service_id"]: c for c in rows(feed, "calendar.txt")}

    by_trip: dict[str, list[dict]] = collections.defaultdict(list)
    for stop_time in rows(feed, "stop_times.txt"):
        by_trip[stop_time["trip_id"]].append(stop_time)

    today = datetime.date.today().strftime("%Y%m%d")
    services: dict[tuple, set] = collections.defaultdict(set)
    validity = set()

    for trip_id, stop_times in by_trip.items():
        calls = [s for s in stop_times if s["stop_id"] in wanted]
        if not calls:
            continue
        trip = trips.get(trip_id)
        service = calendar.get(trip["service_id"]) if trip else None
        if not service or service["end_date"] < today:
            continue
        when = describe_days(service)
        if not when:
            continue
        validity.add((service["start_date"], service["end_date"]))

        ordered = sorted(stop_times, key=lambda s: int(s["stop_sequence"]))
        for call in calls:
            position = ordered.index(call)
            # Where this trip goes after calling here. A call at the last stop
            # is an arrival, not a departure anyone can take.
            if position == len(ordered) - 1:
                continue
            final = stops[ordered[-1]["stop_id"]]
            services[(stops[call["stop_id"]], final, when)].add(call["departure_time"][:5])

    # Several service ids cover overlapping day patterns with identical times.
    # Merge them, so a reader sees one line per journey rather than four.
    merged: dict[tuple, set] = collections.defaultdict(set)
    for (origin, destination, when), departures in services.items():
        merged[(origin, destination, tuple(sorted(departures)))].update(
            SHORT if when == "Daily" else (SHORT[:5] if when == "Weekdays" else [d.strip() for d in when.split(",")])
        )

    entries = []
    for (origin, destination, departures), days in sorted(merged.items()):
        ordered_days = [d for d in SHORT if d in days]
        entries.append(
            {
                "from": origin,
                "to": destination,
                "days": "Daily" if len(ordered_days) == 7 else ", ".join(ordered_days),
                "departures": list(departures),
            }
        )

    starts = sorted(v[0] for v in validity)
    ends = sorted(v[1] for v in validity)
    payload = {
        "source": "Public Transport Victoria GTFS",
        "sourceUrl": "https://data.vic.gov.au/data/dataset/ptv-timetable-and-geographic-information-gtfs",
        "licence": "CC BY 4.0, Department of Transport and Planning",
        "route": "V/Line coach, Batemans Bay – Melbourne via Bairnsdale, and the Genoa connection",
        # Neither fact is in the feed, and both are what a person actually
        # needs before they walk to the stop, so they are carried here rather
        # than being wiped by the next refresh.
        "tickets": {
            "where": "Bribes Gift Shop and Fresh Flowers",
            "street": "Maurice Avenue, Mallacoota",
            "listing": "/listing/bribes-gift-shop-and-fresh-flowers.html",
        },
        "advice": (
            "A coach passes Genoa every day, in both directions. The time is "
            "different on different days, so check the day you are travelling."
        ),
        "validFrom": f"{starts[0][:4]}-{starts[0][4:6]}-{starts[0][6:]}",
        "validTo": f"{ends[-1][:4]}-{ends[-1][4:6]}-{ends[-1][6:]}",
        "refreshedAt": datetime.date.today().isoformat(),
        "services": entries,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"{len(entries)} services written to {OUT.relative_to(ROOT)}")
    print(f"valid {payload['validFrom']} to {payload['validTo']}")
    for entry in entries:
        print(f"  {entry['from']:34} → {entry['to']:26} {entry['days']:14} {', '.join(entry['departures'])}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python3 tools/refresh-transport.py <ptv-gtfs.zip>")
    main(sys.argv[1])
