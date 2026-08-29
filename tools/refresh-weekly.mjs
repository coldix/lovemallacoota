/*
# Project:     lovemallacoota.au
# File Name:   refresh-weekly.mjs
# Description: Builds the automatic parts of a weekly edition — forecast, the
#              week's events, a trail from TrailBound and a business from the
#              directory — into data/weekly/<week>.json. Run on a schedule and
#              committed, so the build itself never depends on the network and
#              a past edition keeps the forecast it was published with.
#
# Usage:
#   node tools/refresh-weekly.mjs            # current week, writes the file
#   node tools/refresh-weekly.mjs --week=2026-w35
#   node tools/refresh-weekly.mjs --dry-run
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { moonWeek } from "../src/lib/moon.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const weeklyDir = path.join(rootDir, "data", "weekly");

const MALLACOOTA = { latitude: -37.5577, longitude: 149.754 };

/**
 * Straight-line kilometres standing in for a two-hour drive. The roads here run
 * out to the highway at Genoa and back in again, so road distance is roughly
 * 1.5× the direct line: 70 km direct is about two hours. Cape Conran (93 km
 * direct, and closer to two and a half hours by road) falls outside on purpose.
 */
const TRAIL_RADIUS_KM = 70;

/** Rotation anchor. Week n of the rotation is n weeks after this Monday. */
const ROTATION_EPOCH = "2026-08-24";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const weekArg = [...args].find((arg) => arg.startsWith("--week="))?.slice("--week=".length);

function isoWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-w${String(week).padStart(2, "0")}`;
}

function mondayOf(week) {
  const [year, rest] = week.split("-w");
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const monday = new Date(firstMonday);
  monday.setUTCDate(firstMonday.getUTCDate() + (Number(rest) - 1) * 7);
  return monday;
}

/** Which turn of the rotation this week is. */
function rotationIndex(week) {
  const weeks = Math.round(
    (mondayOf(week) - new Date(`${ROTATION_EPOCH}T00:00:00Z`)) / (7 * 86400000)
  );
  return weeks;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.latitude);
  const dLon = toRad(b.lng - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function readJson(relativePath, fallback) {
  const file = path.join(rootDir, relativePath);
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8"));
}

async function fetchForecast(week) {
  const monday = mondayOf(week);
  const start = monday.toISOString().slice(0, 10);
  const end = new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${MALLACOOTA.latitude}` +
    `&longitude=${MALLACOOTA.longitude}` +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum" +
    `&timezone=Australia%2FMelbourne&start_date=${start}&end_date=${end}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const payload = await response.json();
  const daily = payload.daily;
  if (!daily?.time?.length) throw new Error("Open-Meteo returned no daily data");

  return {
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    licence: "CC BY 4.0",
    fetchedAt: new Date().toISOString(),
    days: daily.time.map((date, index) => ({
      date,
      code: daily.weather_code[index],
      summary: WEATHER_CODES[daily.weather_code[index]] || "Unsettled",
      maxC: daily.temperature_2m_max[index],
      minC: daily.temperature_2m_min[index],
      rainMm: daily.precipitation_sum[index],
    })),
  };
}

/**
 * Tide predictions for the inlet entrance. There is no free authoritative
 * Australian source we may republish, so this runs only when a WorldTides key
 * is configured; without one the edition keeps linking to the Bureau rather
 * than printing numbers nobody checked.
 */
async function fetchTides(week) {
  const key = process.env.WORLDTIDES_API_KEY;
  if (!key) return null;

  const monday = mondayOf(week);
  const start = monday.toISOString().slice(0, 10);
  const url =
    "https://www.worldtides.info/api/v3?extremes" +
    `&lat=${MALLACOOTA.latitude}&lon=${MALLACOOTA.longitude}` +
    `&start=${start}&days=7&datum=LAT&key=${key}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`WorldTides returned ${response.status}`);
  const payload = await response.json();
  if (!payload.extremes?.length) throw new Error("WorldTides returned no extremes");

  return {
    source: "WorldTides",
    sourceUrl: "https://www.worldtides.info/",
    station: payload.station || "nearest station to the inlet entrance",
    datum: payload.responseDatum || "LAT",
    fetchedAt: new Date().toISOString(),
    extremes: payload.extremes.map((extreme) => ({
      time: extreme.date,
      type: extreme.type,
      heightM: Math.round(extreme.height * 100) / 100,
    })),
  };
}

/** WMO weather codes, in the words a forecast would use. */
const WEATHER_CODES = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Freezing fog", 51: "Light drizzle", 53: "Drizzle",
  55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain",
  67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Heavy showers",
  85: "Snow showers", 86: "Snow showers", 95: "Thunderstorms",
  96: "Thunderstorms with hail", 99: "Thunderstorms with hail",
};

function pickTrail(week) {
  const trails = readJson("data/trails-nearby.json", []);
  if (!trails.length) return null;
  const trail = trails[rotationIndex(week) % trails.length];
  return {
    ...trail,
    rotation: { position: (rotationIndex(week) % trails.length) + 1, of: trails.length },
  };
}

function pickBusiness(week) {
  const files = ["listings_food.json", "listings_accom.json", "listings_do.json"];
  const businesses = files
    .flatMap((file) => readJson(`data/${file}`, []))
    .filter(Boolean)
    .sort((a, b) => (a.slug || "").localeCompare(b.slug || ""));
  if (!businesses.length) return null;

  const business = businesses[rotationIndex(week) % businesses.length];
  const link =
    business.links?.find((entry) => (entry.text || "").toLowerCase() === "website") ||
    business.links?.[0] ||
    business.social_links?.[0];

  return {
    slug: business.slug,
    name: business.business_name,
    description: business.description_short || business.description_long || "",
    category: business.category_primary || null,
    locality: business.address?.locality || null,
    url: link?.url || null,
    rotation: { position: (rotationIndex(week) % businesses.length) + 1, of: businesses.length },
  };
}

function pickEvents(week) {
  const monday = mondayOf(week);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const start = monday.toISOString().slice(0, 10);
  const end = sunday.toISOString().slice(0, 10);
  return readJson("data/events.json", [])
    .filter((event) => event.date >= start && event.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
}

const week = weekArg || isoWeek(new Date());

const previous = existsSync(path.join(weeklyDir, `${week}.json`))
  ? JSON.parse(readFileSync(path.join(weeklyDir, `${week}.json`), "utf8"))
  : null;

let weather = null;
try {
  weather = await fetchForecast(week);
} catch (error) {
  // A forecast is never invented. But a transient outage must not delete the
  // one we already have: yesterday's forecast, clearly dated, beats no forecast
  // at all, and beats a section that silently vanishes from the edition.
  console.warn(`forecast unavailable: ${error.message}`);
  if (previous?.weather) {
    weather = previous.weather;
    console.warn(`keeping the forecast fetched at ${previous.weather.fetchedAt}`);
  }
}

let tides = null;
try {
  tides = await fetchTides(week);
} catch (error) {
  console.warn(`tides unavailable: ${error.message}`);
  if (previous?.tides) tides = previous.tides;
}

const payload = {
  week,
  generatedAt: new Date().toISOString(),
  weather,
  tides,
  // Computed, not fetched: the moon is arithmetic, and the tides follow it.
  moon: moonWeek(mondayOf(week).toISOString().slice(0, 10)),
  events: pickEvents(week),
  trail: pickTrail(week),
  business: pickBusiness(week),
};

console.log(`week ${week} (rotation ${rotationIndex(week)})`);
console.log(`  forecast: ${weather ? `${weather.days.length} days` : "unavailable"}`);
console.log(`  tides:    ${tides ? `${tides.extremes.length} highs and lows` : "no key configured — linking to the Bureau"}`);
console.log(`  moon:     ${payload.moon[0].name} → ${payload.moon.at(-1).name}`);
console.log(`  events:   ${payload.events.length}`);
console.log(`  trail:    ${payload.trail ? payload.trail.name : "none"}`);
console.log(`  business: ${payload.business ? payload.business.name : "none"}`);

if (dryRun) {
  console.log("\n(dry run — nothing written)");
} else {
  mkdirSync(weeklyDir, { recursive: true });
  const file = path.join(weeklyDir, `${week}.json`);
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`\nwrote ${path.relative(rootDir, file)}`);
}

export { TRAIL_RADIUS_KM, haversineKm, isoWeek, mondayOf, rotationIndex };
