// One-off scoped run: regenerates the 18 products whose images were
// composited back when their DB dosage was still the 'vial' placeholder
// (generate-dosage-images.js's generate() omits the dosage box entirely
// for a non-real dosage like that), left stale after a later pass filled
// in their real dosage values in the DB without regenerating the image to
// match. Same pattern as generate-new-tiers.js / generate-ss31-vilon-tiers.js,
// except none of these need an id/image_path rename -- every one of these
// products is single-tier, so its image_path was already "images/<id>-tpl.png"
// with no dosage in the filename, and stays that way; only the file
// content changes.
//
// Usage: node regenerate-stale-dosage-images.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-dosage-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');

const TARGETS = [
  { id: '5-amino-1mq',    name: '5-Amino-1MQ',    dosage: '50mg' },
  { id: 'cagrilintide',   name: 'Cagrilintide',   dosage: '10mg' },
  { id: 'chonluten',      name: 'Chonluten',      dosage: '10mg' },
  { id: 'crystagen',      name: 'Crystagen',      dosage: '10mg' },
  { id: 'epithalon',      name: 'Epithalon',      dosage: '10mg' },
  { id: 'ghrp-2',         name: 'GHRP-2',         dosage: '10mg' },
  { id: 'glow-pro-blend', name: 'Glow Pro Blend', dosage: '50mg/10mg/10mg' },
  { id: 'hexarelin',      name: 'Hexarelin',      dosage: '5mg' },
  { id: 'igf1-lr3',       name: 'IGF1-LR3',       dosage: '1mg' },
  { id: 'kisspeptin',     name: 'Kisspeptin',     dosage: '10mg' },
  { id: 'll-37',          name: 'LL-37',          dosage: '5mg' },
  { id: 'mt-1',           name: 'MT-1',           dosage: '10mg' },
  { id: 'ovagen',         name: 'Ovagen',         dosage: '20mg' },
  { id: 'pancragen',      name: 'Pancragen',      dosage: '15mg' },
  { id: 'pnc-27',         name: 'PNC-27',         dosage: '5mg' },
  { id: 'snap-8',         name: 'SNAP-8',         dosage: '10mg' },
  { id: 'thymalin',       name: 'Thymalin',       dosage: '10mg' },
  { id: 'vesugen',        name: 'Vesugen',        dosage: '20mg' },
];
const PURITY = '00'; // confirmed current DB value for all 18, not guessed

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
