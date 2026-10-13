// How the pen writes a stored signature: the strokes in order, each drawn at a
// handwriting pace, with the pen lifted and carried between strokes. The page
// (ContractInstrument) and the video (contract-export) read the same timeline.

export function parseStrokes(d) {
  const strokes = [];
  let current = null;
  for (const [, command, rawX, rawY] of String(d || "").matchAll(/([ML])\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)) {
    const point = [Number(rawX), Number(rawY)];
    if (command === "M" || !current) {
      current = [point];
      strokes.push(current);
    } else current.push(point);
  }
  return strokes.filter((stroke) => stroke.length > 0).map((stroke) => (stroke.length === 1 ? [stroke[0], [stroke[0][0] + 1, stroke[0][1]]] : stroke));
}

const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

function strokeLength(stroke) {
  let total = 0;
  for (let index = 1; index < stroke.length; index += 1) total += distance(stroke[index - 1], stroke[index]);
  return total;
}

/** Points of `stroke` up to `length` along it (interpolating the last point). */
function strokeUpTo(stroke, length) {
  const out = [stroke[0]];
  let left = length;
  for (let index = 1; index < stroke.length; index += 1) {
    const segment = distance(stroke[index - 1], stroke[index]);
    if (left >= segment) {
      out.push(stroke[index]);
      left -= segment;
      continue;
    }
    const ratio = segment ? left / segment : 0;
    out.push([
      stroke[index - 1][0] + (stroke[index][0] - stroke[index - 1][0]) * ratio,
      stroke[index - 1][1] + (stroke[index][1] - stroke[index - 1][1]) * ratio,
    ]);
    break;
  }
  return out;
}

/**
 * Timeline in seconds. Writing runs at ~900 viewBox units/s (a quick, confident
 * hand); a lift between strokes takes 0.12s plus the distance travelled.
 */
export function signatureTimeline(d, { pace = 900, minDuration = 1.4, maxDuration = 3.2 } = {}) {
  const strokes = parseStrokes(d);
  const segments = [];
  let cursor = 0;
  strokes.forEach((stroke, index) => {
    if (index) {
      const from = strokes[index - 1].at(-1);
      const travel = 0.12 + distance(from, stroke[0]) / 2200;
      segments.push({ kind: "lift", from, to: stroke[0], start: cursor, end: cursor + travel });
      cursor += travel;
    }
    const length = strokeLength(stroke);
    const time = Math.max(0.08, length / pace);
    segments.push({ kind: "ink", stroke, index, length, start: cursor, end: cursor + time });
    cursor += time;
  });
  const scale = cursor ? Math.min(maxDuration, Math.max(minDuration, cursor)) / cursor : 1;
  segments.forEach((segment) => { segment.start *= scale; segment.end *= scale; });
  return { strokes, segments, duration: cursor * scale };
}

/**
 * State at `time` seconds: the ink drawn so far (whole strokes plus the partial
 * one) and the pen — its tip position in viewBox units and how high it is lifted
 * (0 on the paper, 1 in the air).
 */
export function signatureAt(timeline, time) {
  const { strokes, segments, duration } = timeline;
  if (!strokes.length) return { ink: [], pen: null, done: true };
  if (time >= duration) return { ink: strokes, pen: { x: strokes.at(-1).at(-1)[0], y: strokes.at(-1).at(-1)[1], lift: 0 }, done: true };
  const ink = [];
  let pen = { x: strokes[0][0][0], y: strokes[0][0][1], lift: time < 0 ? 1 : 0 };
  for (const segment of segments) {
    if (time < segment.start) break;
    const local = Math.min(1, (time - segment.start) / Math.max(0.0001, segment.end - segment.start));
    if (segment.kind === "ink") {
      const drawn = strokeUpTo(segment.stroke, segment.length * easeInOut(local));
      ink[segment.index] = drawn;
      const tip = drawn.at(-1);
      pen = { x: tip[0], y: tip[1], lift: 0 };
    } else {
      const eased = easeInOut(local);
      pen = {
        x: segment.from[0] + (segment.to[0] - segment.from[0]) * eased,
        y: segment.from[1] + (segment.to[1] - segment.from[1]) * eased,
        lift: Math.sin(Math.PI * local),
      };
    }
  }
  return { ink: ink.filter(Boolean), pen, done: false };
}

export const inkPath = (ink) => ink
  .map((stroke) => stroke.map(([x, y], index) => `${index ? "L" : "M"}${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join(""))
  .join("");

// The pen arrives before the first stroke and leaves after the last one.
export const PEN_LEAD = 0.45;
export const PEN_TAIL = 0.6;
const ease = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

/**
 * Where the pen is at `time` (seconds, 0 = first touch), in viewBox units, with
 * how lifted it is and how visible. Before 0 it glides in and touches down;
 * after the last stroke it rises and leaves.
 */
export function penPose(timeline, time) {
  const state = signatureAt(timeline, Math.min(time, timeline.duration));
  if (!state.pen) return { x: 0, y: 0, lift: 1, opacity: 0 };
  if (time < 0) {
    const p = ease(1 + time / PEN_LEAD);
    return { x: state.pen.x + (1 - p) * 120, y: state.pen.y - (1 - p) * 90, lift: 1 - p, opacity: Math.min(1, (1 + time / PEN_LEAD) * 2) };
  }
  if (time > timeline.duration) {
    const raw = (time - timeline.duration) / PEN_TAIL;
    const q = ease(raw);
    return { x: state.pen.x + q * 130, y: state.pen.y - q * 110, lift: q, opacity: Math.max(0, 1 - raw) };
  }
  return { ...state.pen, opacity: 1 };
}
