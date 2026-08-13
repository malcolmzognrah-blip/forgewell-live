// One-off scoped run for the 10 new dosage-tier products added this
// session. Not a general-purpose tool -- generate-dosage-images.js's own
// slugify(name, dosage) doesn't always match a row's DB `id` (it's derived
// independently from the product name, same as every existing product's
// image_path already is -- e.g. bpc-tb500-mix-low's own image is
// "bpc-tb-500-mix-low-tpl.webp", not "bpc-tb500-mix-low-tpl.webp"), so this
// generates each one, then renames the output to the exact image_path
// already confirmed in the database rather than trusting the natural slug.
//
// Usage: node generate-new-tiers.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-dosage-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');

// name is the DB `name` field with its trailing "(...)" annotation
// stripped, same convention batch-generate-catalog.js already uses --
// dosage is drawn separately in its own box, so it shouldn't also appear
// inside the name text.
const TARGETS = [
  { name: 'BPC/TB-500 Mix', dosage: '10mg/10mg', purity: '00', targetImagePath: 'images/bpc-tb500-mix-10mg-tpl.png' },
  { name: 'DSIP',           dosage: '10mg',      purity: '00', targetImagePath: 'images/dsip-10mg-tpl.png' },
  { name: 'GHK-Cu',         dosage: '100mg',     purity: '00', targetImagePath: 'images/ghk-cu-100mg-tpl.png' },
  { name: 'L-Carnitine',    dosage: '400mg',     purity: '00', targetImagePath: 'images/l-carnitine-400mg-tpl.png' },
  { name: 'Retatrutide',    dosage: '20mg',      purity: '00', targetImagePath: 'images/retatrutide-20mg-tpl.png' },
  { name: 'Retatrutide',    dosage: '30mg',      purity: '00', targetImagePath: 'images/retatrutide-30mg-tpl.png' },
  { name: 'Retatrutide',    dosage: '50mg',      purity: '00', targetImagePath: 'images/retatrutide-50mg-tpl.png' },
  { name: 'Tesamorelin',    dosage: '10mg',      purity: '00', targetImagePath: 'images/tesamorelin-10mg-tpl.png' },
  { name: 'Tirzepatide',    dosage: '20mg',      purity: '00', targetImagePath: 'images/tirzepatide-20mg-tpl.png' },
  { name: 'Tirzepatide',    dosage: '30mg',      purity: '00', targetImagePath: 'images/tirzepatide-30mg-tpl.png' },
];

async function main() {
  for (const t of TARGETS) {
    const result = await generate({ name: t.name, dosage: t.dosage, purity: t.purity, slugSuffix: '-tpl' });
    const naturalWebp = result.outPath; // e.g. images/retatrutide-20mg-tpl.webp
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
