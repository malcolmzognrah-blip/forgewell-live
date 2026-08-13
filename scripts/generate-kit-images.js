// Composites kit name, dosage, and purity onto the kit-specific template
// (images/_templates/kit-template.png -- a 5-vial group shot where only the
// front-center vial's label is clean/legible, everything else is
// obstructed or blurred by the other vials in frame). Same overall
// approach as generate-dosage-images.js (render + measure, don't guess),
// duplicated here rather than sharing code because the template's
// composition is fundamentally different from the single-vial template --
// the label zone sits on one vial within a group shot, not an isolated
// vial, so the automatic width-scan in measure-template.js doesn't work
// here (it picks up the neighboring vials' label edges too). Zone
// geometry below was determined by test-rendering a visible guide box
// over the template and adjusting until it landed cleanly within the
// center vial's clean label area, not by that automatic scan.
//
// Pack size is deliberately NOT drawn on the image -- an individual vial
// within a 5-pack or 10-pack box would carry the same label as the
// standalone vial of that dosage; pack quantity is a property of the box,
// not each vial. The same generated image is reused verbatim for both the
// 5-Pack and 10-Pack row of a given dosage tier.
//
// Usage:
//   node generate-kit-images.js "BPC-157 Kit|10mg|99"
//   node generate-kit-images.js "CJC/IPA Blend Kit|10mg/10mg"   (purity omitted -> '00')

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

function textSvg({ text, yCenter, fontSize, color, weight = 700 }) {
  return `
    <svg width="${CANVAS}" height="${CANVAS}">
      <text x="800" y="${yCenter}" text-anchor="middle" dominant-baseline="central"
            font-family="Quicksand" font-weight="${weight}" font-size="${fontSize}"
            fill="${color}">${text}</text>
    </svg>`;
}

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

async function generate({ name, dosage, purity, slugSuffix = '' }) {
  const base = await sharp(TEMPLATE)
    .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
    .toBuffer();

  const layout = await layoutName(name);

  const nameBufs = layout.nameLines.map((line) =>
    Buffer.from(textSvg({ text: line.text, yCenter: line.yCenter, fontSize: line.fontSize, color: TEXT_COLOR }))
  );

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

  const purityBuf = Buffer.from(textSvg({
    text: `${purity}% Purity`, yCenter: PURITY.yCenter, fontSize: PURITY.fontSize,
    color: TEXT_COLOR, weight: PURITY.weight,
  }));

  const slug = slugify(name, dosage) + slugSuffix;
  const outPath = path.join(OUT_DIR, slug + '.webp');
  await sharp(base)
    .composite([
      ...nameBufs.map((buf) => ({ input: buf })),
      ...dosageBufs.map((buf) => ({ input: buf })),
      { input: purityBuf },
    ])
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
