import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="14" fill="#F3EFE6" />
  <rect x="7" y="43" width="50" height="14" rx="7" fill="#1B1A17" />
  <rect x="16" y="26" width="33" height="13" rx="6.5" fill="#1B1A17" transform="rotate(-3 32 32)" />
  <circle cx="33" cy="13" r="7" fill="#D9482B" />
</svg>`;

async function makeIcons() {
  const publicDir = path.join(rootDir, "public");
  const appDir = path.join(rootDir, "app");

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const svgBuffer = Buffer.from(svgContent);

  // 1. apple-icon.png (180x180) in app/
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(appDir, "apple-icon.png"));
  console.log("Created app/apple-icon.png (180x180)");

  // 2. PWA icons in public/
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, "icon-192.png"));
  console.log("Created public/icon-192.png (192x192)");

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, "icon-512.png"));
  console.log("Created public/icon-512.png (512x512)");
}

makeIcons().catch((err) => {
  console.error("Failed to generate icons:", err);
  process.exit(1);
});
