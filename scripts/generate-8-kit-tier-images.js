// Generates group-shot kit images for the 8 kits moving from a single
// placeholder "pack" row to real 5-Pack/10-Pack tiers. Same pattern as
// generate-kit-batch.js: one render per (family, dosage) via the
// kit-specific template (generate-kit-images.js), copied verbatim to both
// pack-size targets since pack size isn't drawn on the image. Rendered
// into a scratch dir first, same collision-avoidance reason as
// generate-kit-batch.js -- namePrefix.replace(/\s*Kit$/, '') here (e.g.
// "Cagrilintide") could otherwise collide with a real standalone vial's
// own image filename.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { generate } = require('./generate-kit-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');
const SCRATCH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-tier-batch-'));

function moveFile(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
}

const TARGETS = [
  { namePrefix: 'Cagrilintide Kit', dosage: '10mg', paths: ['images/cagrilintide-kit-5-pack-tpl.png', 'images/cagrilintide-kit-10-pack-tpl.png'] },
  { namePrefix: 'IGF-1 LR3 Kit',    dosage: '1mg',  paths: ['images/igf1-lr3-kit-5-pack-tpl.png', 'images/igf1-lr3-kit-10-pack-tpl.png'] },
  { namePrefix: 'KPV Kit',          dosage: '10mg', paths: ['images/kpv-kit-5-pack-tpl.png', 'images/kpv-kit-10-pack-tpl.png'] },
  { namePrefix: 'MT-1 Kit',         dosage: '10mg', paths: ['images/mt-1-kit-5-pack-tpl.png', 'images/mt-1-kit-10-pack-tpl.png'] },
  { namePrefix: 'SS-31 Kit',        dosage: '50mg', paths: ['images/ss-31-kit-5-pack-tpl.png', 'images/ss-31-kit-10-pack-tpl.png'] },
  { namePrefix: 'KLOW Kit',         dosage: '80mg', paths: ['images/klow-kit-5-pack-tpl.png', 'images/klow-kit-10-pack-tpl.png'] },
  { namePrefix: 'MT-2 Kit',         dosage: '10mg', paths: ['images/mt-2-kit-5-pack-tpl.png', 'images/mt-2-kit-10-pack-tpl.png'] },
  { namePrefix: 'PT-141 Kit',       dosage: '10mg', paths: ['images/pt-141-kit-5-pack-tpl.png', 'images/pt-141-kit-10-pack-tpl.png'] },
];

async function main() {
  for (const t of TARGETS) {
    const displayName = t.namePrefix.replace(/\s*Kit$/, '');
    const result = await generate({ name: displayName, dosage: t.dosage, purity: '00', slugSuffix: '-tpl', outDir: SCRATCH_DIR });
    const naturalWebp = result.outPath;
    let first = true;
    let firstTargetWebp = null;
    for (const targetPath of t.paths) {
      const targetWebp = path.join(OUT_DIR, path.basename(targetPath).replace(/\.png$/, '.webp'));
      if (first) {
        if (path.resolve(naturalWebp) !== path.resolve(targetWebp)) {
          moveFile(naturalWebp, targetWebp);
        }
        firstTargetWebp = targetWebp;
        first = false;
      } else {
        fs.copyFileSync(firstTargetWebp, targetWebp);
      }
    }
    console.log(`OK  ${t.namePrefix.padEnd(20)} ${t.dosage.padEnd(8)} (mode: ${result.mode.padEnd(16)}) -> ${t.paths.map(p => path.basename(p)).join(', ')}`);
  }
  fs.rmdirSync(SCRATCH_DIR);
}

main().catch((e) => { console.error(e); process.exit(1); });
