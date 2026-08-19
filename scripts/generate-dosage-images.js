// Composites product name, dosage, and (usually) purity onto the blank
// universal vial template (images/_templates/universal-vial-template.png)
// so any peptide/amino/kit product can reuse the same photo instead of
// needing its own. Replaces the old BPC-157-only template/path. Wordmark
// and disclaimer are pre-baked into the template (per its own fixed-element
// list), so this script only ever draws name, dosage, and purity.
//
// Requires the `sharp` package (not a site dependency -- this script is a
// standalone content tool, run manually per product/dosage tier):
//   npm install sharp
// Also requires "Quicksand" to be resolvable by fontconfig at the weight
// used below (this repo ships fonts/quicksand-variable.woff2 for the
// browser; for this script, install a Quicksand TTF -- static or variable --
// into ~/.local/share/fonts and run `fc-cache -f`).
//
// Usage:
//   node generate-dosage-images.js "BPC-157|10mg|99" "CJC-1295/Ipamorelin|High|97.5"
//   node generate-dosage-images.js "Cagrilintide|5mg"   (purity omitted -> '00',
//                                                         matching the products
//                                                         table's own default)
//   node generate-dosage-images.js "Bacteriostatic Water|30mL|"   (purity field
//                                                         present but EMPTY ->
//                                                         omits the purity line
//                                                         entirely, for products
//                                                         with no COA-derived
//                                                         purity data at all --
//                                                         distinct from omitting
//                                                         the field, which still
//                                                         defaults to '00')
// '|' rather than ':' -- at least one real product name contains a literal
// colon ("BCAA 2:1:1"), which would misparse as name/dosage/purity fields.
// Writes images/<slug>.webp per product given, and prints a
// productId -> image_path handoff table (the DB itself is outside this repo).
// No network/DB access here by design -- name/dosage/purity are supplied on
// the command line rather than fetched live from the API, so this stays a
// self-contained offline tool and doesn't need a product id (which isn't
// known until the handoff CSV is filled in afterward anyway).
//
// ---- How the layout numbers below were derived ----
// Measured directly against the actual template (see scripts/measure-template.js,
// a throwaway analysis script -- not part of the generation pipeline), not
// guessed or computed analytically:
//   - Green stripe -> white label body transition: y=778
//   - Disclaimer line 1 (pre-baked, fixed) starts: y=1226
//   -> usable vertical zone for dynamic text: y=778 to y=1226 (448px)
//   - Usable label width at its widest: x=494 to x=1109 (615px), centered x=800
// Single-line name position (yCenter=885, fontSize=120) is
// dosage-template-spec.md's own pre-existing calibrated value, confirmed
// still correct by test renders. Everything else (2-line position/size,
// the shrink-to-fit path, dosage/purity position when a name wraps) is new
// and was render-tested across the shortest and longest real names in the
// catalog before being treated as final -- see the test composites this
// was validated against.

const sharp = require('sharp');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'images', '_templates', 'universal-vial-template.png');
const OUT_DIR = path.join(__dirname, '..', 'images');
const CANVAS = 1600;
const TEXT_COLOR = 'rgb(10,22,64)';

const USABLE_WIDTH = 560; // 615px measured label width, minus ~55px safety padding
const ZONE_TOP = 778;     // measured: green stripe ends / white body begins
const ZONE_BOTTOM = 1226; // measured: disclaimer line 1 (fixed) starts

const NAME_SINGLE = { yCenter: 885, fontSize: 120 };
const NAME_TWO_LINE = { line1YCenter: 850, line2YCenter: 955, fontSize: 88 };
const DOSAGE_SINGLE = { yCenter: 1057, fontSize: 65 };
const DOSAGE_WRAPPED = { yCenter: 1075, fontSize: 58 };
// Anchored to the fixed disclaimer position (ZONE_BOTTOM=1226) rather than
// relative to dosage -- deliberately tight per explicit request to sit
// "just above/overlapping" the disclaimer, not the old accidental-overlap
// bug from a prior pass. Same position regardless of whether the name
// wrapped, since it's the disclaimer (fixed either way) it's anchored
// against, not the name. fontSize increased from 34->40 (measured: the
// disclaimer's own baked-in cap-height is ~28-29px; 34px purity already
// measured taller than that at 32px, but read as smaller/harder to read at
// weight 400 than the (bold) disclaimer, hence a further bump here) --
// yCenter was re-measured to preserve a small positive gap at the new size
// rather than reusing the old 1210 (see the render+measure note on
// measureTextMetrics below; a naive font-size bump at the same yCenter
// would have pushed the taller glyph past ZONE_BOTTOM into the disclaimer).
const PURITY = { yCenter: 1204, fontSize: 40, weight: 400 };
const DOSAGE_BOX_PAD_X = 26;
const DOSAGE_BOX_PAD_Y = 16;
const MIN_FONT_SIZE = 40;
const FONT_STEP = 4;

function textSvg({ text, yCenter, fontSize, color, weight = 700 }) {
  return `
    <svg width="${CANVAS}" height="${CANVAS}">
      <text x="800" y="${yCenter}" text-anchor="middle" dominant-baseline="central"
            font-family="Quicksand" font-weight="${weight}" font-size="${fontSize}"
            fill="${color}">${text}</text>
    </svg>`;
}

// Same as textSvg, plus a rounded-rect border sized to the text's own
// measured bounding box (not the nominal yCenter/fontSize) so it actually
// hugs the glyph. dominant-baseline="central" centers on the font's
// ascent/descent box, not the visual glyph ink -- for caps/digits with no
// descenders that renders visibly ABOVE the given yCenter (confirmed by
// measurement: ~30px high at fontSize 85, ~9px at fontSize 34, scaling with
// size), so a box built from the nominal yCenter alone ends up with extra
// slack below the text and the text reading as "not centered" in its box.
// boxCenterYOffset is that measured discrepancy, applied here so the box
// wraps where the glyph actually is.
function boxedTextSvg({ text, yCenter, fontSize, color, weight = 700, textWidth, textHeight, boxCenterYOffset }) {
  const boxW = textWidth + DOSAGE_BOX_PAD_X * 2;
  const boxH = textHeight + DOSAGE_BOX_PAD_Y * 2;
  const boxCenterY = yCenter + boxCenterYOffset;
  const boxX = 800 - boxW / 2;
  const boxY = boxCenterY - boxH / 2;
  return `
    <svg width="${CANVAS}" height="${CANVAS}">
      <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" ry="12"
            fill="none" stroke="${color}" stroke-width="3"/>
      <text x="800" y="${yCenter}" text-anchor="middle" dominant-baseline="central"
            font-family="Quicksand" font-weight="${weight}" font-size="${fontSize}"
            fill="${color}">${text}</text>
    </svg>`;
}

// Renders text at a fixed reference position (800,800) and measures its
// actual trimmed pixel bounding box -- real measurement, not a
// character-count estimate (a character count is what let an
// 11-character single word render wider than the label in an earlier
// pass) or an assumption that the glyph sits where dominant-baseline
// nominally puts it (it doesn't -- see boxedTextSvg above). Returns the
// glyph's width/height and how far its true center sits from wherever the
// text was actually asked to render, so callers can compensate.
async function measureTextMetrics(text, fontSize, weight = 700) {
  const buf = Buffer.from(textSvg({ text, yCenter: 800, fontSize, color: TEXT_COLOR, weight }));
  const { info } = await sharp(buf).trim().toBuffer({ resolveWithObject: true });
  const centerX = -info.trimOffsetLeft + info.width / 2;
  const centerY = -info.trimOffsetTop + info.height / 2;
  return { width: info.width, height: info.height, centerYOffset: centerY - 800, centerXOffset: centerX - 800 };
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

// Splits a name into two lines at a natural break point. Prefers '/' (keeps
// e.g. "CJC-1295/" with "Ipamorelin" reading as a clear pair), then the
// space nearest the midpoint. Returns null (not an array) if there's no
// natural break point at all -- a single long word needs shrinking, not an
// arbitrary mid-word split.
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

// Decides single-line vs. shrink vs. 2-line-wrap for a name, and returns
// the dosage/purity Y-shift to use alongside it. All decisions are driven
// by measured pixel widths against USABLE_WIDTH, not character counts.
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
    // No space/slash to break on (single long word) -- shrink instead of
    // an arbitrary mid-word split.
    const fitSize = await shrinkToFit(name, NAME_SINGLE.fontSize, USABLE_WIDTH);
    return {
      nameLines: [{ text: name, yCenter: NAME_SINGLE.yCenter, fontSize: fitSize }],
      dosage: DOSAGE_SINGLE,
      mode: `1-line-shrunk(${fitSize}px)`,
    };
  }

  // Natural break available -- 2 lines, shrinking both to a common size if
  // either is still too wide at the base 2-line font.
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
  // Same sanitization as the name part -- previously only whitespace was
  // stripped from dosage, which let a value like "High (exact size TBD)"
  // survive into the filename as "high(exactsizetbd)", parens and all.
  const dosagePart = dosage ? slugPart(dosage) : '';
  return dosagePart ? `${base}-${dosagePart}` : base;
}

function parseArg(arg) {
  const parts = arg.split('|');
  const name = parts[0];
  const dosage = parts[1] || '';
  // Omitting the purity field entirely (2 pipe-separated segments) keeps
  // the documented '00' default, unchanged for every existing product this
  // has already been run for. A THIRD segment that's explicitly empty
  // ("Name|Dosage|") means the caller is saying "this product has no
  // COA-derived purity data at all" -- purity: null, so generate() omits
  // the purity line from the image entirely rather than rendering a fake
  // placeholder value.
  const purity = parts.length >= 3 ? (parts[2] || null) : '00';
  return { name, dosage, purity };
}

async function generate({ name, dosage, purity, slugSuffix = '' }) {
  const base = await sharp(TEMPLATE)
    .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
    .toBuffer();

  const layout = await layoutName(name);

  const nameBufs = layout.nameLines.map((line) =>
    Buffer.from(textSvg({ text: line.text, yCenter: line.yCenter, fontSize: line.fontSize, color: TEXT_COLOR }))
  );

  // Empty dosage (caller's choice -- e.g. a generic, non-informative value
  // like "vial"/"pack" resolved to '' upstream) omits the box entirely
  // rather than drawing an empty or meaningless one.
  const dosageBufs = [];
  if (dosage) {
    const dosageText = dosage.toUpperCase();
    const dosageMetrics = await measureTextMetrics(dosageText, layout.dosage.fontSize);
    dosageBufs.push(Buffer.from(boxedTextSvg({
      text: dosageText, yCenter: layout.dosage.yCenter, fontSize: layout.dosage.fontSize,
      color: TEXT_COLOR, textWidth: dosageMetrics.width, textHeight: dosageMetrics.height,
      boxCenterYOffset: dosageMetrics.centerYOffset,
    })));
  }

  // Same "omit entirely rather than fake it" rule as the dosage box above --
  // purity: null (an explicitly-empty third CLI segment, or an object-call
  // caller passing null/'' directly) skips the line altogether instead of
  // rendering a placeholder "00% Purity" on a product with no COA-derived
  // purity data at all.
  const purityBuf = purity ? Buffer.from(textSvg({
    text: `${purity}% Purity`, yCenter: PURITY.yCenter, fontSize: PURITY.fontSize,
    color: TEXT_COLOR, weight: PURITY.weight,
  })) : null;

  // slugSuffix defaults to '' for the CLI/single-product path (unchanged,
  // clean names like "bpc-157-10mg"). Batch runs pass a real suffix so a
  // generated file can never collide with a product's current, already-live
  // image_path -- every product then needs an explicit DB update to go
  // live, never a silent one from a filename that happened to match.
  const slug = slugify(name, dosage) + slugSuffix;
  const outPath = path.join(OUT_DIR, slug + '.webp');
  await sharp(base)
    .composite([
      ...nameBufs.map((buf) => ({ input: buf })),
      ...dosageBufs.map((buf) => ({ input: buf })),
      ...(purityBuf ? [{ input: purityBuf }] : []),
    ])
    .webp({ quality: 92 })
    .toFile(outPath);

  let mode = dosage ? layout.mode : `${layout.mode}+no-dosage-box`;
  if (!purity) mode += '+no-purity';
  return { name, dosage, purity, mode, outPath, imagePathForDb: 'images/' + slug + '.png' };
}

async function main() {
  const args = process.argv.slice(2).map(parseArg);

  if (args.length === 0) {
    console.error('Usage: node generate-dosage-images.js "<name>|<dosage>[|<purity>]" [...]');
    process.exit(1);
  }

  const results = [];
  for (const arg of args) {
    results.push(await generate(arg));
  }

  console.log('\nGenerated files (set each product\'s image_path to the value shown):');
  for (const r of results) {
    const purityLabel = r.purity ? r.purity : '(omitted)';
    console.log(`  ${r.name.padEnd(24)} ${r.dosage.padEnd(6)} purity:${purityLabel.padEnd(9)} ${r.mode.padEnd(16)} ${r.outPath} -> image_path: ${r.imagePathForDb}`);
  }
}

// Guarded so this file can also be require()'d as a module (see
// batch-generate-catalog.js) without triggering CLI arg parsing.
if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { generate, slugify };
