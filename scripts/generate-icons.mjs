// Generise PWA/favicon PNG ikonice iz placeholder SVG loga (brand/icon-source.svg).
// Pokreni: node scripts/generate-icons.mjs
// Kada dobijemo pravi logo/brend, samo zameni brand/icon-source.svg i pokreni ponovo.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const src = path.join(root, "brand/icon-source.svg");
const outDir = path.join(root, "public/icons");
mkdirSync(outDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 180, 192, 256, 384, 512];

const run = async () => {
  for (const size of sizes) {
    await sharp(src, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}.png`));
  }

  // Maskable ikonica: dodaj "safe zone" padding (~20%) da Android maska ne odseca logo.
  const maskableSize = 512;
  const pad = Math.round(maskableSize * 0.2);
  const inner = maskableSize - pad * 2;
  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: "#0A0A0E",
    },
  })
    .composite([
      {
        input: await sharp(src, { density: 384 }).resize(inner, inner).toBuffer(),
        top: pad,
        left: pad,
      },
    ])
    .png()
    .toFile(path.join(outDir, "icon-maskable-512.png"));

  // Apple touch icon (bez providnosti, iOS to ne voli).
  await sharp(src, { density: 384 })
    .resize(180, 180)
    .flatten({ background: "#0A0A0E" })
    .png()
    .toFile(path.join(root, "public/apple-touch-icon.png"));

  // Favicon
  await sharp(src, { density: 384 })
    .resize(32, 32)
    .png()
    .toFile(path.join(root, "public/favicon-32.png"));

  console.log("Ikonice generisane u public/icons, public/apple-touch-icon.png i public/favicon-32.png");
};

run();
