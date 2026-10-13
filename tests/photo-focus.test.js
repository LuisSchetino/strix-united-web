import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { headFrame } from "../src/ui/photo-focus.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

/** A standing figure cut out of its background: a head, then a wider body down to the feet. */
function standing({ width = 72, height = 108, centre = 36, top = 4 } = {}) {
  const tall = height - top - 2;
  const unit = tall / 7.4;
  return {
    width, height,
    alpha: (x, y) => {
      const d = y - top;
      if (d < 0 || d > tall) return 0;
      const half = d < unit ? unit * 0.42 : d < unit * 1.15 ? unit * 0.15 : unit * 1.25;
      return Math.abs(x - centre) <= half ? 255 : 0;
    },
  };
}

/** The part of the picture a frame ends up showing, in the picture's own pixels. */
function shown(frame, { width, height }) {
  const windowTop = frame.top * (height - width);
  const side = width / frame.zoom;
  const left = ((frame.x / 100) * width * (frame.zoom - 1)) / frame.zoom;
  const top = ((frame.y / 100) * width * (frame.zoom - 1)) / frame.zoom;
  return { left, right: left + side, top: windowTop + top, bottom: windowTop + top + side, side };
}

test("a body shot cut out of its background is framed on the head", () => {
  const figure = standing();
  const frame = headFrame(figure);
  assert.ok(frame, "the outline says where the head is");
  assert.ok(frame.zoom > 1.8 && frame.zoom <= 3.2, "the token closes in on the top of the figure");
  const view = shown(frame, figure);
  const unit = (figure.height - 4 - 2) / 7.4;
  assert.ok(view.top <= 4 && view.top >= 0, "the top of the head is inside the token, with a little air above");
  assert.ok(view.bottom >= 4 + unit * 1.6, "and the shoulders are in it too");
  assert.ok(view.bottom < 4 + unit * 3.4, "not the whole torso");
  assert.ok(Math.abs((view.left + view.right) / 2 - 36) < 1, "centred on the head");
});

test("a figure standing off-centre is followed, not the middle of the picture", () => {
  const figure = standing({ centre: 48 });
  const view = shown(headFrame(figure), figure);
  assert.ok(Math.abs((view.left + view.right) / 2 - 48) < 1.5);
  assert.ok(view.left >= -0.01 && view.right <= figure.width + 0.01, "the frame never leaves the picture");
});

test("anything else keeps the usual framing: nothing is guessed", () => {
  const solid = { width: 72, height: 108, alpha: () => 255 };
  assert.equal(headFrame(solid), null, "a photograph with its background has no outline to read");
  assert.equal(headFrame({ width: 72, height: 72, alpha: standing().alpha }), null, "a square picture is already a portrait");
  assert.equal(headFrame({ width: 72, height: 108, alpha: () => 0 }), null, "an empty picture");
  assert.equal(headFrame({}), null);
  // A bust (wide for its height) is shown nearly whole instead of being cropped to a forehead.
  const bust = { width: 72, height: 100, alpha: (x, y) => (y > 6 && Math.abs(x - 36) <= (y < 40 ? 16 : 34) ? 255 : 0) };
  assert.ok(headFrame(bust).zoom < 1.35);
});

test("only a player's photo is measured, and the token applies the frame", async () => {
  const [logo, css, field] = await Promise.all([read("../src/ui/ClubLogo.jsx"), read("../src/ui/club-logo.css"), read("../src/features/agenda/lineup-field.css")]);
  assert.match(logo, /if \(kind !== "photo" \|\| !\(image\?\.naturalWidth > 0\) \|\| image\.naturalHeight \/ image\.naturalWidth <= 1\.1\) return;/);
  assert.match(logo, /"--focus-zoom": focus\.zoom/);
  assert.match(css, /\.club-logo\.is-photo\.has-focus img\{[^}]*transform:scale\(var\(--focus-zoom, 1\)\)/);
  assert.match(field, /\.formation-slot i \.avatar\.is-photo img,[\s\S]*?object-position: center 18%;/, "the pitch no longer centres the picture on the torso");
});
