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
// The 5 vials are NOT one shared scale -- they sit at 3 distinct depth
// tiers (front / middle pair vial1+vial3 / back pair vial0+vial4), each
// smaller and positioned higher in frame than the one in front of it.
// This was confirmed by measuring each vial's own baked-in disclaimer
// text (unrelated to anything rendered here): front's sits at y~1197,
// the middle pair at y~1155-1160, the back pair at y~1110-1120 -- an
// ~85-90px spread. An earlier version reused the front vial's absolute
// Y-positions and half-width for all 4 background vials, which (a) put
// the purity line on top of the back pair's real disclaimer text, since
// it was calibrated against the front vial's much-lower disclaimer, and
// (b) let content spill past the back pair's true (smaller) silhouette,
// since their real half-width is ~180px, not the front's 220px. Each
// vial's own green-band-top sits at a near-constant y~738 regardless of
// tier, which gives a shared anchor point; scaling the front vial's
// Y-offsets-from-that-anchor by each tier's measured ratio reproduces
// every independently-measured true edge to within a couple of pixels
// (see conversation), which is the cross-check that this model is right
// rather than another unverified formula.
//
// The same label (name/dosage/purity) is composited once per vial, each
// scaled to its own tier, centered on that vial's own axis, and clipped
// to only the portion of it actually visible in the photo (the rest is
// behind a vial in front of it) -- this is what makes the 4 background
// vials look like genuinely labeled, partially-occluded bottles instead
// of blank ones. Only the front-center vial shows the label uncropped.
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

// USABLE_WIDTH was originally 560, picked by testing whether specific
// names fit -- never checked against the front vial's true edges in the
// photo. That let text as wide as x=520-1080 through, but the vial's real
// clean-label boundary (measured directly off the template, no text) is
// only ~575-1015, so anything near the old budget bled onto the
// neighboring vials visible in the gap. Re-measured via a box overlay
// test: 420 sits with clear margin inside the true edges, 470 already
// touches them, so 440 is used as a safe midpoint.
//
// All of the following is the FRONT vial's calibration (scale = 1.0);
// the 4 background vials derive their own geometry from this via
// deriveTier() below, not by reusing these numbers directly.
const FRONT_CENTER_X = 800;
const FRONT_HALF_WIDTH = 220;
const FRONT = {
  centerX: FRONT_CENTER_X,
  halfWidth: FRONT_HALF_WIDTH,
  usableWidth: 440,
  nameSingle: { yCenter: 850, fontSize: 104 },
  nameTwoLine: { line1YCenter: 820, line2YCenter: 911, fontSize: 76 },
  dosageSingle: { yCenter: 999, fontSize: 56 },
  dosageWrapped: { yCenter: 1015, fontSize: 50 },
  // yCenter was 1123 (a 74px gap to the front vial's disclaimer at
  // y~1197), inherited from the kit template's original ZONE_BOTTOM=1145
  // guess -- ~52px off from the front vial's real disclaimer position.
  // The single-vial template deliberately anchors purity *tight* against
  // its own disclaimer (22px gap at fontSize 40 -- see
  // generate-dosage-images.js's own comment: "sit 'just above/overlapping'
  // the disclaimer"). Re-derived here to match that same proportional
  // gap -- (1204-778)/(1226-778) of the single-vial's zone -- applied to
  // the kit's own zone (738 to the measured 1197), then confirmed by
  // rendering "00% Purity" at fontSize 35 and measuring its actual glyph
  // bottom (not just the y-anchor): lands ~15px above the disclaimer.
  purity: { yCenter: 1175, fontSize: 35, weight: 400 },
  dosageBoxPadX: 26,
  dosageBoxPadY: 16,
  minFontSize: 34,
};
const FONT_STEP = 4;

// Shared vertical anchor (see header comment) -- each vial's green band
// top sits at ~738 regardless of tier/scale.
const GREEN_BAND_TOP_Y = 738;
// Measured from each tier's own disclaimer-line-1 baseline vs. the front
// vial's (1197), relative to the shared GREEN_BAND_TOP_Y anchor:
//   front span = 1197 - 738 = 459 (scale 1.0 by definition)
//   middle pair (vial1 ~1160, vial3 ~1155) span ~422 -> scale 0.914
//   back pair (vial0 ~1120, vial4 ~1110) span ~377 -> scale 0.821
const MID_SCALE = 0.914;
const BACK_SCALE = 0.821;

function scaleY(frontY, scale) {
  return GREEN_BAND_TOP_Y + (frontY - GREEN_BAND_TOP_Y) * scale;
}

function deriveTier(scale, centerX, halfWidth) {
  return {
    centerX,
    halfWidth,
    usableWidth: FRONT.usableWidth * scale,
    nameSingle: { yCenter: scaleY(FRONT.nameSingle.yCenter, scale), fontSize: FRONT.nameSingle.fontSize * scale },
    nameTwoLine: {
      line1YCenter: scaleY(FRONT.nameTwoLine.line1YCenter, scale),
      line2YCenter: scaleY(FRONT.nameTwoLine.line2YCenter, scale),
      fontSize: FRONT.nameTwoLine.fontSize * scale,
    },
    dosageSingle: { yCenter: scaleY(FRONT.dosageSingle.yCenter, scale), fontSize: FRONT.dosageSingle.fontSize * scale },
    dosageWrapped: { yCenter: scaleY(FRONT.dosageWrapped.yCenter, scale), fontSize: FRONT.dosageWrapped.fontSize * scale },
    purity: { yCenter: scaleY(FRONT.purity.yCenter, scale), fontSize: FRONT.purity.fontSize * scale, weight: 400 },
    dosageBoxPadX: FRONT.dosageBoxPadX * scale,
    dosageBoxPadY: FRONT.dosageBoxPadY * scale,
    minFontSize: FRONT.minFontSize * scale,
  };
}

// Centers and true half-widths below come from directly measuring each
// vial's own unoccluded edge (vial1's true left edge, vial3's true right
// edge, vial0's true left edge, vial4's true right edge -- none of these
// four are covered by any other vial) and solving centerX = edge -+
// (FRONT_HALF_WIDTH * tierScale). Cross-checked: the resulting trueRange
// for each vial reproduces its independently-measured edge to ~1px.
const VIAL_TIERS = [
  { ...deriveTier(BACK_SCALE, 277.7, FRONT_HALF_WIDTH * BACK_SCALE), trueRange: [97, 458] },
  { ...deriveTier(MID_SCALE, 499.1, FRONT_HALF_WIDTH * MID_SCALE), trueRange: [298, 700] },
  { ...FRONT, trueRange: [FRONT_CENTER_X - FRONT_HALF_WIDTH, FRONT_CENTER_X + FRONT_HALF_WIDTH] },
  { ...deriveTier(MID_SCALE, 1068.9, FRONT_HALF_WIDTH * MID_SCALE), trueRange: [867, 1270] },
  { ...deriveTier(BACK_SCALE, 1309.3, FRONT_HALF_WIDTH * BACK_SCALE), trueRange: [1129, 1490] },
];
const FRONT_VIAL_INDEX = 2;
const BACKGROUND_VIAL_INDICES = [0, 1, 3, 4];
// Was 0.4 (dimmed, to avoid 5 vials showing the same text at full strength
// looking cluttered) -- reverted to 1 (no dimming) per explicit request:
// background vials now match the front vial's solid opacity, relying on
// the per-tier size/position calibration and clipping alone to read as
// naturally occluded rather than on a faded look.
const BACKGROUND_OPACITY = 1;
// Purity is set 400-weight/35px vs. the bold 700-weight name/dosage text --
// at identical opacity its thin strokes read visibly fainter (less
// anti-aliased pixel coverage). Only matters when BACKGROUND_OPACITY < 1;
// at 1 this boost is a no-op (opacity < 1 check below is false either way).
const BACKGROUND_PURITY_OPACITY_BOOST = 1.6;

// Visible (unoccluded) slice of each vial's trueRange, front-to-back
// occlusion order 2 (front) > 1,3 > 0,4 -- same logic as before, now
// applied to the independently-measured trueRanges above instead of a
// symmetric formula.
//
// The geometric occlusion boundary (where the nearer vial's true edge
// falls) is NOT the same as where a background vial's surface actually
// still looks clean -- the curved glass visibly darkens into shadow in
// the ~25-30px before that boundary (confirmed by measuring the raw
// template: vial1's surface starts darkening around x~525-530, well
// before its 580 occlusion boundary with the front vial). A first attempt
// trimmed the clip rect itself to compensate, but that just hard-truncated
// the dosage box mid-glyph with its border missing a side -- an obvious
// rendering artifact, worse than the shadow it was meant to fix. Left the
// clip at the true occlusion boundary and constrained content width
// instead (see dosageMaxWidth below), so nothing needs to be clipped
// there in the first place.
const VIAL_VISIBLE_RANGES = [
  [VIAL_TIERS[0].trueRange[0], Math.min(VIAL_TIERS[0].trueRange[1], VIAL_TIERS[1].trueRange[0])],
  [VIAL_TIERS[1].trueRange[0], Math.min(VIAL_TIERS[1].trueRange[1], VIAL_TIERS[2].trueRange[0])],
  VIAL_TIERS[2].trueRange,
  [Math.max(VIAL_TIERS[3].trueRange[0], VIAL_TIERS[2].trueRange[1]), VIAL_TIERS[3].trueRange[1]],
  [Math.max(VIAL_TIERS[4].trueRange[0], VIAL_TIERS[3].trueRange[1]), VIAL_TIERS[4].trueRange[1]],
];

// The dosage box prefers to center on each vial's TRUE center (matching
// name and purity), but a background vial's visible range is NOT
// symmetric around that center -- it's cut short on whichever side faces
// the occluding vial (e.g. vial1's true center sits only 81px from its
// right visible edge, vs. 201px on the left). SAFE_SHADOW_MARGIN pulls
// back from the raw visible range to stay clear of the shadow band
// measured on the real template (see conversation). Wide dosage strings
// (e.g. "20mg/20mg") can need more half-width than even the tier's
// minFontSize leaves room for on the tight side alone -- shrinking alone
// can't fix that without going illegibly small, so the box is allowed to
// shift off the true center toward whichever side has more room, clamped
// to stay within [dosageSafeLeft, dosageSafeRight], rather than staying
// rigidly centered and overflowing the tight side.
const SAFE_SHADOW_MARGIN = 25;
VIAL_TIERS.forEach((tier, i) => {
  const [visLeft, visRight] = VIAL_VISIBLE_RANGES[i];
  tier.dosageSafeLeft = visLeft + SAFE_SHADOW_MARGIN;
  tier.dosageSafeRight = visRight - SAFE_SHADOW_MARGIN;
});

// A full audit (checking every background vial's own boundary, not just
// the one first reported) found the dosage-box fix above wasn't the whole
// story: NAME text isn't width-constrained per side at all (only against
// the tier's full symmetric usableWidth), so a plain, unshrunk product
// name like "MOTS-C" on vial1 renders correctly up to the true 580
// occlusion boundary -- clipped exactly where it should be -- but still
// visibly extends solid navy right up to that hard edge, through the
// shadow band that starts ~25-30px before it. A box has a visible border
// to notice this on; plain text doesn't, which is why it went unnoticed
// until this audit specifically zoomed into that boundary.
//
// Per-element width constraints (the dosage approach) would need to be
// duplicated for name and purity too, and re-tuned per content type.
// Instead: replace the hard clip on each background vial's occlusion-
// facing (inner) edge with a soft luminance mask that fades to
// transparent over the same margin, applied once to the whole vial group
// (name+dosage+purity together) -- content that reaches the shadow band
// fades out with it rather than being sliced at a hard edge, matching how
// the boundary actually looks in the photo, regardless of what content
// happens to reach that far. The vial's own TRUE outer edge (its actual
// silhouette against open background, not another vial) keeps a hard
// edge -- that boundary doesn't show the same shadow (confirmed by
// checking the vial0/vial1 and vial3/vial4 boundaries directly: no
// visible darkening there, unlike vial1/front and vial3/front).
const FADE_MARGIN = 40;
// Which side of each background vial's visible range is occlusion-facing
// (needs the fade) vs. its own true silhouette edge (stays hard).
const INNER_EDGE_SIDE = { 0: 'right', 1: 'right', 3: 'left', 4: 'left' };

function textEl({ text, centerX, yCenter, fontSize, color, weight = 700 }) {
  return `<text x="${centerX}" y="${yCenter}" text-anchor="middle" dominant-baseline="central"
            font-family="Quicksand" font-weight="${weight}" font-size="${fontSize}"
            fill="${color}">${text}</text>`;
}

function textSvg({ text, yCenter, fontSize, color, weight = 700 }) {
  return `<svg width="${CANVAS}" height="${CANVAS}">${textEl({ text, centerX: FRONT_CENTER_X, yCenter, fontSize, color, weight })}</svg>`;
}

function boxedTextEl({ text, centerX, yCenter, fontSize, color, weight = 700, textWidth, textHeight, boxCenterYOffset, padX, padY }) {
  const boxW = textWidth + padX * 2;
  const boxH = textHeight + padY * 2;
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

async function shrinkToFit(text, startSize, maxWidth, minFontSize) {
  let size = startSize;
  while (size > minFontSize) {
    const w = await measureTextWidth(text, size);
    if (w <= maxWidth) return size;
    size -= FONT_STEP;
  }
  return minFontSize;
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

// Computes the 1-line/2-line/shrink layout for `name` within a given
// tier's own usableWidth/font sizes -- called once per tier (not once
// globally) since a name that fits on the front vial's 440px budget may
// need to wrap or shrink further on the back tier's ~360px budget.
async function layoutName(name, tier) {
  const singleWidth = await measureTextWidth(name, tier.nameSingle.fontSize);
  if (singleWidth <= tier.usableWidth) {
    return {
      nameLines: [{ text: name, yCenter: tier.nameSingle.yCenter, fontSize: tier.nameSingle.fontSize }],
      dosage: tier.dosageSingle,
      mode: '1-line',
    };
  }

  const brokenLines = findBreakPoint(name);
  if (!brokenLines) {
    const fitSize = await shrinkToFit(name, tier.nameSingle.fontSize, tier.usableWidth, tier.minFontSize);
    return {
      nameLines: [{ text: name, yCenter: tier.nameSingle.yCenter, fontSize: fitSize }],
      dosage: tier.dosageSingle,
      mode: `1-line-shrunk(${fitSize.toFixed(0)}px)`,
    };
  }

  let fontSize = tier.nameTwoLine.fontSize;
  for (const line of brokenLines) {
    const w = await measureTextWidth(line, fontSize);
    if (w > tier.usableWidth) {
      const fit = await shrinkToFit(line, fontSize, tier.usableWidth, tier.minFontSize);
      fontSize = Math.min(fontSize, fit);
    }
  }
  return {
    nameLines: [
      { text: brokenLines[0], yCenter: tier.nameTwoLine.line1YCenter, fontSize },
      { text: brokenLines[1], yCenter: tier.nameTwoLine.line2YCenter, fontSize },
    ],
    dosage: tier.dosageWrapped,
    mode: `2-line(${fontSize.toFixed(0)}px)`,
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

// Builds the <g clip-path="..."> block for one vial: name/dosage/purity
// laid out for that vial's OWN tier (own font sizes, own usableWidth),
// centered on its own axis, clipped to the slice of it actually visible
// in the photo. clipId must be unique per vial per call.
// Background vials render at reduced opacity -- at full strength the same
// oversized front-vial font tiled across 4 more vials read as cluttered
// rather than like a natural photo of several bottles (see conversation --
// this was rejected at opacity 1 before landing here). A blur filter was
// also tried and rejected: SVG applies filters before clip-path, so the
// blur only softened glyph interiors, not the clip boundary itself,
// leaving a razor-sharp cut around a softened glyph while also washing
// out the thin 400-weight purity line far more than the bold 700-weight
// name/dosage text at the same nominal opacity -- purity gets its own
// higher opacity here to compensate.
async function vialLabelGroup({ vialIndex, clipId, name, dosage, purity, opacity }) {
  const tier = VIAL_TIERS[vialIndex];
  const centerX = tier.centerX;
  const [clipLeft, clipRight] = VIAL_VISIBLE_RANGES[vialIndex];
  const purityOpacity = opacity < 1 ? Math.min(1, opacity * BACKGROUND_PURITY_OPACITY_BOOST) : opacity;

  const layout = await layoutName(name, tier);

  const nameEls = layout.nameLines
    .map((line) => textEl({ text: line.text, centerX, yCenter: line.yCenter, fontSize: line.fontSize, color: TEXT_COLOR }))
    .join('\n');

  let dosageEl = '';
  if (dosage) {
    const dosageText = dosage.toUpperCase();
    let dosageFontSize = layout.dosage.fontSize;
    let dosageMetrics = await measureTextMetrics(dosageText, dosageFontSize);
    // Prefer shrinking (keeps it centered like name/purity) down to the
    // tier's floor size if the box -- still centered on centerX -- would
    // extend past the safe zone on whichever side is tighter.
    const symmetricMaxHalfWidth = Math.min(centerX - tier.dosageSafeLeft, tier.dosageSafeRight - centerX);
    while (
      dosageMetrics.width / 2 + tier.dosageBoxPadX > symmetricMaxHalfWidth &&
      dosageFontSize > tier.minFontSize
    ) {
      dosageFontSize -= FONT_STEP;
      dosageMetrics = await measureTextMetrics(dosageText, dosageFontSize);
    }
    // If it still doesn't fit even at the floor size (e.g. a wide
    // "20mg/20mg" string on the tight side of a background vial), shift
    // the box off-center toward whichever side has more room instead of
    // letting it overflow the tight side.
    const halfWidth = dosageMetrics.width / 2 + tier.dosageBoxPadX;
    const dosageCenterX = Math.min(
      Math.max(centerX, tier.dosageSafeLeft + halfWidth),
      tier.dosageSafeRight - halfWidth
    );
    dosageEl = boxedTextEl({
      text: dosageText, centerX: dosageCenterX, yCenter: layout.dosage.yCenter, fontSize: dosageFontSize,
      color: TEXT_COLOR, textWidth: dosageMetrics.width, textHeight: dosageMetrics.height,
      boxCenterYOffset: dosageMetrics.centerYOffset, padX: tier.dosageBoxPadX, padY: tier.dosageBoxPadY,
    });
  }

  const purityEl = textEl({
    text: `${purity}% Purity`, centerX, yCenter: tier.purity.yCenter, fontSize: tier.purity.fontSize,
    color: TEXT_COLOR, weight: tier.purity.weight,
  });

  const innerSide = INNER_EDGE_SIDE[vialIndex];
  let visibilityDefs, visibilityAttr;
  if (!innerSide) {
    // Front vial: fully visible, plain hard clip (matches its true edges
    // exactly, no occlusion-facing side to soften).
    visibilityDefs = `<clipPath id="${clipId}"><rect x="${clipLeft}" y="0" width="${clipRight - clipLeft}" height="${CANVAS}"/></clipPath>`;
    visibilityAttr = `clip-path="url(#${clipId})"`;
  } else {
    // Background vial: soft luminance mask instead of a hard clip. White
    // = fully visible, fading to black (transparent) over FADE_MARGIN on
    // the occlusion-facing side only; the true outer edge stays a hard
    // cutoff (mask fully white right up to that edge, nothing beyond it).
    const gradId = `${clipId}-fade`;
    const fadeStart = innerSide === 'right' ? clipRight - FADE_MARGIN : clipLeft;
    const fadeEnd = innerSide === 'right' ? clipRight : clipLeft + FADE_MARGIN;
    const solidX = innerSide === 'right' ? clipLeft : fadeEnd;
    const solidWidth = innerSide === 'right' ? (fadeStart - clipLeft) : (clipRight - fadeEnd);
    const stops = innerSide === 'right'
      ? `<stop offset="0%" stop-color="white"/><stop offset="100%" stop-color="black"/>`
      : `<stop offset="0%" stop-color="black"/><stop offset="100%" stop-color="white"/>`;
    visibilityDefs = `
      <linearGradient id="${gradId}" x1="${fadeStart}" x2="${fadeEnd}" y1="0" y2="0" gradientUnits="userSpaceOnUse">
        ${stops}
      </linearGradient>
      <mask id="${clipId}">
        <rect x="${solidX}" y="0" width="${solidWidth}" height="${CANVAS}" fill="white"/>
        <rect x="${fadeStart}" y="0" width="${FADE_MARGIN}" height="${CANVAS}" fill="url(#${gradId})"/>
      </mask>`;
    visibilityAttr = `mask="url(#${clipId})"`;
  }

  const group = `
    ${visibilityDefs}
    <g ${visibilityAttr}>
      <g opacity="${opacity}">
        ${nameEls}
        ${dosageEl}
      </g>
      <g opacity="${purityOpacity}">
        ${purityEl}
      </g>
    </g>`;
  return { svg: group, mode: layout.mode };
}

async function generate({ name, dosage, purity, slugSuffix = '', outDir = OUT_DIR }) {
  const base = await sharp(TEMPLATE)
    .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
    .toBuffer();

  const vialIndices = [FRONT_VIAL_INDEX, ...BACKGROUND_VIAL_INDICES];
  const results = await Promise.all(
    vialIndices.map((vialIndex) =>
      vialLabelGroup({
        vialIndex, clipId: `vial-clip-${vialIndex}`, name, dosage, purity,
        opacity: vialIndex === FRONT_VIAL_INDEX ? 1 : BACKGROUND_OPACITY,
      })
    )
  );
  const groups = results.map((r) => r.svg).join('\n');
  const frontMode = results[0].mode;

  const compositeSvg = Buffer.from(`<svg width="${CANVAS}" height="${CANVAS}">${groups}</svg>`);

  const slug = slugify(name, dosage) + slugSuffix;
  const outPath = path.join(outDir, slug + '.webp');
  await sharp(base)
    .composite([{ input: compositeSvg }])
    .webp({ quality: 92 })
    .toFile(outPath);

  const mode = dosage ? frontMode : `${frontMode}+no-dosage-box`;
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
