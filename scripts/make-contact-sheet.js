// Throwaway diagnostic tool -- not part of any pipeline. Builds a labeled
// contact sheet of the 18 recently-dosage-updated products' images so they
// can be visually spot-checked for stale (pre-dosage-fill) renders in one
// pass instead of 18 separate reads.
const sharp = require('sharp');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'images');
const IDS = [
  '5-amino-1mq','cagrilintide','chonluten','crystagen','epithalon','ghrp-2',
  'glow-pro-blend','hexarelin','igf1-lr3','kisspeptin','ll-37','mt-1','ovagen',
  'pancragen','pnc-27','snap-8','thymalin','vesugen',
];

const TILE = 260;
const COLS = 6;
const ROWS = Math.ceil(IDS.length / COLS);
const LABEL_H = 30;
const CELL_H = TILE + LABEL_H;

async function main() {
  const composites = [];
  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * TILE;
    const y = row * CELL_H;
    const imgPath = path.join(IMAGES_DIR, `${id}-tpl.webp`);
    const resized = await sharp(imgPath).resize(TILE, TILE, { fit: 'contain', background: '#fff' }).toBuffer();
    composites.push({ input: resized, left: x, top: y });
    const labelSvg = `<svg width="${TILE}" height="${LABEL_H}"><text x="5" y="20" font-size="16" font-family="sans-serif" fill="#000">${id}</text></svg>`;
    composites.push({ input: Buffer.from(labelSvg), left: x, top: y + TILE });
  }

  await sharp({
    create: { width: COLS * TILE, height: ROWS * CELL_H, channels: 3, background: '#fff' },
  })
    .composite(composites)
    .png()
    .toFile(path.join(__dirname, 'contact-sheet.png'));

  console.log('Wrote contact-sheet.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
