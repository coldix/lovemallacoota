/*
# Project:     lovemallacoota.au
# File Name:   moon.mjs
# Description: Moon phase for a given day. Astronomy, not a data feed: the
#              synodic month is 29.530588853 days from a known new moon, which
#              is accurate to a few hours — far better than the half-day
#              precision a phase name needs.
#
#              Tides follow the moon, so the phase is worth printing beside
#              them even while the tide heights themselves are unlicensed.
*/

/** A known new moon: 6 January 2000, 18:14 UTC. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_MONTH = 29.530588853;
const DAY = 86400000;

/** Days since the last new moon, 0 to 29.53. */
export function moonAge(date) {
  const elapsed = (new Date(date).getTime() - KNOWN_NEW_MOON) / DAY;
  const age = elapsed % SYNODIC_MONTH;
  return age < 0 ? age + SYNODIC_MONTH : age;
}

/** How much of the disc is lit, 0 to 1. */
export function moonIllumination(date) {
  const phase = (moonAge(date) / SYNODIC_MONTH) * 2 * Math.PI;
  return (1 - Math.cos(phase)) / 2;
}

const PHASES = [
  { name: "New moon", symbol: "●", upTo: 1.0 },
  { name: "Waxing crescent", symbol: "☽", upTo: 6.4 },
  { name: "First quarter", symbol: "◑", upTo: 8.4 },
  { name: "Waxing gibbous", symbol: "◕", upTo: 13.8 },
  { name: "Full moon", symbol: "○", upTo: 15.8 },
  { name: "Waning gibbous", symbol: "◔", upTo: 21.1 },
  { name: "Last quarter", symbol: "◐", upTo: 23.1 },
  { name: "Waning crescent", symbol: "☾", upTo: 28.5 },
  { name: "New moon", symbol: "●", upTo: 29.54 },
];

export function moonPhase(date) {
  const age = moonAge(date);
  const phase = PHASES.find((entry) => age <= entry.upTo) || PHASES.at(-1);
  return {
    name: phase.name,
    symbol: phase.symbol,
    age: Math.round(age * 10) / 10,
    illumination: Math.round(moonIllumination(date) * 100),
    /* A spring tide runs a day or two after new and full moon, when sun and
       moon pull together; a neap tide follows the quarters. */
    range: age <= 2 || (age >= 13.5 && age <= 16.5) || age >= 27.5 ? "spring" : (age >= 6 && age <= 9) || (age >= 21 && age <= 24) ? "neap" : "between",
  };
}

/** The seven days of a week, each with its phase. */
export function moonWeek(weekStart) {
  const start = new Date(`${weekStart}T12:00:00+10:00`).getTime();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start + index * DAY);
    return { date: date.toISOString().slice(0, 10), ...moonPhase(date) };
  });
}
