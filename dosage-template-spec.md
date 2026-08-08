# Vial label template — production spec

## Purpose

Today, every product photo has its dosage number (and product name, LOT #, disclaimer)
baked into the image by whatever process generated the current catalog photos. That
means swapping "5mg" → "10mg" for a size-tier change means shooting/generating an
entirely new photo per dosage.

This spec is for a **single new template photo** with the label's text areas left
blank — flat, evenly-lit color panels with no text baked in. Our own code then draws
product name, dosage, LOT #, and the disclaimer on top of that blank template at
export time, so every dosage/product combination reuses the same photo. Confirmed
feasible via prototype (see below); this is what the photo needs to make that
prototype's visible seams go away.

## Why "flat panels," specifically

We tested retrofitting this onto an *existing* photo (`bpc-157 5mg.png`) by erasing
its baked-in text and redrawing it. Font, sizing, and positioning all matched
convincingly — but the erased regions stayed visible as faint rectangular patches,
because the original label surface has continuous, photographic lighting variation
across it (subtle brightness gradients from the studio lighting) that a flat fill
can't reproduce, no matter how much the patch edges are feathered. The fix isn't
better patching — it's a source photo whose label panels never had that gradient
baked in to begin with. If the header/body panels are rendered as genuinely flat,
uniform color, our text layer sits on top with zero seams, guaranteed.

## What to keep exactly as-is

Everything about the vial itself, matching the current catalog style:

- Glass vial + silver crimp cap, same proportions, angle, and material rendering as
  the existing photos (e.g. `images/bpc-157  5mg.png` as the reference).
- Natural drop shadow beneath the vial.
- Photographic lighting/shading on the **glass and cap** — that's real depth we want
  to keep. It's specifically the two **label panels** (navy header, white body) that
  need to be flat.
- The label should still wrap around the cylinder with its natural curve/perspective
  (don't render it as a flat sticker) — "flat" here means *uniform tone*, not
  *undistorted geometry*. The curve is fine and expected; a lighting gradient across
  the panel is what to avoid.
- Green accent stripe between the header and body, same as current design.

## What must change: the two text panels

1. **Navy header bar** — solid, uniform navy fill, no text, no gradient across its
   surface. Target color: `RGB(56, 74, 115)` (sampled from the current catalog's flat
   fill areas — a small amount of natural photographic falloff toward the curved
   edges is fine and expected).
2. **White/off-white label body** — solid, uniform fill, no text. Target color:
   `RGB(242, 240, 243)`.
3. **Green stripe** — solid fill, no gradient. Target color: `RGB(67, 144, 84)`.

No text, no logo, no placeholder copy anywhere on the label. Just the three blank
panels in that stacked layout (navy → green → white), matching the current catalog's
proportions.

## Canvas & compositing conventions (so it drops into our existing pipeline)

- Deliver at **1600×1600px**, square, matching every other catalog image.
- Vial (cap to base/shadow) should fill roughly **86% of the canvas height**,
  horizontally centered, positioned with a slightly larger bottom margin than top
  (matches the existing `CONTENT_FRAC=0.86` / vertical offset convention used across
  the current catalog — see any current image for reference proportions).
- Background: flat `RGB(247, 246, 250)` — the same standard used across the whole
  catalog (confirmed already, don't reinvent).

## Text block spec (for our overlay code — informational, not for the photographer)

Once the blank template exists, our compositing code draws text using these
calibrated values (measured against the current `bpc-157 5mg.png` at 1600×1600 and
validated in the prototype). All text is horizontally centered at **x = 800**
(canvas center). Font is **Quicksand Bold** (confirmed close match to the current
catalog's lettering) throughout.

| Element | Y-center (px) | Font size (px) | Color |
|---|---|---|---|
| "FORGEWELL" wordmark | 673 | 90 | `RGB(255,255,255)` |
| Product name (1 line) | 885 | 120 | `RGB(10,22,64)` |
| Dosage number | 1057 | 85 | `RGB(10,22,64)` |
| Disclaimer line 1 | 1238 | 38 | `RGB(15,15,15)` |
| Disclaimer line 2 | 1278 | 38 | `RGB(15,15,15)` |

**Y-center isn't the rendered visual center**: `dominant-baseline="central"` in the
sharp/resvg SVG renderer used by `generate-dosage-images.js` centers on the font's
ascent/descent box, not the actual glyph ink — for text without descenders that
renders visibly *above* the given Y-center, by an offset that scales with font size
(empirically ~0.26 × font-size px for this font/renderer). The Dosage number row
above was recalibrated by rendering test composites and measuring the actual pixel
bounding box against `bpc-157 5mg.webp`, not by computing this offset analytically —
do the same (render + measure, don't just eyeball the SVG) if any row here is
revisited.

**Variable-length product names**: the current catalog's name block auto-adjusts for
longer names (wraps to 2 lines, shrinks font, and pushes the dosage block down
accordingly — confirmed by comparing several existing labels). Our overlay code will
replicate that: fixed single-line size/position above for short names, falling back
to a 2-line wrap + smaller font + shifted-down dosage block for longer ones. No
action needed from the photo itself — this is purely on our compositing side, noted
here so the panel height (see above) has enough room to absorb a 2-line name without
running into the LOT line.

## Deliverable

- One PNG, 1600×1600px, matching the above.
- Ideally also the un-composited/higher-res source if generated via a 3D render or
  AI pipeline, in case we need to re-render at a different canvas size later.
