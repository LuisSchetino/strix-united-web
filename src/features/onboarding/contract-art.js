// The contract's engraving: pure geometry for the security border, the rosette
// behind the watermark and the pen. Everything is plain SVG with presentation
// attributes, so the page, the PDF and the video rasterise the same drawing.

export const SHEET = Object.freeze({ width: 794, height: 1123 });
export const INK = "#1b2546";
export const ENGRAVING = "#2b3038";

const round = (value) => Math.round(value * 10) / 10;

function polyline(points) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${round(x)} ${round(y)}`).join("") + "Z";
}

/**
 * Epitrochoid rosette: the classic guilloche of banknotes and certificates.
 * `loops` petals, drawn once, centred on (cx, cy).
 */
export function rosettePath({ cx, cy, radius, loops = 18, depth = 0.32, steps = 1440 }) {
  const points = [];
  const inner = radius * (1 - depth);
  for (let index = 0; index <= steps; index += 1) {
    const t = (index / steps) * Math.PI * 2;
    const r = inner + radius * depth * (0.5 + 0.5 * Math.cos(loops * t));
    const wobble = 1 + 0.025 * Math.sin((loops * 3 + 1) * t);
    points.push([cx + Math.cos(t) * r * wobble, cy + Math.sin(t) * r * wobble]);
  }
  return polyline(points);
}

/** Interlaced waves along one straight band, for the border. */
export function bandWaves({ x, y, length, vertical = false, amplitude = 3.2, wavelength = 14, phase = 0 }) {
  const points = [];
  const steps = Math.max(8, Math.round(length / 2.5));
  for (let index = 0; index <= steps; index += 1) {
    const along = (index / steps) * length;
    const offset = amplitude * Math.sin((along / wavelength) * Math.PI * 2 + phase);
    points.push(vertical ? [x + offset, y + along] : [x + along, y + offset]);
  }
  return points.map(([px, py], index) => `${index ? "L" : "M"}${round(px)} ${round(py)}`).join("");
}

/** The four bands of the security frame, two phases each, inset `inset` from the sheet edge. */
export function securityFrame({ inset = 22, width = SHEET.width, height = SHEET.height } = {}) {
  const left = inset;
  const right = width - inset;
  const top = inset;
  const bottom = height - inset;
  const runX = right - left - 40;
  const runY = bottom - top - 40;
  const paths = [];
  for (const phase of [0, Math.PI]) {
    paths.push(bandWaves({ x: left + 20, y: top, length: runX, phase }));
    paths.push(bandWaves({ x: left + 20, y: bottom, length: runX, phase }));
    paths.push(bandWaves({ x: left, y: top + 20, length: runY, vertical: true, phase }));
    paths.push(bandWaves({ x: right, y: top + 20, length: runY, vertical: true, phase }));
  }
  const corners = [[left, top], [right, top], [left, bottom], [right, bottom]]
    .map(([cx, cy]) => rosettePath({ cx, cy, radius: 13, loops: 9, depth: 0.45, steps: 360 }));
  return { waves: paths.join(""), corners, box: { left, right, top, bottom } };
}

let cachedFrame = null;
let cachedRosettes = null;
export function paperArt() {
  cachedFrame ||= securityFrame();
  cachedRosettes ||= [
    rosettePath({ cx: SHEET.width / 2, cy: 560, radius: 300, loops: 24, depth: 0.22 }),
    rosettePath({ cx: SHEET.width / 2, cy: 560, radius: 262, loops: 36, depth: 0.12 }),
  ];
  return { frame: cachedFrame, rosettes: cachedRosettes };
}

/**
 * The pen: a black lacquer fountain pen with a steel nib and a gold band.
 * Drawn along +x with the nib tip at the origin, then tilted so the tip sits at
 * PEN_TIP inside a 200×200 box. Same markup on the page and in the video.
 */
export const PEN_BOX = 200;
export const PEN_TIP = Object.freeze({ x: 10, y: 190 });
export const PEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs>
<linearGradient id="pen-body" x1="0" y1="-9" x2="0" y2="9" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4a4f58"/><stop offset=".28" stop-color="#16181c"/><stop offset=".7" stop-color="#0a0b0d"/><stop offset="1" stop-color="#26292f"/></linearGradient>
<linearGradient id="pen-steel" x1="0" y1="-6" x2="0" y2="6" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f4f5f7"/><stop offset=".45" stop-color="#b9bec6"/><stop offset="1" stop-color="#6c727c"/></linearGradient>
<linearGradient id="pen-gold" x1="0" y1="-9" x2="0" y2="9" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f3dc98"/><stop offset=".5" stop-color="#c49a44"/><stop offset="1" stop-color="#7d5c22"/></linearGradient>
</defs>
<g transform="translate(10 190) rotate(-48)">
<path d="M0 0 L26 -6.2 Q30 -6.6 31 -5 L31 5 Q30 6.6 26 6.2 Z" fill="url(#pen-steel)" stroke="#4b5059" stroke-width=".6"/>
<path d="M2 0 L24 0" stroke="#3a3f47" stroke-width=".8"/>
<circle cx="21" cy="0" r="1.4" fill="#3a3f47"/>
<path d="M30 -6.4 L52 -7.4 L52 7.4 L30 6.4 Z" fill="url(#pen-body)"/>
<rect x="52" y="-8.6" width="6" height="17.2" rx="1" fill="url(#pen-gold)"/>
<path d="M58 -8.6 L186 -9.2 Q194 -9.2 195 0 Q194 9.2 186 9.2 L58 8.6 Z" fill="url(#pen-body)"/>
<rect x="128" y="-9.4" width="4" height="18.8" fill="url(#pen-gold)"/>
<path d="M134 -10.6 L182 -10.6 Q186 -10.6 186 -7.6 L186 -6.4 L134 -6.4 Z" fill="url(#pen-steel)"/>
<path d="M62 -5.6 L184 -6" stroke="#ffffff" stroke-opacity=".22" stroke-width="1.6" stroke-linecap="round"/>
</g>
</svg>`;
