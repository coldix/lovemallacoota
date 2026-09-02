/*
# Project:     lovemallacoota.au
# File Name:   tools/fetch-calendar.mjs
# Description: Fetch events from Google Calendar iCal feed, expanding recurrences to update data/weekly/<week>.json.
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const CALENDAR_ICS_URL = "https://calendar.google.com/calendar/ical/crdixon%40gmail.com/public/basic.ics";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseIcsDate(val) {
  if (!val) return null;
  const clean = val.replace(/.*:/, "").trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/.exec(clean);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const hour = m[4] ? parseInt(m[4], 10) : 0;
  const min = m[5] ? parseInt(m[5], 10) : 0;
  const sec = m[6] ? parseInt(m[6], 10) : 0;

  if (val.includes("Z")) {
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }
  return new Date(year, month, day, hour, min, sec);
}

function formatEventTime(val) {
  if (!val || !val.includes("T")) return "";
  const d = parseIcsDate(val);
  if (!d) return "";
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? `0${minutes}` : minutes;
  return minutes === 0 ? `${hours}:00 ${ampm}` : `${hours}:${minStr} ${ampm}`;
}

function formatEventDate(d) {
  const dayName = DAY_NAMES[d.getDay()];
  const dayNum = d.getDate();
  const monthName = MONTH_NAMES[d.getMonth()];
  return `${dayName} ${dayNum} ${monthName}`;
}

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\n/g, " ")
    .replace(/\\/g, "")
    .trim();
}

export async function fetchCalendarEvents(startDateStr, endDateStr) {
  const response = await fetch(CALENDAR_ICS_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching iCal feed`);
  }
  const ics = await response.text();

  const rawEvents = ics.split("BEGIN:VEVENT");
  const parsed = [];

  const startBound = new Date(startDateStr);
  const endBound = new Date(endDateStr);

  for (let i = 1; i < rawEvents.length; i++) {
    const block = rawEvents[i].split("END:VEVENT")[0];
    const summaryMatch = /SUMMARY:(.*)/.exec(block);
    const dtstartMatch = /DTSTART[^:\n]*:(.*)/.exec(block);
    const locationMatch = /LOCATION:(.*)/.exec(block);
    const rruleMatch = /RRULE:(.*)/.exec(block);

    if (!summaryMatch || !dtstartMatch) continue;

    const title = cleanText(summaryMatch[1]);
    const dtstartRaw = dtstartMatch[1].trim();
    const eventDate = parseIcsDate(dtstartRaw);

    if (!eventDate) continue;

    const titleLower = title.toLowerCase();
    if (
      titleLower.includes("flight:") ||
      titleLower.includes("hotel:") ||
      titleLower.includes("alarm") ||
      titleLower.includes("birthday") ||
      titleLower.includes("doctor") ||
      titleLower.includes("car rental:") ||
      titleLower.includes("dixon family") ||
      titleLower.includes("family chat")
    ) {
      continue;
    }

    const location = locationMatch ? cleanText(locationMatch[1]).split(",")[0] : "";
    const timeStr = formatEventTime(dtstartRaw);

    // Check single occurrence
    if (eventDate >= startBound && eventDate <= endBound) {
      parsed.push({
        date: formatEventDate(eventDate),
        time: timeStr,
        title,
        location,
        timestamp: eventDate.getTime(),
      });
    } else if (rruleMatch) {
      // Basic expansion for weekly recurring events in the target week
      const rrule = rruleMatch[1];
      if (rrule.includes("FREQ=WEEKLY")) {
        const byDayMatch = /BYDAY=([A-Z,]+)/.exec(rrule);
        const days = byDayMatch ? byDayMatch[1].split(",") : [DAY_NAMES[eventDate.getDay()].slice(0, 2).toUpperCase()];

        for (let d = new Date(startBound); d <= endBound; d.setDate(d.getDate() + 1)) {
          const dayCode = DAY_NAMES[d.getDay()].slice(0, 2).toUpperCase();
          if (days.includes(dayCode) && d >= eventDate) {
            const targetDate = new Date(d);
            targetDate.setHours(eventDate.getHours(), eventDate.getMinutes(), eventDate.getSeconds());

            parsed.push({
              date: formatEventDate(targetDate),
              time: timeStr,
              title,
              location,
              timestamp: targetDate.getTime(),
            });
          }
        }
      }
    }
  }

  // Deduplicate by title & date
  const uniqueMap = new Map();
  for (const item of parsed) {
    const key = `${item.date}-${item.title}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  const result = Array.from(uniqueMap.values());
  result.sort((a, b) => a.timestamp - b.timestamp);

  return result.map(({ timestamp, ...rest }) => rest);
}

// Run as CLI if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const week = process.argv[2] || "2026-w36";
  const start = process.argv[3] || "2026-08-31T00:00:00";
  const end = process.argv[4] || "2026-09-06T23:59:59";

  console.log(`Fetching & expanding Google Calendar events for week ${week} (${start} to ${end})...`);
  fetchCalendarEvents(start, end)
    .then((events) => {
      console.log(`Found ${events.length} events:`);
      console.log(JSON.stringify(events, null, 2));

      const weeklyFile = path.join(rootDir, "data", "weekly", `${week}.json`);
      if (fs.existsSync(weeklyFile)) {
        const data = JSON.parse(fs.readFileSync(weeklyFile, "utf8"));
        data.events = events;
        fs.writeFileSync(weeklyFile, JSON.stringify(data, null, 2), "utf8");
        console.log(`Updated ${weeklyFile}`);
      }
    })
    .catch((err) => {
      console.error("Failed to fetch calendar:", err);
      process.exit(1);
    });
}
