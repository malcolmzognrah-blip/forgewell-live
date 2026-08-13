// Generates vial images for all 60 kit rows (the dosage x pack-size
// matrix), using the kit-specific template (generate-kit-images.js).
// Pack size isn't drawn on the image (see that script's own comment), so
// this generates each unique (family, dosage) combination once and writes
// the same content to both its 5-Pack and 10-Pack image_path targets,
// rather than rendering 60 times for 30 distinct pictures.
//
// TARGETS below was generated directly from a live DB query (id, name,
// dosage, pack_size, image_path for every kit row), not hand-typed --
// hand-typing the 5-Pack/10-Pack id pattern turned out to be error-prone
// (18 of 30 groups were wrong on the first attempt, caught by
// cross-checking against the real data before running this).
//
// Usage: node generate-kit-batch.js

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-kit-images.js');

const OUT_DIR = path.join(__dirname, '..', 'images');

const TARGETS = [
  {
    "namePrefix": "BPC-157 Kit",
    "dosage": "10mg",
    "paths": [
      "images/bpc-157-kit-10mg-5-pack-tpl.png",
      "images/bpc-157-kit-10mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "BPC-157 Kit",
    "dosage": "5mg",
    "paths": [
      "images/bpc-157-kit-5-pack-tpl.png",
      "images/bpc-157-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "BPC/TB Blend Kit",
    "dosage": "10mg/10mg",
    "paths": [
      "images/bpc-tb-blend-kit-10mg-10mg-5-pack-tpl.png",
      "images/bpc-tb-blend-kit-10mg-10mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "BPC/TB Blend Kit",
    "dosage": "20mg/20mg",
    "paths": [
      "images/bpc-tb-blend-kit-20mg-20mg-5-pack-tpl.png",
      "images/bpc-tb-blend-kit-20mg-20mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "BPC/TB Blend Kit",
    "dosage": "5mg/5mg",
    "paths": [
      "images/bpc-tb-blend-kit-5-pack-tpl.png",
      "images/bpc-tb-blend-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "CJC/IPA Blend Kit",
    "dosage": "10mg/10mg",
    "paths": [
      "images/cjc-ipa-blend-kit-10mg-10mg-5-pack-tpl.png",
      "images/cjc-ipa-blend-kit-10mg-10mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "CJC/IPA Blend Kit",
    "dosage": "5mg/5mg",
    "paths": [
      "images/cjc-ipa-blend-kit-5-pack-tpl.png",
      "images/cjc-ipa-blend-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "GHK-Cu Kit",
    "dosage": "100mg",
    "paths": [
      "images/ghk-cu-kit-100mg-5-pack-tpl.png",
      "images/ghk-cu-kit-100mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "GHK-Cu Kit",
    "dosage": "200mg",
    "paths": [
      "images/ghk-cu-kit-200mg-5-pack-tpl.png",
      "images/ghk-cu-kit-200mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "GHK-Cu Kit",
    "dosage": "50mg",
    "paths": [
      "images/ghk-cu-kit-5-pack-tpl.png",
      "images/ghk-cu-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "MOTS-C Kit",
    "dosage": "10mg",
    "paths": [
      "images/mots-c-kit-5-pack-tpl.png",
      "images/mots-c-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "MOTS-C Kit",
    "dosage": "40mg",
    "paths": [
      "images/mots-c-kit-40mg-5-pack-tpl.png",
      "images/mots-c-kit-40mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Retatrutide Kit",
    "dosage": "100mg",
    "paths": [
      "images/retatrutide-kit-100mg-5-pack-tpl.png",
      "images/retatrutide-kit-100mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Retatrutide Kit",
    "dosage": "10mg",
    "paths": [
      "images/retatrutide-kit-5-pack-tpl.png",
      "images/retatrutide-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Retatrutide Kit",
    "dosage": "20mg",
    "paths": [
      "images/retatrutide-kit-20mg-5-pack-tpl.png",
      "images/retatrutide-kit-20mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Retatrutide Kit",
    "dosage": "30mg",
    "paths": [
      "images/retatrutide-kit-30mg-5-pack-tpl.png",
      "images/retatrutide-kit-30mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Retatrutide Kit",
    "dosage": "50mg",
    "paths": [
      "images/retatrutide-kit-50mg-5-pack-tpl.png",
      "images/retatrutide-kit-50mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Semaglutide Kit",
    "dosage": "10mg",
    "paths": [
      "images/semaglutide-kit-10mg-5-pack-tpl.png",
      "images/semaglutide-kit-10mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Semaglutide Kit",
    "dosage": "5mg",
    "paths": [
      "images/semaglutide-kit-5-pack-tpl.png",
      "images/semaglutide-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Sermorelin Kit",
    "dosage": "10mg",
    "paths": [
      "images/sermorelin-kit-10mg-5-pack-tpl.png",
      "images/sermorelin-kit-10mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Sermorelin Kit",
    "dosage": "5mg",
    "paths": [
      "images/sermorelin-kit-tpl.png",
      "images/sermorelin-kit-5mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "TB-500 Kit",
    "dosage": "10mg",
    "paths": [
      "images/tb-500-kit-10mg-5-pack-tpl.png",
      "images/tb-500-kit-10mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "TB-500 Kit",
    "dosage": "5mg",
    "paths": [
      "images/tb-500-kit-tpl.png",
      "images/tb-500-kit-5mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Tesamorelin Kit",
    "dosage": "10mg",
    "paths": [
      "images/tesamorelin-kit-10mg-5-pack-tpl.png",
      "images/tesamorelin-kit-10mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Tesamorelin Kit",
    "dosage": "20mg",
    "paths": [
      "images/tesamorelin-kit-20mg-5-pack-tpl.png",
      "images/tesamorelin-kit-20mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Tesamorelin Kit",
    "dosage": "5mg",
    "paths": [
      "images/tesamorelin-kit-5-pack-tpl.png",
      "images/tesamorelin-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Tirzepatide Kit",
    "dosage": "10mg",
    "paths": [
      "images/tirzepatide-kit-5-pack-tpl.png",
      "images/tirzepatide-kit-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Tirzepatide Kit",
    "dosage": "20mg",
    "paths": [
      "images/tirzepatide-kit-20mg-5-pack-tpl.png",
      "images/tirzepatide-kit-20mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Tirzepatide Kit",
    "dosage": "30mg",
    "paths": [
      "images/tirzepatide-kit-30mg-5-pack-tpl.png",
      "images/tirzepatide-kit-30mg-10-pack-tpl.png"
    ]
  },
  {
    "namePrefix": "Tirzepatide Kit",
    "dosage": "60mg",
    "paths": [
      "images/tirzepatide-kit-60mg-5-pack-tpl.png",
      "images/tirzepatide-kit-60mg-10-pack-tpl.png"
    ]
  }
];

async function main() {
  for (const t of TARGETS) {
    const displayName = t.namePrefix.replace(/\s*Kit$/, '');
    const result = await generate({ name: displayName, dosage: t.dosage, purity: '00', slugSuffix: '-tpl' });
    const naturalWebp = result.outPath;
    let first = true;
    let firstTargetWebp = null;
    for (const targetPath of t.paths) {
      const targetWebp = path.join(OUT_DIR, path.basename(targetPath).replace(/\.png$/, '.webp'));
      if (first) {
        if (path.resolve(naturalWebp) !== path.resolve(targetWebp)) {
          fs.renameSync(naturalWebp, targetWebp);
        }
        firstTargetWebp = targetWebp;
        first = false;
      } else {
        fs.copyFileSync(firstTargetWebp, targetWebp);
      }
    }
    console.log(`OK  ${t.namePrefix.padEnd(20)} ${t.dosage.padEnd(10)} (mode: ${result.mode.padEnd(16)}) -> ${t.paths.map(p => path.basename(p)).join(', ')}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
