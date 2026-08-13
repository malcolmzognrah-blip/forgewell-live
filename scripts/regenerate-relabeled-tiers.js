// One-off scoped run for the 25 products relabeled from Low/High
// placeholders to real Apex-sheet dosages this session. Their `dosage`
// column changed, but their images were never regenerated -- they still
// show the old "LOW"/"HIGH" text baked into the vial photo. This
// regenerates each one with its real current dosage, then renames the
// output to overwrite the EXACT existing image_path already in the
// database (unchanged filenames -- only the picture content refreshes,
// same as generate-new-tiers.js's approach of not trusting the natural
// slug to already match).
//
// Usage: node regenerate-relabeled-tiers.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-dosage-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');

// name is the DB `name` field with its trailing "(...)" annotation
// stripped (dosage is drawn separately in its own box already).
const TARGETS = [
  { name: 'BPC/TB-500 Mix',      dosage: '5mg/5mg',   purity: '00', targetImagePath: 'images/bpc-tb-500-mix-low-tpl.png' },
  { name: 'BPC/TB-500 Mix',      dosage: '20mg/20mg',  purity: '00', targetImagePath: 'images/bpc-tb-500-mix-high-tpl.png' },
  { name: 'CJC-1295/Ipamorelin', dosage: '5mg/5mg',   purity: '00', targetImagePath: 'images/cjc-1295-ipamorelin-low-tpl.png' },
  { name: 'CJC-1295/Ipamorelin', dosage: '10mg/10mg',  purity: '00', targetImagePath: 'images/cjc-1295-ipamorelin-high-tpl.png' },
  { name: 'DSIP',                dosage: '5mg',        purity: '00', targetImagePath: 'images/dsip-low-tpl.png' },
  { name: 'DSIP',                dosage: '15mg',       purity: '00', targetImagePath: 'images/dsip-high-tpl.png' },
  { name: 'GHK-Cu',              dosage: '50mg',       purity: '00', targetImagePath: 'images/ghk-cu-low-tpl.png' },
  { name: 'GHK-Cu',              dosage: '200mg',      purity: '00', targetImagePath: 'images/ghk-cu-high-tpl.png' },
  { name: 'Ipamorelin',          dosage: '5mg',        purity: '00', targetImagePath: 'images/ipamorelin-low-tpl.png' },
  { name: 'Ipamorelin',          dosage: '10mg',       purity: '00', targetImagePath: 'images/ipamorelin-high-tpl.png' },
  { name: 'KPV',                 dosage: '10mg',       purity: '00', targetImagePath: 'images/kpv-low-tpl.png' },
  { name: 'L-Carnitine',         dosage: '200mg',      purity: '00', targetImagePath: 'images/l-carnitine-low-tpl.png' },
  { name: 'L-Carnitine',         dosage: '600mg',      purity: '00', targetImagePath: 'images/l-carnitine-high-tpl.png' },
  { name: 'MOTS-C',              dosage: '10mg',       purity: '00', targetImagePath: 'images/mots-c-low-tpl.png' },
  { name: 'MOTS-C',              dosage: '40mg',       purity: '00', targetImagePath: 'images/mots-c-high-tpl.png' },
  { name: 'Retatrutide',         dosage: '10mg',       purity: '00', targetImagePath: 'images/retatrutide-low-tpl.png' },
  { name: 'Retatrutide',         dosage: '100mg',      purity: '00', targetImagePath: 'images/retatrutide-high-tpl.png' },
  { name: 'Semax/Selank',        dosage: '5mg/5mg',   purity: '00', targetImagePath: 'images/semax-selank-low-tpl.png' },
  { name: 'Semax/Selank',        dosage: '10mg/10mg',  purity: '00', targetImagePath: 'images/semax-selank-high-tpl.png' },
  { name: 'Tesamorelin',         dosage: '5mg',        purity: '00', targetImagePath: 'images/tesamorelin-low-tpl.png' },
  { name: 'Tesamorelin',         dosage: '20mg',       purity: '00', targetImagePath: 'images/tesamorelin-high-tpl.png' },
  { name: 'Tirzepatide',         dosage: '10mg',       purity: '00', targetImagePath: 'images/tirzepatide-low-tpl.png' },
  { name: 'Tirzepatide',         dosage: '60mg',       purity: '00', targetImagePath: 'images/tirzepatide-high-tpl.png' },
  { name: 'VIP',                 dosage: '5mg',        purity: '00', targetImagePath: 'images/vip-low-tpl.png' },
  { name: 'VIP',                 dosage: '10mg',       purity: '00', targetImagePath: 'images/vip-high-tpl.png' },
];

async function main() {
  for (const t of TARGETS) {
    const result = await generate({ name: t.name, dosage: t.dosage, purity: t.purity, slugSuffix: '-tpl' });
    const naturalWebp = result.outPath;
    const targetWebp = path.join(OUT_DIR, path.basename(t.targetImagePath).replace(/\.png$/, '.webp'));

    if (path.resolve(naturalWebp) !== path.resolve(targetWebp)) {
      fs.renameSync(naturalWebp, targetWebp);
      console.log(`REGENERATED ${path.basename(targetWebp)}  (mode: ${result.mode})`);
    } else {
      console.log(`OK          ${path.basename(targetWebp)}  (mode: ${result.mode})`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
