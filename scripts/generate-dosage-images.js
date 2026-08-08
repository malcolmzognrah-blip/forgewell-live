// Composites a dosage number onto the blank BPC-157 template
// (images/_templates/bpc-157-template.png) so each dosage tier gets its own
// correct-looking photo instead of sharing one image. See
// dosage-template-spec.md for where these coordinates/colors come from.
//
// Requires the `sharp` package (not a site dependency -- this script is a
// standalone content tool, run manually when a new dosage tier is added):
//   npm install sharp
// Also requires "Quicksand" to be resolvable by fontconfig at the weight
// used below (this repo ships fonts/quicksand-variable.woff2 for the
// browser; for this script, install a Quicksand TTF -- static or variable --
// into ~/.local/share/fonts and run `fc-cache -f`).
//
// Usage:
//   node generate-dosage-images.js 10mg 20mg
// Writes images/bpc-157-<dosage>.webp for each dosage given, and prints a
// productId -> image_path handoff table (the DB itself is outside this repo).

const sharp = require('sharp');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'images', '_templates', 'bpc-157-template.png');
const OUT_DIR = path.join(__dirname, '..', 'images');
const CANVAS = 1600;

// Spec coordinates (dosage-template-spec.md), centered at x=800 on a 1600x1600 canvas.
const DOSAGE = { yCenter: 1057, fontSize: 85, color: 'rgb(10,22,64)' };

function textSvg({ text, yCenter, fontSize, color }) {
  return `
    <svg width="${CANVAS}" height="${CANVAS}">
      <text x="800" y="${yCenter}" text-anchor="middle" dominant-baseline="central"
            font-family="Quicksand" font-weight="700" font-size="${fontSize}"
            fill="${color}">${text}</text>
    </svg>`;
}

function slugify(dosage) {
  return 'bpc-157-' + dosage.toLowerCase().replace(/\s+/g, '');
}

async function generate(dosage) {
  const base = await sharp(TEMPLATE)
    .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
    .toBuffer();

  const dosageBuf = Buffer.from(textSvg({ text: dosage, ...DOSAGE }));

  const slug = slugify(dosage);
  const outPath = path.join(OUT_DIR, slug + '.webp');
  await sharp(base)
    .composite([{ input: dosageBuf }])
    .webp({ quality: 92 })
    .toFile(outPath);

  return { dosage, outPath, imagePathForDb: 'images/' + slug + '.png' };
}

async function main() {
  const dosages = process.argv.slice(2);

  if (dosages.length === 0) {
    console.error('Usage: node generate-dosage-images.js <dosage> [<dosage> ...]');
    process.exit(1);
  }

  const results = [];
  for (const dosage of dosages) {
    results.push(await generate(dosage));
  }

  console.log('\nGenerated files (set each product\'s image_path to the value shown):');
  for (const r of results) {
    console.log(`  ${r.dosage.padEnd(8)} ${r.outPath} -> image_path: ${r.imagePathForDb}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
