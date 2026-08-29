/*
# Project:     lovemallacoota.au
# File Name:   tide-chart.mjs
# Description: Draws the week's tides as a curve. The predictions give only the
#              highs and lows, so the water between them is interpolated with a
#              cosine — which is how a semidiurnal tide actually behaves, and
#              is honest as a shape even though only the marked points are
#              predicted values.
*/

const WIDTH = 960;
const HEIGHT = 260;
const PAD = { top: 22, right: 16, bottom: 34, left: 34 };

const DAY = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  timeZone: "Australia/Melbourne",
});
const LOCAL_DATE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Australia/Melbourne",
});
const TIME = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Australia/Melbourne",
});

/** Cosine between each pair of extremes: high to low is half a cycle. */
export function tideCurve(extremes, steps = 8) {
  const points = [];
  for (let i = 0; i < extremes.length - 1; i += 1) {
    const from = extremes[i];
    const to = extremes[i + 1];
    const t0 = new Date(from.time).getTime();
    const t1 = new Date(to.time).getTime();
    for (let step = 0; step < steps; step += 1) {
      const fraction = step / steps;
      const eased = (1 - Math.cos(Math.PI * fraction)) / 2;
      points.push({
        time: t0 + (t1 - t0) * fraction,
        height: from.heightM + (to.heightM - from.heightM) * eased,
      });
    }
  }
  const last = extremes.at(-1);
  if (last) points.push({ time: new Date(last.time).getTime(), height: last.heightM });
  return points;
}

export function tideChart(tides) {
  const extremes = (tides?.extremes || []).filter((e) => e?.time);
  if (extremes.length < 2) return null;

  const curve = tideCurve(extremes);
  const times = curve.map((p) => p.time);
  const heights = curve.map((p) => p.height);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);
  const range = maxHeight - minHeight || 1;

  const x = (time) =>
    PAD.left + ((time - minTime) / (maxTime - minTime)) * (WIDTH - PAD.left - PAD.right);
  const y = (height) =>
    HEIGHT - PAD.bottom - ((height - minHeight) / range) * (HEIGHT - PAD.top - PAD.bottom);

  const path = curve
    .map((point, index) => `${index ? "L" : "M"}${x(point.time).toFixed(1)},${y(point.height).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${x(maxTime).toFixed(1)},${HEIGHT - PAD.bottom} L${x(minTime).toFixed(1)},${HEIGHT - PAD.bottom} Z`;

  // One label per day. The key has to be the Melbourne date, not the UTC one,
  // or a single local day spans two keys and gets labelled twice.
  const dayMarks = [];
  for (const extreme of extremes) {
    const stamp = new Date(extreme.time);
    const key = LOCAL_DATE.format(stamp);
    if (dayMarks.some((mark) => mark.key === key)) continue;
    dayMarks.push({ key, x: x(stamp.getTime()), label: DAY.format(stamp) });
  }

  const marks = extremes.map((extreme) => ({
    x: x(new Date(extreme.time).getTime()),
    y: y(extreme.heightM),
    high: /high/i.test(extreme.type),
    label: `${TIME.format(new Date(extreme.time))} · ${extreme.heightM.toFixed(2)}m`,
  }));

  return { width: WIDTH, height: HEIGHT, path, area, marks, dayMarks, minHeight, maxHeight, baseline: HEIGHT - PAD.bottom };
}
