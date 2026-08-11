// Analysis tool, not part of the generation pipeline: measures the actual
// usable text zone on images/_templates/universal-vial-template.png (or any
// template passed as an argument), the same way dosage-template-spec.md's
// original coordinates were derived -- render + measure real pixels, don't
// guess. Re-run this if the template image is ever replaced/updated, and
// feed the resulting numbers into generate-dosage-images.js's ZONE_TOP /
// ZONE_BOTTOM / USABLE_WIDTH constants.
//
// Usage:
//   node measure-template.js [path/to/template.png]

const sharp = require('sharp');
const path = require('path');

const TEMPLATE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'images', '_templates', 'universal-vial-template.png');
const CANVAS = 1600;

async function main() {
  const { data, info } = await sharp(TEMPLATE)
    .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, channels } = info;

  function getPixel(x, y) {
    const idx = (y * width + x) * channels;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }
  function isBg(rgb) {
    return Math.abs(rgb[0] - 247) < 6 && Math.abs(rgb[1] - 246) < 6 && Math.abs(rgb[2] - 250) < 6;
  }
  function rowAvg(y, xStart, xEnd) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let x = xStart; x <= xEnd; x++) {
      const [pr, pg, pb] = getPixel(x, y);
      r += pr; g += pg; b += pb; n++;
    }
    return [r / n, g / n, b / n];
  }
  function darkFraction(y, xStart, xEnd, threshold = 180) {
    let dark = 0, n = 0;
    for (let x = xStart; x <= xEnd; x++) {
      const [r, g, b] = getPixel(x, y);
      if ((r + g + b) / 3 < threshold) dark++;
      n++;
    }
    return dark / n;
  }

  // 1. Find where the green stripe ends / white label body begins, by
  // scanning row-average color (smooths out wordmark letter strokes that
  // make single-pixel sampling noisy) down through the header/stripe area.
  // Requires a SUSTAINED run of white rows (not just the first hit) --
  // there's a brief few-pixel-tall white/highlight gap between the navy
  // panel and the green stripe itself that a first-hit check would
  // mistake for the real transition, landing ~35px too early.
  console.log('--- Locating green-stripe -> white-body transition ---');
  const SUSTAIN_ROWS = 30;
  let zoneTop = null;
  for (let y = 700; y < 900; y++) {
    const [r, g, b] = rowAvg(y, 560, 1040);
    const isWhite = r > 230 && g > 230 && b > 230;
    if (isWhite) {
      let sustained = true;
      for (let k = 1; k <= SUSTAIN_ROWS; k++) {
        const [r2, g2, b2] = rowAvg(y + k, 560, 1040);
        if (!(r2 > 230 && g2 > 230 && b2 > 230)) { sustained = false; break; }
      }
      if (sustained) { zoneTop = y; break; }
    }
  }
  console.log(`  White label body begins at y=${zoneTop}`);

  // 2. Find where the (pre-baked, fixed) disclaimer text starts, by
  // scanning dark-pixel density through the lower label body.
  console.log('\n--- Locating disclaimer text start ---');
  let zoneBottom = null;
  for (let y = zoneTop + 50; y < 1500; y++) {
    if (darkFraction(y, 520, 1080) > 0.01) { zoneBottom = y; break; }
  }
  console.log(`  Disclaimer text begins at y=${zoneBottom}`);

  // 3. Usable label width, measured at the vertical midpoint of the
  // now-known blank zone.
  const midY = Math.round((zoneTop + zoneBottom) / 2);
  let left = null, right = null;
  for (let x = 0; x < width; x++) {
    const bg = isBg(getPixel(x, midY));
    if (!bg && left === null) left = x;
    if (!bg) right = x;
  }
  console.log(`\n--- Usable label width at y=${midY} ---`);
  console.log(`  left=${left} right=${right} width=${right - left}`);

  console.log('\n--- Summary (feed into generate-dosage-images.js) ---');
  console.log(`  ZONE_TOP    = ${zoneTop}`);
  console.log(`  ZONE_BOTTOM = ${zoneBottom}`);
  console.log(`  USABLE_WIDTH ~= ${right - left} minus a safety margin`);
}

main().catch((e) => { console.error(e); process.exit(1); });
