#!/usr/bin/env node
/**
 * Verifies arc carousel flank items have non-zero CSS rotation on /market.
 * Usage: node scripts/verify-arc-carousel-rotation.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173';

function loadMemberCredentials() {
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const email = env.match(/^TEST_USER_ROLE_MEMBER_EMAIL=(.+)$/m)?.[1]?.trim();
    const password = env.match(/^TEST_USER_ROLE_MEMBER_PASSWORD=(.+)$/m)?.[1]?.trim();
    if (email && password) return { email, password };
  } catch {
    // ignore
  }
  return null;
}

function rotationDegFromTransform(transform) {
  if (!transform || transform === 'none') return 0;
  const match = transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/);
  if (match) return Number(match[1]);
  if (typeof DOMMatrix !== 'undefined') {
    const matrix = new DOMMatrix(transform);
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  }
  return 0;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 60000 });

  const creds = loadMemberCredentials();
  if (!creds) {
    throw new Error('Missing TEST_USER_ROLE_MEMBER_* in .env.local');
  }

  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 });

  await page.goto(`${baseUrl}/market?section=antiques-collectibles`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  await page.getByRole('button', { name: /^market$/i }).click();
  await page.waitForTimeout(1000);

  const results = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    return options.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        title: el.getAttribute('title') ?? '',
        transform: el.style.transform,
        opacity: getComputedStyle(el).opacity,
        visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight,
      };
    });
  });

  const analyzed = results.map((row) => ({
    ...row,
    deg: rotationDegFromTransform(row.transform),
  }));

  const visible = analyzed.filter((row) => row.visible && Number(row.opacity) > 0.4);
  const flank = visible.filter((row) => Math.abs(row.deg) > 5);
  const center = visible.filter((row) => Math.abs(row.deg) <= 2);

  console.log(
    JSON.stringify(
      {
        total: analyzed.length,
        visible: visible.length,
        flankRotated: flank.length,
        centerLike: center.length,
        visibleSamples: visible.slice(0, 10),
      },
      null,
      2,
    ),
  );

  if (analyzed.length < 3) {
    throw new Error(`Expected arc options in DOM, found ${analyzed.length}`);
  }
  if (visible.length < 3) {
    throw new Error(`FAIL: expected visible arc items, found ${visible.length}`);
  }
  if (flank.length < 2) {
    throw new Error(
      `FAIL: fewer than 2 visible flank items show arc rotation (>5deg). Visible: ${visible.map((f) => `${f.title}:${f.deg.toFixed(1)}`).join(', ')}`,
    );
  }

  console.log('PASS: arc carousel items are rotated along the curve.');
} finally {
  await browser.close();
}
