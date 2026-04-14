import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FULL_ICON_SOURCE = path.join(ROOT_DIR, 'public/brand/levela-icon-full.svg');
const MARK_ICON_SOURCE = path.join(ROOT_DIR, 'public/brand/levela-mark.svg');
const FAVICON_PNG = path.join(ROOT_DIR, 'public/favicon.png');
const FAVICON_ICO = path.join(ROOT_DIR, 'public/favicon.ico');

const FULL_ICON_TARGETS = [
  [64, 'public/favicon.png'],
  [48, 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png'],
  [72, 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png'],
  [96, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png'],
  [144, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png'],
  [192, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'],
  [48, 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png'],
  [72, 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png'],
  [96, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png'],
  [144, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png'],
  [192, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png'],
];

const MARK_ICON_TARGETS = [
  [108, 'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png'],
  [162, 'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png'],
  [216, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png'],
  [324, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png'],
  [432, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png'],
];

function resolveTarget(relativePath) {
  return path.join(ROOT_DIR, relativePath);
}

function parsePngDimensions(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error('Not a PNG file.');
  }
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('PNG is missing IHDR chunk.');
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

async function readSvgAsDataUri(svgPath) {
  const raw = await fs.readFile(svgPath, 'utf8');
  return `data:image/svg+xml;base64,${Buffer.from(raw, 'utf8').toString('base64')}`;
}

async function renderSvgToPng(page, svgPath, size, targetPath) {
  const uri = await readSvgAsDataUri(svgPath);

  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:transparent;display:flex;align-items:center;justify-content:center;"><img id="icon" src="${uri}" style="width:${size}px;height:${size}px;display:block;" /></body></html>`);
  await page.waitForFunction(() => {
    const image = document.getElementById('icon');
    return image instanceof HTMLImageElement && image.complete;
  });

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await page.screenshot({
    path: targetPath,
    omitBackground: true,
  });
}

async function writeIcoFromPng(pngPath, icoPath) {
  const png = await fs.readFile(pngPath);
  const { width, height } = parsePngDimensions(png);

  if (width > 255 || height > 255) {
    throw new Error(`ICO wrapper expects PNG dimensions <= 255, received ${width}x${height}.`);
  }

  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0); // reserved
  iconDir.writeUInt16LE(1, 2); // icon type
  iconDir.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(width === 256 ? 0 : width, 0);
  entry.writeUInt8(height === 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image bytes
  entry.writeUInt32LE(6 + 16, 12); // image offset

  await fs.writeFile(icoPath, Buffer.concat([iconDir, entry, png]));
}

async function main() {
  await fs.access(FULL_ICON_SOURCE);
  await fs.access(MARK_ICON_SOURCE);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (const [size, target] of FULL_ICON_TARGETS) {
      await renderSvgToPng(page, FULL_ICON_SOURCE, size, resolveTarget(target));
    }

    for (const [size, target] of MARK_ICON_TARGETS) {
      await renderSvgToPng(page, MARK_ICON_SOURCE, size, resolveTarget(target));
    }
  } finally {
    await browser.close();
  }

  await writeIcoFromPng(FAVICON_PNG, FAVICON_ICO);
}

await main();
console.log('Levela icon assets regenerated from SVG sources.');
