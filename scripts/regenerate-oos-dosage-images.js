// One-off scoped run: generates real dosage images for the 11 out-of-stock
// products whose dosage was just set for the first time (previously 'vial'
// -- these were never part of the earlier 18-product dosage-fill batch, so
// this isn't a stale-image fix, just filling in art for genuinely new data).
// Same pattern as regenerate-stale-dosage-images.js -- none of these need
// an id/image_path rename, every one is single-tier with image_path already
// "images/<id>-tpl.png".
//
// Usage: node regenerate-oos-dosage-images.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-dosage-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');

const TARGETS = [
  { id: 'adamax',      name: 'Adamax',      dosage: '10mg' },
  { id: 'ara-290',     name: 'ARA-290',     dosage: '10mg' },
  { id: 'bronchogen',  name: 'Bronchogen',  dosage: '20mg' },
  { id: 'cartalax',    name: 'Cartalax',    dosage: '20mg' },
  { id: 'cortagen',    name: 'Cortagen',    dosage: '10mg' },
  { id: 'ghrp-6',      name: 'GHRP-6',      dosage: '10mg' },
  { id: 'livagen',     name: 'Livagen',     dosage: '20mg' },
  { id: 'pinealon',    name: 'Pinealon',    dosage: '20mg' },
  { id: 'prostamax',   name: 'Prostamax',   dosage: '10mg' },
  { id: 'survodutide', name: 'Survodutide', dosage: '10mg' },
  { id: 'testagen',    name: 'Testagen',    dosage: '20mg' },
];
const PURITY = '00'; // confirmed current DB value for all 11, not guessed

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
