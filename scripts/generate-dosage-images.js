// Composites product name, dosage, and purity onto the blank universal vial
// template (images/_templates/universal-vial-template.png) so any
// peptide/amino/kit product can reuse the same photo instead of needing its
// own. Replaces the old BPC-157-only template/path. Wordmark and disclaimer
// are pre-baked into the template (per its own fixed-element list), so this
// script only ever draws name, dosage, and purity.
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
//   node generate-dosage-images.js "BPC-157:10mg:99" "CJC-1295/Ipamorelin:High:97.5"
//   node generate-dosage-images.js "Cagrilintide:5mg"   (purity omitted -> '00',
//                                                         matching the products
//                                                         table's own default)
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
const DOSAGE_SINGLE = { yCenter: 1057, fontSize: 85 };
const DOSAGE_WRAPPED = { yCenter: 1075, fontSize: 75 };
// Anchored to the fixed disclaimer position (ZONE_BOTTOM=1226) rather than
// relative to dosage -- deliberately tight (~2px clearance) per explicit
// request to sit "just above/overlapping" the disclaimer, not the old
// accidental-overlap bug from a prior pass. Same position regardless of
// whether the name wrapped, since it's the disclaimer (fixed either way)
// it's anchored against, not the name.
const PURITY = { yCenter: 1210, fontSize: 34, weight: 400 };
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

// Same as textSvg, plus a centered rounded-rect border sized to the text's
// own measured width (not a fixed box) so it hugs "10MG" as snugly as
// "5000IU" or "HIGH" without needing a per-value box size.
function boxedTextSvg({ text, yCenter, fontSize, color, weight = 700, textWidth }) {
  const boxW = textWidth + DOSAGE_BOX_PAD_X * 2;
  const boxH = fontSize + DOSAGE_BOX_PAD_Y * 2;
  const boxX = 800 - boxW / 2;
  const boxY = yCenter - boxH / 2;
  return `
    <svg width="${CANVAS}" height="${CANVAS}">
      <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" ry="12"
            fill="none" stroke="${color}" stroke-width="3"/>
      <text x="800" y="${yCenter}" text-anchor="middle" dominant-baseline="central"
            font-family="Quicksand" font-weight="${weight}" font-size="${fontSize}"
            fill="${color}">${text}</text>
    </svg>`;
}

// Renders text off-canvas-position and measures its actual trimmed pixel
// width -- real measurement, not a character-count estimate (a character
// count is what let an 11-character single word render wider than the
// label in an earlier pass).
async function measureTextWidth(text, fontSize) {
  const buf = Buffer.from(textSvg({ text, yCenter: 800, fontSize, color: TEXT_COLOR }));
  const { info } = await sharp(buf).trim().toBuffer({ resolveWithObject: true });
  return info.width;
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

function slugify(name, dosage) {
  const base = name
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const dosagePart = (dosage || '').toLowerCase().replace(/\s+/g, '');
  return dosagePart ? `${base}-${dosagePart}` : base;
}

function parseArg(arg) {
  const [name, dosage, purity] = arg.split(':');
  return { name, dosage: dosage || '', purity: purity || '00' };
}

async function generate({ name, dosage, purity }) {
  const base = await sharp(TEMPLATE)
    .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
    .toBuffer();

  const layout = await layoutName(name);

  const nameBufs = layout.nameLines.map((line) =>
    Buffer.from(textSvg({ text: line.text, yCenter: line.yCenter, fontSize: line.fontSize, color: TEXT_COLOR }))
  );

  const dosageText = dosage.toUpperCase();
  const dosageWidth = await measureTextWidth(dosageText, layout.dosage.fontSize);
  const dosageBuf = Buffer.from(boxedTextSvg({
    text: dosageText, yCenter: layout.dosage.yCenter, fontSize: layout.dosage.fontSize,
    color: TEXT_COLOR, textWidth: dosageWidth,
  }));

  const purityBuf = Buffer.from(textSvg({
    text: `${purity}% Purity`, yCenter: PURITY.yCenter, fontSize: PURITY.fontSize,
    color: TEXT_COLOR, weight: PURITY.weight,
  }));

  const slug = slugify(name, dosage);
  const outPath = path.join(OUT_DIR, slug + '.webp');
  await sharp(base)
    .composite([...nameBufs.map((buf) => ({ input: buf })), { input: dosageBuf }, { input: purityBuf }])
    .webp({ quality: 92 })
    .toFile(outPath);

  return { name, dosage, purity, mode: layout.mode, outPath, imagePathForDb: 'images/' + slug + '.png' };
}

async function main() {
  const args = process.argv.slice(2).map(parseArg);

  if (args.length === 0) {
    console.error('Usage: node generate-dosage-images.js "<name>:<dosage>[:<purity>]" [...]');
    process.exit(1);
  }

  const results = [];
  for (const arg of args) {
    results.push(await generate(arg));
  }

  console.log('\nGenerated files (set each product\'s image_path to the value shown):');
  for (const r of results) {
    console.log(`  ${r.name.padEnd(24)} ${r.dosage.padEnd(6)} purity:${r.purity.padEnd(6)} ${r.mode.padEnd(16)} ${r.outPath} -> image_path: ${r.imagePathForDb}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
