// One-off scoped run: sets purity to 99 (image-generation only -- this never
// writes to the database, see below) for every peptide/amino/kit product
// that doesn't already have real COA-derived data. As of this run, no
// product has spec_has_coa=true or a real PDF in coa/, and product_specs
// data is a flat, unpopulated "99%"/null default across the whole catalog
// -- so "doesn't already have COA data" resolves to products.purity=='00'
// (the DB's own placeholder, confirmed via generate-dosage-images.js's own
// default), which is true for all but one product (bpc-157-10mg, already
// '99'). Essentials are excluded entirely (no purity overlay, per
// batch-generate-catalog.js) and are NOT touched here, including in the DB
// -- confirmed scope, not just an image-generation side effect.
//
// Same pattern as batch-generate-catalog.js: fetches the live catalog
// read-only, generates images with slugSuffix '-tpl' so nothing collides
// with a currently-live image_path, and writes a handoff CSV for review --
// nothing is written to the database. Apply purity=99 and the new
// image_path via psql yourself after reviewing the CSV.
//
// Usage: node regenerate-purity-99-batch.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-dosage-images.js');

const CATALOG_URL = 'https://forgewellpeptide.com/api/products';
const CSV_PATH = path.join(__dirname, '..', 'purity-99-handoff.csv');
const SLUG_SUFFIX = '-tpl';
const NEW_PURITY = '99';

// Same convention as batch-generate-catalog.js.
function stripTrailingAnnotation(name) {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const GENERIC_DOSAGE_VALUES = new Set(['vial', 'pack']);
function resolveDosage(rawDosage) {
  const stripped = stripTrailingAnnotation(rawDosage || '');
  if (GENERIC_DOSAGE_VALUES.has(stripped.toLowerCase())) return '';
  return stripped;
}

async function main() {
  console.log('Fetching live catalog from', CATALOG_URL, '...');
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`Catalog fetch failed: HTTP ${res.status}`);
  const products = await res.json();

  const targets = products.filter((p) => p.category !== 'essential' && p.purity === '00');
  console.log(`${products.length} total products, ${targets.length} targeted (purity=='00', non-essential).\n`);

  const rows = [];
  let failCount = 0;
  for (const p of targets) {
    const name = stripTrailingAnnotation(p.name);
    const dosage = resolveDosage(p.dosage);
    try {
      const result = await generate({ name, dosage, purity: NEW_PURITY, slugSuffix: SLUG_SUFFIX });
      if (result.imagePathForDb === (p.image_path || '')) {
        throw new Error(`generated path still collides with current image_path (${p.image_path}) despite SLUG_SUFFIX`);
      }
      rows.push({
        product_id: p.id,
        name,
        dosage_raw: p.dosage || '',
        dosage,
        old_purity: p.purity,
        new_purity: NEW_PURITY,
        current_image_path: p.image_path || '',
        generated_file: result.outPath,
        image_path_to_set: result.imagePathForDb,
        mode: result.mode,
      });
      console.log(`OK   ${p.id.padEnd(38)} ${result.mode.padEnd(16)} -> ${result.imagePathForDb}`);
    } catch (err) {
      failCount++;
      console.error(`FAIL ${p.id.padEnd(38)} ${err.message}`);
    }
  }

  const header = 'product_id,name,dosage_raw,dosage_used,old_purity,new_purity,current_image_path,generated_file,image_path_to_set';
  const lines = [header, ...rows.map((r) => [
    r.product_id, r.name, r.dosage_raw, r.dosage, r.old_purity, r.new_purity, r.current_image_path, r.generated_file, r.image_path_to_set,
  ].map(csvEscape).join(','))];
  fs.writeFileSync(CSV_PATH, lines.join('\n') + '\n');

  console.log(`\nDone: ${rows.length} generated, ${failCount} failed.`);
  console.log(`Handoff CSV written to ${CSV_PATH}`);
  console.log('Nothing was written to the database -- review the CSV and apply purity=99 and image_path via psql yourself.');
}

main().catch((e) => { console.error(e); process.exit(1); });
