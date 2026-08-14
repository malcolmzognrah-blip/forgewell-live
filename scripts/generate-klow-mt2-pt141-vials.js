// One-off: KLOW is a brand-new vial product; MT-2 and PT-141 are existing
// rows being converted from non-sellable ($0, dosage='vial') to real
// sellable products, so their images (generated back when dosage was the
// placeholder, no dosage box) are now stale against the real dosage and
// need regenerating in place -- same pattern as every other
// dosage-fill-then-regenerate batch this session.
//
// Usage: node generate-klow-mt2-pt141-vials.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-dosage-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');

const TARGETS = [
  { id: 'klow',   name: 'KLOW',   dosage: '80mg' },
  { id: 'mt-2',   name: 'MT-2',   dosage: '10mg' },
  { id: 'pt-141', name: 'PT-141', dosage: '10mg' },
];
const PURITY = '00';

async function main() {
  for (const t of TARGETS) {
    const result = await generate({ name: t.name, dosage: t.dosage, purity: PURITY, slugSuffix: '-tpl' });
    const naturalWebp = result.outPath;
    const targetWebp = path.join(OUT_DIR, `${t.id}-tpl.webp`);

    if (path.resolve(naturalWebp) !== path.resolve(targetWebp)) {
      fs.renameSync(naturalWebp, targetWebp);
      console.log(`RENAMED ${path.basename(naturalWebp)} -> ${path.basename(targetWebp)}  (mode: ${result.mode})`);
    } else {
      console.log(`OK      ${path.basename(targetWebp)}  (mode: ${result.mode})`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
