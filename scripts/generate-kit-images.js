// Composites kit name, dosage, and purity onto the kit-specific template
// (images/_templates/kit-template.png -- a 5-vial group shot). Same overall
// approach as generate-dosage-images.js (render + measure, don't guess),
// duplicated here rather than sharing code because the template's
// composition is fundamentally different from the single-vial template --
// the label zone sits on a row of vials in a group shot, not an isolated
// vial, so the automatic width-scan in measure-template.js doesn't work
// here (it picks up the neighboring vials' label edges too). Zone
// geometry below was determined by test-rendering a visible guide box
// over the template and adjusting until it landed cleanly within the
// center vial's clean label area, not by that automatic scan.
//
// The same label (name/dosage/purity) is composited once per vial, each
// instance centered on that vial's own true axis and clipped to only the
// portion of that vial actually visible in the photo (the rest is behind
// a vial in front of it) -- this is what makes the 4 background vials
// look like genuinely labeled, partially-occluded bottles instead of
// blank ones. Only the front-center vial shows the label uncropped.
//
// Pack size is deliberately NOT drawn on the image -- an individual vial
// within a 5-pack or 10-pack box would carry the same label as the
// standalone vial of that dosage; pack quantity is a property of the box,
// not each vial. The same generated image is reused verbatim for both the
// 5-Pack and 10-Pack row of a given dosage tier.
//
// Usage:
//   node generate-kit-images.js "BPC-157|10mg|99"
//   node generate-kit-images.js "CJC/IPA Blend|10mg/10mg"   (purity omitted -> '00')

const sharp = require('sharp');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'images', '_templates', 'kit-template.png');
const OUT_DIR = path.join(__dirname, '..', 'images');
const CANVAS = 1600;
const TEXT_COLOR = 'rgb(10,22,64)';

// Measured via measure-template.js for ZONE_TOP/ZONE_BOTTOM (the automatic
// scan is still valid for those two -- it's only the width scan that
// breaks down for a multi-vial composition). USABLE_WIDTH and all Y
// positions below were determined by test-rendering a visible guide
// rectangle over the template and checking it lands within the center
// vial's clean label area, then rendering real sample names (including a
// 2-line case) to confirm before treating this as final.
//
// USABLE_WIDTH was originally 560, picked by testing whether specific
// names fit -- never checked against the front vial's true edges in the
// photo. That let text as wide as x=520-1080 through, but the vial's real
// clean-label boundary (measured directly off the template, no text) is
// only ~575-1015, so anything near the old budget bled onto the
// neighboring vials visible in the gap. Re-measured via a box overlay
// test: 420 sits with clear margin inside the true edges, 470 already
// touches them, so 440 is used as a safe midpoint.
const ZONE_TOP = 758;
const ZONE_BOTTOM = 1145;
const USABLE_WIDTH = 440;

// Front-center vial axis and true silhouette half-width, both measured
// directly off the template (see USABLE_WIDTH note above -- the true edge
// happens to land at almost exactly the same 220px half-width used for
// the text safety margin). VIAL_SPACING (center-to-center distance to the
// next vial) was derived from where the second vial's unoccluded edge
// sits (~295, an edge no other vial covers) and confirmed by overlaying
// the resulting 5 vial boxes on the template -- they land on the true
// vial boundaries and reproduce the same cutoff points as the
// already-baked-in "FOR RESEARCH USE ONLY" line on each vial.
const FRONT_CENTER_X = 800;
const VIAL_HALF_WIDTH = 220;
const VIAL_SPACING = 285;

// 5 vials left to right; index 2 is the front-center one (fully visible,
// nothing in front of it). 1/3 are the next layer back, partly covered by
// vial 2. 0/4 are the back layer, partly covered by 1/3 respectively.
const VIAL_CENTERS = [-2, -1, 0, 1, 2].map((i) => FRONT_CENTER_X + i * VIAL_SPACING);
const VIAL_TRUE_RANGES = VIAL_CENTERS.map((c) => [c - VIAL_HALF_WIDTH, c + VIAL_HALF_WIDTH]);
const VIAL_VISIBLE_RANGES = [
  [VIAL_TRUE_RANGES[0][0], Math.min(VIAL_TRUE_RANGES[0][1], VIAL_TRUE_RANGES[1][0])],
  [VIAL_TRUE_RANGES[1][0], Math.min(VIAL_TRUE_RANGES[1][1], VIAL_TRUE_RANGES[2][0])],
  VIAL_TRUE_RANGES[2],
  [Math.max(VIAL_TRUE_RANGES[3][0], VIAL_TRUE_RANGES[2][1]), VIAL_TRUE_RANGES[3][1]],
  [Math.max(VIAL_TRUE_RANGES[4][0], VIAL_TRUE_RANGES[3][1]), VIAL_TRUE_RANGES[4][1]],
];
const FRONT_VIAL_INDEX = 2;
const BACKGROUND_VIAL_INDICES = [0, 1, 3, 4];
const BACKGROUND_OPACITY = 0.4;
// Purity is set 400-weight/35px vs. the bold 700-weight name/dosage text --
// at identical opacity its thin strokes read visibly fainter (less
// anti-aliased pixel coverage), so it needs a boost to look equally faded.
const BACKGROUND_PURITY_OPACITY_BOOST = 1.6;

// Same proportional position within the (shorter) zone as the vial
// template's own calibrated layout, scaled by this zone's height ratio
// (387px here vs. 448px there) rather than reused verbatim.
const NAME_SINGLE = { yCenter: 850, fontSize: 104 };
const NAME_TWO_LINE = { line1YCenter: 820, line2YCenter: 911, fontSize: 76 };
const DOSAGE_SINGLE = { yCenter: 999, fontSize: 56 };
const DOSAGE_WRAPPED = { yCenter: 1015, fontSize: 50 };
const PURITY = { yCenter: 1123, fontSize: 35, weight: 400 };
const DOSAGE_BOX_PAD_X = 26;
const DOSAGE_BOX_PAD_Y = 16;
const MIN_FONT_SIZE = 34;
const FONT_STEP = 4;

function textEl({ text, centerX, yCenter, fontSize, color, weight = 700 }) {
  return `<text x="${centerX}" y="${yCenter}" text-anchor="middle" dominant-baseline="central"
            font-family="Quicksand" font-weight="${weight}" font-size="${fontSize}"
            fill="${color}">${text}</text>`;
}

function textSvg({ text, yCenter, fontSize, color, weight = 700 }) {
  return `<svg width="${CANVAS}" height="${CANVAS}">${textEl({ text, centerX: FRONT_CENTER_X, yCenter, fontSize, color, weight })}</svg>`;
}

function boxedTextEl({ text, centerX, yCenter, fontSize, color, weight = 700, textWidth, textHeight, boxCenterYOffset }) {
  const boxW = textWidth + DOSAGE_BOX_PAD_X * 2;
  const boxH = textHeight + DOSAGE_BOX_PAD_Y * 2;
  const boxCenterY = yCenter + boxCenterYOffset;
  const boxX = centerX - boxW / 2;
  const boxY = boxCenterY - boxH / 2;
  return `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" ry="12"
            fill="none" stroke="${color}" stroke-width="3"/>
          ${textEl({ text, centerX, yCenter, fontSize, color, weight })}`;
}

async function measureTextMetrics(text, fontSize, weight = 700) {
  const buf = Buffer.from(textSvg({ text, yCenter: 800, fontSize, color: TEXT_COLOR, weight }));
  const { info } = await sharp(buf).trim().toBuffer({ resolveWithObject: true });
  const centerX = -info.trimOffsetLeft + info.width / 2;
  const centerY = -info.trimOffsetTop + info.height / 2;
  return { width: info.width, height: info.height, centerYOffset: centerY - 800, centerXOffset: centerX - FRONT_CENTER_X };
}

async function measureTextWidth(text, fontSize) {
  return (await measureTextMetrics(text, fontSize)).width;
}

async function shrinkToFit(text, startSize, maxWidth) {
  let size = startSize;
  while (size > MIN_FONT_SIZE) {
    const w = await measureTextWidth(text, size);
    if (w <= maxWidth) return size;
    size -= FONT_STEP;
  }
  return MIN_FONT_SIZE;
}

function findBreakPoint(name) {
  const slashIdx = name.indexOf('/');
  if (slashIdx !== -1 && slashIdx < name.length - 1) {
    return [name.slice(0, slashIdx + 1), name.slice(slashIdx + 1)];
  }
  let bestSpace = -1;
  let bestDist = Infinity;
  const mid = name.length / 2;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === ' ') {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) { bestDist = dist; bestSpace = i; }
    }
  }
  if (bestSpace === -1) return null;
  return [name.slice(0, bestSpace).trim(), name.slice(bestSpace + 1).trim()];
}

async function layoutName(name) {
  const singleWidth = await measureTextWidth(name, NAME_SINGLE.fontSize);
  if (singleWidth <= USABLE_WIDTH) {
    return {
      nameLines: [{ text: name, yCenter: NAME_SINGLE.yCenter, fontSize: NAME_SINGLE.fontSize }],
      dosage: DOSAGE_SINGLE,
      mode: '1-line',
    };
  }

  const brokenLines = findBreakPoint(name);
  if (!brokenLines) {
    const fitSize = await shrinkToFit(name, NAME_SINGLE.fontSize, USABLE_WIDTH);
    return {
      nameLines: [{ text: name, yCenter: NAME_SINGLE.yCenter, fontSize: fitSize }],
      dosage: DOSAGE_SINGLE,
      mode: `1-line-shrunk(${fitSize}px)`,
    };
  }

  let fontSize = NAME_TWO_LINE.fontSize;
  for (const line of brokenLines) {
    const w = await measureTextWidth(line, fontSize);
    if (w > USABLE_WIDTH) {
      const fit = await shrinkToFit(line, fontSize, USABLE_WIDTH);
      fontSize = Math.min(fontSize, fit);
    }
  }
  return {
    nameLines: [
      { text: brokenLines[0], yCenter: NAME_TWO_LINE.line1YCenter, fontSize },
      { text: brokenLines[1], yCenter: NAME_TWO_LINE.line2YCenter, fontSize },
    ],
    dosage: DOSAGE_WRAPPED,
    mode: `2-line(${fontSize}px)`,
  };
}

function slugPart(s) {
  return s
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugify(name, dosage) {
  const base = slugPart(name);
  const dosagePart = dosage ? slugPart(dosage) : '';
  return dosagePart ? `${base}-${dosagePart}` : base;
}

function parseArg(arg) {
  const [name, dosage, purity] = arg.split('|');
  return { name, dosage: dosage || '', purity: purity || '00' };
}

// Builds the <g clip-path="..."> block for one vial: the name/dosage/purity
// elements recentered on that vial's own axis, clipped to the slice of it
// actually visible in the photo. clipId must be unique per vial per call.
// Background vials render at reduced opacity -- at full strength the same
// oversized front-vial font tiled across 4 more vials read as cluttered
// rather than like a natural photo of several bottles (see conversation --
// this was rejected at opacity 1 before landing here). A blur filter was
// also tried and rejected: SVG applies filters before clip-path, so the
// blur only softened glyph interiors, not the clip boundary itself,
// leaving a razor-sharp cut around a softened glyph (looked like a
// mismatched artifact, not a natural occlusion edge) while also washing
// out the thin 400-weight purity line far more than the bold 700-weight
// name/dosage text at the same nominal opacity. Dropping blur fixed the
// clip-edge artifact, but the purity/name opacity mismatch turned out to
// be inherent to opacity math on thin vs. bold strokes, not the blur --
// so purity gets its own higher opacity here to read as equally faded.
function vialLabelGroup({ vialIndex, clipId, layout, dosage, dosageMetrics, purity, opacity = 1 }) {
  const centerX = VIAL_CENTERS[vialIndex];
  const [clipLeft, clipRight] = VIAL_VISIBLE_RANGES[vialIndex];
  const purityOpacity = opacity < 1 ? Math.min(1, opacity * BACKGROUND_PURITY_OPACITY_BOOST) : opacity;

  const nameEls = layout.nameLines
    .map((line) => textEl({ text: line.text, centerX, yCenter: line.yCenter, fontSize: line.fontSize, color: TEXT_COLOR }))
    .join('\n');

  const dosageEl = dosage
    ? boxedTextEl({
        text: dosage.toUpperCase(), centerX, yCenter: layout.dosage.yCenter, fontSize: layout.dosage.fontSize,
        color: TEXT_COLOR, textWidth: dosageMetrics.width, textHeight: dosageMetrics.height,
        boxCenterYOffset: dosageMetrics.centerYOffset,
      })
    : '';

  const purityEl = textEl({
    text: `${purity}% Purity`, centerX, yCenter: PURITY.yCenter, fontSize: PURITY.fontSize,
    color: TEXT_COLOR, weight: PURITY.weight,
  });

  return `
    <clipPath id="${clipId}"><rect x="${clipLeft}" y="0" width="${clipRight - clipLeft}" height="${CANVAS}"/></clipPath>
    <g clip-path="url(#${clipId})">
      <g opacity="${opacity}">
        ${nameEls}
        ${dosageEl}
      </g>
      <g opacity="${purityOpacity}">
        ${purityEl}
      </g>
    </g>`;
}

// outDir defaults to images/ for direct CLI use, but callers doing a batch
// rename afterward (generate-kit-batch.js) MUST pass a scratch directory
// instead. The natural slug here is derived from `name`+`dosage` alone, and
// once "Kit" was dropped from the rendered name those can collide exactly
// with a real standalone product's own image filename (e.g. "BPC-157" 10mg
// slugs to the same path as the real bpc-157-10mg-tpl.webp product image).
// Writing straight into images/ overwrites that real file, then the
// batch's rename moves it away entirely -- this silently destroyed 13 real
// product images twice before being caught. Routing through a scratch dir
// makes that collision structurally impossible, not just unlikely.
async function generate({ name, dosage, purity, slugSuffix = '', outDir = OUT_DIR }) {
  const base = await sharp(TEMPLATE)
    .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
    .toBuffer();

  const layout = await layoutName(name);

  let dosageMetrics = null;
  if (dosage) {
    dosageMetrics = await measureTextMetrics(dosage.toUpperCase(), layout.dosage.fontSize);
  }

  const groups = [FRONT_VIAL_INDEX, ...BACKGROUND_VIAL_INDICES]
    .map((vialIndex) =>
      vialLabelGroup({
        vialIndex, clipId: `vial-clip-${vialIndex}`, layout, dosage, dosageMetrics, purity,
        opacity: vialIndex === FRONT_VIAL_INDEX ? 1 : BACKGROUND_OPACITY,
      })
    )
    .join('\n');

  const compositeSvg = Buffer.from(`<svg width="${CANVAS}" height="${CANVAS}">${groups}</svg>`);

  const slug = slugify(name, dosage) + slugSuffix;
  const outPath = path.join(outDir, slug + '.webp');
  await sharp(base)
    .composite([{ input: compositeSvg }])
    .webp({ quality: 92 })
    .toFile(outPath);

  const mode = dosage ? layout.mode : `${layout.mode}+no-dosage-box`;
  return { name, dosage, purity, mode, outPath, imagePathForDb: 'images/' + slug + '.png' };
}

async function main() {
  const args = process.argv.slice(2).map(parseArg);

  if (args.length === 0) {
    console.error('Usage: node generate-kit-images.js "<name>|<dosage>[|<purity>]" [...]');
    process.exit(1);
  }

  const results = [];
  for (const arg of args) {
    results.push(await generate(arg));
  }

  console.log('\nGenerated files:');
  for (const r of results) {
    console.log(`  ${r.name.padEnd(24)} ${r.dosage.padEnd(10)} purity:${r.purity.padEnd(6)} ${r.mode.padEnd(16)} ${r.outPath}`);
  }
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { generate, slugify };
