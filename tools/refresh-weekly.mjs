/*
# Project:     lovemallacoota.au
# File Name:   refresh-weekly.mjs
# Description: Builds the automatic parts of a weekly edition — forecast, the
#              week's events, a trail from TrailBound and a business from the
#              directory — into data/weekly/<week>.json. Also writes
#              data/weekly/coming.json, the next seven days from today, which
#              What's On shows. Run on a schedule and committed, so the build
#              itself never depends on the network and a past edition keeps the
#              forecast it was published with.
#
# Usage:
#   node tools/refresh-weekly.mjs            # current week + coming seven days
#   node tools/refresh-weekly.mjs --week=2026-w35
#   node tools/refresh-weekly.mjs --dry-run
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { moonWeek } from "../src/lib/moon.mjs";
import { currentEdition, isMonthly, plainEdition } from "../src/lib/editions.mjs";
import { entityBySlug, listingPhoto } from "../src/lib/directory.mjs";
import { fetchCalendarEvents } from "./fetch-calendar.mjs";
import { isoWeekOf, melbourneToday } from "./roll-edition.mjs";
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

/** Calendar-date arithmetic on an ISO day, no clock and no DST. */
export function addIsoDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Today through today+6 in Melbourne — the window the calendar page shows. */
export function comingRange(today = melbourneToday()) {
  return { start: today, end: addIsoDays(today, 6) };
}

/** Monday to Sunday of an edition week. The edition always covers that week. */
function editionRange(week) {
  const monday = mondayOf(week);
  return {
    start: monday.toISOString().slice(0, 10),
    end: new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10),
  };
}

async function fetchForecast({ start, end }) {
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
 * Sea level through the week, from Open-Meteo's marine model. This is free,
 * openly licensed and needs no key — which is why the edition can carry a tide
 * curve at all.
 *
 * What it is not: a navigational tide table. The heights are modelled against
 * mean sea level rather than chart datum, at a model cell offshore rather than
 * at the inlet entrance, so the shape of the week is right and the absolute
 * numbers are indicative. The edition says so, and still links to the official
 * predictions.
 */
async function fetchTides({ start, end }) {
  const url =
    "https://marine-api.open-meteo.com/v1/marine?" +
    `latitude=${MALLACOOTA.latitude}&longitude=${MALLACOOTA.longitude}` +
    "&hourly=sea_level_height_msl&timezone=Australia%2FMelbourne" +
    `&start_date=${start}&end_date=${end}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo marine returned ${response.status}`);
  const payload = await response.json();
  const times = payload.hourly?.time || [];
  const heights = payload.hourly?.sea_level_height_msl || [];

  const series = times
    .map((time, index) => ({ time, height: heights[index] }))
    .filter((point) => typeof point.height === "number");
  if (series.length < 24) throw new Error("Open-Meteo marine returned too little data");

  // A high or a low is an hour higher, or lower, than both its neighbours.
  const extremes = [];
  for (let i = 1; i < series.length - 1; i += 1) {
    const [before, at, after] = [series[i - 1], series[i], series[i + 1]];
    const isHigh = at.height > before.height && at.height >= after.height;
    const isLow = at.height < before.height && at.height <= after.height;
    if (!isHigh && !isLow) continue;
    extremes.push({
      time: at.time,
      type: isHigh ? "High" : "Low",
      heightM: Math.round(at.height * 100) / 100,
    });
  }

  return {
    source: "Open-Meteo marine forecast",
    sourceUrl: "https://open-meteo.com/",
    licence: "CC BY 4.0",
    station: `model point near ${payload.latitude.toFixed(2)}, ${payload.longitude.toFixed(2)}`,
    datum: "mean sea level",
    modelled: true,
    fetchedAt: new Date().toISOString(),
    extremes,
    series: series.map((point) => ({ time: point.time, heightM: Math.round(point.height * 100) / 100 })),
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

/** May–September: do not feature a summer-only operator as if it were open. */
function isCoolSeason(today = melbourneToday()) {
  const month = Number(today.slice(5, 7));
  return month >= 5 && month <= 9;
}

function isSummerSeasonal(business) {
  const text = [business.notes_seasonal, business.description_short, business.description_long]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /seasonal operation|available seasonally|warmer months|peak (?:holiday|season)/.test(text);
}

export function pickBusiness(week) {
  const files = ["listings_food.json", "listings_accom.json", "listings_do.json"];
  let businesses = files
    .flatMap((file) => readJson(`data/${file}`, []))
    .filter(Boolean)
    // Featuring a business that has closed sends people to a locked door.
    .filter((business) => !business.trading || business.trading.state === "open")
    .sort((a, b) => (a.slug || "").localeCompare(b.slug || ""));
  if (isCoolSeason()) {
    businesses = businesses.filter((business) => !isSummerSeasonal(business));
  }
  if (!businesses.length) return null;

  const overrideSlug = currentEdition()?.featuredBusiness;
  const business =
    (overrideSlug && businesses.find((entry) => entry.slug === overrideSlug)) ||
    businesses[rotationIndex(week) % businesses.length];
  const link =
    business.links?.find((entry) => (entry.text || "").toLowerCase() === "website") ||
    business.links?.[0] ||
    business.social_links?.[0];

  // A business of the week with a photograph is worth looking at; one without
  // is a paragraph. Where the listing has a picture, it comes along.
  const entity = entityBySlug(business.slug);
  const photo = entity ? listingPhoto(entity) : null;

  return {
    slug: business.slug,
    name: business.business_name,
    description: business.description_short || business.description_long || "",
    category: business.category_primary || null,
    locality: business.address?.locality || null,
    url: link?.url || null,
    ...(photo ? { photo: photo.url, photoAlt: photo.alt } : {}),
    ...(overrideSlug && business.slug === overrideSlug
      ? {}
      : { rotation: { position: (rotationIndex(week) % businesses.length) + 1, of: businesses.length } }),
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

async function loadOrKeep(label, previousValue, fetchFn) {
  try {
    return await fetchFn();
  } catch (error) {
    // A forecast is never invented. But a transient outage must not delete the
    // one we already have: yesterday's forecast, clearly dated, beats no forecast
    // at all, and beats a section that silently vanishes from the edition.
    console.warn(`${label} unavailable: ${error.message}`);
    if (previousValue) {
      console.warn(`keeping the ${label} fetched at ${previousValue.fetchedAt}`);
      return previousValue;
    }
    return null;
  }
}

async function refresh() {
  // A weekly edition uses its own week. A monthly Coota still refreshes the
  // current ISO week (trail/business rotation) and the coming seven days.
  const open = currentEdition();
  const week =
    weekArg ||
    (open && !isMonthly(open) ? open.week : isoWeekOf(melbourneToday()));
  const weekFile = path.join(weeklyDir, `${week}.json`);
  const comingFile = path.join(weeklyDir, "coming.json");
  const previous = existsSync(weekFile) ? JSON.parse(readFileSync(weekFile, "utf8")) : null;
  const previousComing = existsSync(comingFile) ? JSON.parse(readFileSync(comingFile, "utf8")) : null;
  const weekWindow = editionRange(week);
  const comingWindow = comingRange();

  const weather = await loadOrKeep("forecast", previous?.weather, () => fetchForecast(weekWindow));
  const tides = await loadOrKeep("tides", previous?.tides, () => fetchTides(weekWindow));

  let events = [];
  try {
    const mon = mondayOf(week);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    const startStr = mon.toISOString().slice(0, 10) + "T00:00:00";
    const endStr = sun.toISOString().slice(0, 10) + "T23:59:59";
    events = await fetchCalendarEvents(startStr, endStr);
  } catch (error) {
    console.warn(`calendar fetch failed: ${error.message}`);
    events = previous?.events?.length ? previous.events : pickEvents(week);
  }

  const payload = {
    week,
    generatedAt: new Date().toISOString(),
    weather,
    tides,
    // Computed, not fetched: the moon is arithmetic, and the tides follow it.
    moon: moonWeek(mondayOf(week).toISOString().slice(0, 10)),
    events,
    trail: pickTrail(week),
    business: pickBusiness(week),
  };

  const comingWeather = await loadOrKeep("coming forecast", previousComing?.weather, () =>
    fetchForecast(comingWindow)
  );
  const comingTides = await loadOrKeep("coming tides", previousComing?.tides, () =>
    fetchTides(comingWindow)
  );
  let comingEvents = [];
  try {
    comingEvents = await fetchCalendarEvents(
      `${comingWindow.start}T00:00:00`,
      `${comingWindow.end}T23:59:59`
    );
  } catch (error) {
    console.warn(`coming calendar fetch failed: ${error.message}`);
    comingEvents = previousComing?.events?.length ? previousComing.events : [];
  }

  const coming = {
    start: comingWindow.start,
    end: comingWindow.end,
    generatedAt: new Date().toISOString(),
    weather: comingWeather,
    tides: comingTides,
    moon: moonWeek(comingWindow.start),
    events: comingEvents,
    trail: pickTrail(week),
    business: pickBusiness(week),
  };

  console.log(`week ${week} (rotation ${rotationIndex(week)}) ${weekWindow.start} → ${weekWindow.end}`);
  console.log(`  forecast: ${weather ? `${weather.days.length} days` : "unavailable"}`);
  console.log(`  tides:    ${tides ? `${tides.extremes.length} highs and lows` : "no key configured — linking to the Bureau"}`);
  console.log(`  moon:     ${payload.moon[0].name} → ${payload.moon.at(-1).name}`);
  console.log(`  events:   ${payload.events.length}`);
  console.log(`  trail:    ${payload.trail ? payload.trail.name : "none"}`);
  console.log(`  business: ${payload.business ? payload.business.name : "none"}`);
  console.log(`coming ${comingWindow.start} → ${comingWindow.end}`);
  console.log(`  forecast: ${comingWeather ? `${comingWeather.days.length} days` : "unavailable"}`);
  console.log(`  tides:    ${comingTides ? `${comingTides.extremes.length} highs and lows` : "unavailable"}`);

  if (dryRun) {
    console.log("\n(dry run — nothing written)");
    return;
  }

  mkdirSync(weeklyDir, { recursive: true });
  // Plain punctuation in the committed file as well as on the page.
  writeFileSync(weekFile, `${JSON.stringify(plainEdition(payload), null, 2)}\n`);
  writeFileSync(comingFile, `${JSON.stringify(plainEdition(coming), null, 2)}\n`);
  console.log(`\nwrote ${path.relative(rootDir, weekFile)}`);
  console.log(`wrote ${path.relative(rootDir, comingFile)}`);
  if (open && isMonthly(open)) {
    const monthFile = path.join(weeklyDir, `${open.week}.json`);
    writeFileSync(
      monthFile,
      `${JSON.stringify(plainEdition({ week: open.week, generatedAt: coming.generatedAt, ...coming }), null, 2)}\n`
    );
    console.log(`wrote ${path.relative(rootDir, monthFile)}`);
  }
}

function isInvokedDirectly() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return path.resolve(invoked) === fileURLToPath(import.meta.url);
}

if (isInvokedDirectly()) {
  await refresh();
}

export { TRAIL_RADIUS_KM, haversineKm, isoWeek, mondayOf, rotationIndex };
