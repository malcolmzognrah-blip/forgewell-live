// One-off scoped run for splitting TB-500 and Sermorelin from a single
// undifferentiated "vial" row each into real 5mg/10mg tiers. Their
// existing images never had a dosage box at all (old dosage was the
// generic placeholder "vial", which the generator treats as "no real
// dosage" and omits the box) -- now that they have a real 5mg value, the
// existing images need regenerating in place, not just their DB row
// relabeled. The two new 10mg rows need fresh images.
//
// Usage: node generate-sermorelin-tb500-tiers.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-dosage-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');

const TARGETS = [
  { name: 'TB-500',     dosage: '5mg',  purity: '00', targetImagePath: 'images/tb-500-tpl.png' },
  { name: 'TB-500',     dosage: '10mg', purity: '00', targetImagePath: 'images/tb-500-10mg-tpl.png' },
  { name: 'Sermorelin', dosage: '5mg',  purity: '00', targetImagePath: 'images/sermorelin-tpl.png' },
  { name: 'Sermorelin', dosage: '10mg', purity: '00', targetImagePath: 'images/sermorelin-10mg-tpl.png' },
];

async function main() {
  for (const t of TARGETS) {
    const result = await generate({ name: t.name, dosage: t.dosage, purity: t.purity, slugSuffix: '-tpl' });
    const naturalWebp = result.outPath;
    const targetWebp = path.join(OUT_DIR, path.basename(t.targetImagePath).replace(/\.png$/, '.webp'));

    if (path.resolve(naturalWebp) !== path.resolve(targetWebp)) {
      fs.renameSync(naturalWebp, targetWebp);
      console.log(`RENAMED ${path.basename(naturalWebp)} -> ${path.basename(targetWebp)}  (mode: ${result.mode})`);
    } else {
      console.log(`OK      ${path.basename(targetWebp)}  (mode: ${result.mode})`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
