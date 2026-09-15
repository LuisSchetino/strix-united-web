# Announce FX library

The painter **composites** these files. It does not draw fake light, spray, smoke, or brush strokes to stand in for them.

Assets in this folder are H.264 MP4s without alpha. Black-background overlays use `screen`. The ink clip is a luma matte (`destination-in`, luma inverted because the file is white-open).

Encode is synchronous, so videos are decoded to `ImageBitmap` frames before paint.

## Connected (`fx-video-v1.2`)

| Slot | File | Blend | Use |
|---|---|---|---|
| lightSweep01 | `light/light-rays-sweep-01.mp4` | screen | opening + hero |
| flare01 | `light/light-leak-warm-01.mp4` | screen | opening + close |
| inkReveal01 | `ink/ink-alpha-matte-01.mp4` | destination-in | luma matte on cuts |
| smoke01 | `smoke/smoke-wisps-01.mp4` | screen | depth behind the subject |

Name accent stays a 3px type rule.

## Skipped

| File | Reason |
|---|---|
| `brush/brush-transition-01.mp4` | 4K 61s full-color plate, not a black-bg overlay. Screen-compositing it during the 0.32s cut filled the frame. |
| `light/water-caustics-01.mp4` | water caustics / blue read, off-campaign |
| `smoke/smoke-black-mixkit-01.mp4` | ~70MB; frame decode is not viable for Canvas encode |
| `smoke/fog-drift-dark-01.mp4` | deferred; wisps covers depth this round |
| `particles/embers-drift-01.mp4` | outside light / brush / ink / smoke |
| `particles/sparks-float-01.mp4` | outside light / brush / ink / smoke |
| `texture/bokeh-warm-01.mp4` | outside light / brush / ink / smoke |

Empty folders (`flash/`, `dust/`, `film/`, `grunge/`, `matte/`) stay reserved.

After swapping a connected file, bump `ANNOUNCE_FX_REVISION` in `src/features/media/announce-fx.js` so cached MP4s invalidate.
