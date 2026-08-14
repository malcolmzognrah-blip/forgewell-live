// One-off scoped run for the SS-31/Vilon dosage-tier split. Same pattern as
// generate-new-tiers.js: generate via the shared universal-template tool,
// then rename the output to the exact image_path this session's SQL plan
// uses, rather than trusting the natural slug.
//
// Usage: node generate-ss31-vilon-tiers.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-dosage-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');

const TARGETS = [
  { name: 'SS-31', dosage: '10mg', purity: '00', targetImagePath: 'images/ss-31-10mg-tpl.png' },
  { name: 'SS-31', dosage: '50mg', purity: '00', targetImagePath: 'images/ss-31-50mg-tpl.png' },
  { name: 'Vilon',  dosage: '10mg', purity: '00', targetImagePath: 'images/vilon-10mg-tpl.png' },
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
