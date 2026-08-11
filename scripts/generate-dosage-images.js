// Composites a dosage number (and, optionally, a purity percentage) onto
// the blank BPC-157 template (images/_templates/bpc-157-template.png) so
// each dosage tier gets its own correct-looking photo instead of sharing
// one image. See dosage-template-spec.md for where the dosage row's
// coordinates/colors come from.
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
//   node generate-dosage-images.js 10mg:98.5 20mg:97.2
//   node generate-dosage-images.js 10mg 20mg          (purity omitted -> '00',
//                                                       matching the products
//                                                       table's own default)
// Writes images/bpc-157-<dosage>.webp for each dosage given, and prints a
// productId -> image_path handoff table (the DB itself is outside this repo).
// No network/DB access here by design -- purity is supplied on the command
// line, same as dosage, rather than fetched live from the API, so this stays
// a self-contained offline tool and doesn't need a product id (which isn't
// known until the handoff CSV is filled in afterward anyway).

const sharp = require('sharp');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'images', '_templates', 'bpc-157-template.png');
const OUT_DIR = path.join(__dirname, '..', 'images');
const CANVAS = 1600;

// Spec coordinates (dosage-template-spec.md), centered at x=800 on a 1600x1600 canvas.
const DOSAGE = { yCenter: 1057, fontSize: 85, color: 'rgb(10,22,64)' };

// NOT in dosage-template-spec.md's calibrated table -- that doc only covers
// wordmark/name/dosage/disclaimer. This sits in the ~180px gap between the
// dosage row (yCenter 1057) and the disclaimer rows (yCenter 1238/1278).
// Per the spec doc's own methodology, yCenter isn't the visual center
// (dominant-baseline="central" centers on the font's ascent/descent box,
// not the glyph ink) and every other row was calibrated by rendering a
// test composite and measuring pixels, not computed analytically. THIS
// VALUE IS AN UNCALIBRATED ESTIMATE -- generate a test composite and
// visually check/adjust before treating it as final.
const PURITY = { yCenter: 1150, fontSize: 55, color: 'rgb(10,22,64)' };

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

function parseArg(arg) {
  const [dosage, purity] = arg.split(':');
  return { dosage, purity: purity || '00' };
}

async function generate({ dosage, purity }) {
  const base = await sharp(TEMPLATE)
    .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
    .toBuffer();

  const dosageBuf = Buffer.from(textSvg({ text: dosage, ...DOSAGE }));
  const purityBuf = Buffer.from(textSvg({ text: `Purity: ${purity}%`, ...PURITY }));

  const slug = slugify(dosage);
  const outPath = path.join(OUT_DIR, slug + '.webp');
  await sharp(base)
    .composite([{ input: dosageBuf }, { input: purityBuf }])
    .webp({ quality: 92 })
    .toFile(outPath);

  return { dosage, purity, outPath, imagePathForDb: 'images/' + slug + '.png' };
}

async function main() {
  const args = process.argv.slice(2).map(parseArg);

  if (args.length === 0) {
    console.error('Usage: node generate-dosage-images.js <dosage>[:<purity>] [<dosage>[:<purity>] ...]');
    process.exit(1);
  }

  const results = [];
  for (const arg of args) {
    results.push(await generate(arg));
  }

  console.log('\nGenerated files (set each product\'s image_path to the value shown):');
  for (const r of results) {
    console.log(`  ${r.dosage.padEnd(8)} purity:${r.purity.padEnd(6)} ${r.outPath} -> image_path: ${r.imagePathForDb}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
