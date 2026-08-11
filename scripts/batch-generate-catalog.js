// Generates a universal-template vial image for every peptide/amino/kit
// product in the live catalog (essentials excluded -- different packaging,
// per CLAUDE.md). Fetches the real catalog directly (read-only -- this
// never writes to the database, matching how every other step of this
// feature was applied: generate here, hand off, apply via psql yourself).
//
// Usage:
//   node batch-generate-catalog.js
// Writes images/<slug>.webp per product, and a full handoff CSV
// (dosage-image-handoff.csv) with every product's real id, name, dosage,
// purity used, and the image_path to set -- for review before you apply
// those UPDATE statements yourself.

const fs = require('fs');
const path = require('path');
const { generate, slugify } = require('./generate-dosage-images.js');

const CATALOG_URL = 'https://forgewellpeptide.com/api/products';
const EXCLUDED_CATEGORIES = ['essential'];
const CSV_PATH = path.join(__dirname, '..', 'dosage-image-handoff.csv');
// Forces every generated filename to differ from whatever's already live --
// some products' natural slug happened to exactly match their current,
// already-live image_path, which would silently swap their live photo the
// moment this is deployed, with no database update at all. This guarantees
// all 123 need an explicit image_path UPDATE from the reviewer, uniformly,
// no exceptions.
const SLUG_SUFFIX = '-tpl';

// Same convention already used by product.html for the on-page display
// name (strips a trailing "(...)" annotation like "(10mg)"/"(High)" --
// dosage is rendered separately from the same product's own dosage field,
// so it shouldn't also appear inside the name).
function stripTrailingAnnotation(name) {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// The real dosage field is messier than the hand-picked test cases covered:
// values like "High (exact size TBD)" are internal placeholder text, not
// customer copy, and "vial"/"pack" alone aren't a potency worth boxing.
// Strips the former down to "High"/"Low" (same as the already-approved
// CJC-1295/Ipamorelin case) and resolves the latter to '' so generate()
// omits the dosage box entirely instead of drawing a meaningless one.
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

  const targets = products.filter((p) => !EXCLUDED_CATEGORIES.includes(p.category));
  console.log(`${products.length} total products, ${targets.length} targeted (peptide/amino/kit).\n`);

  const rows = [];
  let failCount = 0;
  for (const p of targets) {
    const name = stripTrailingAnnotation(p.name);
    const dosage = resolveDosage(p.dosage);
    const purity = p.purity || '00';
    try {
      const result = await generate({ name, dosage, purity, slugSuffix: SLUG_SUFFIX });
      if (result.imagePathForDb === (p.image_path || '')) {
        // Should be unreachable given SLUG_SUFFIX, but fail loudly rather
        // than silently ship a collision if it ever somehow happens.
        throw new Error(`generated path still collides with current image_path (${p.image_path}) despite SLUG_SUFFIX`);
      }
      rows.push({
        product_id: p.id,
        name,
        dosage_raw: p.dosage || '',
        dosage,
        purity,
        lot: p.lot || '',
        current_image_path: p.image_path || '',
        generated_file: result.outPath,
        image_path_to_set: result.imagePathForDb,
        mode: result.mode,
      });
      console.log(`OK   ${p.id.padEnd(28)} ${result.mode.padEnd(16)} -> ${result.imagePathForDb}`);
    } catch (err) {
      failCount++;
      console.error(`FAIL ${p.id.padEnd(28)} ${err.message}`);
    }
  }

  const header = 'product_id,name,dosage_raw,dosage_used,purity,lot,current_image_path,generated_file,image_path_to_set';
  const lines = [header, ...rows.map((r) => [
    r.product_id, r.name, r.dosage_raw, r.dosage, r.purity, r.lot, r.current_image_path, r.generated_file, r.image_path_to_set,
  ].map(csvEscape).join(','))];
  fs.writeFileSync(CSV_PATH, lines.join('\n') + '\n');

  console.log(`\nDone: ${rows.length} generated, ${failCount} failed.`);
  console.log(`Handoff CSV written to ${CSV_PATH}`);
  console.log('Nothing was written to the database -- review the CSV and apply image_path (and purity, where it');
  console.log('differs from what\'s already live) via psql yourself.');
}

main().catch((e) => { console.error(e); process.exit(1); });
