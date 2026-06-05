#!/usr/bin/env node
/**
 * Verifies the local dev app boots and Vite serves non-empty critical modules.
 * Usage: node scripts/verify-dev-app-load.mjs [baseUrl]
 */
const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8080').replace(/\/$/, '');

const CRITICAL_MODULES = [
  {
    path: '/src/components/layout/nav-secondary-carousel-geometry.ts',
    exports: ['FOCUS_SLOT_SNAP', 'buildWheelGeometry', 'itemPlacement'],
  },
  {
    path: '/src/components/layout/NavSecondaryCarousel.tsx',
    exports: ['NavSecondaryCarousel'],
  },
];

const STARTUP_ERROR_MARKERS = [
  'Levela hit a startup issue',
  'does not provide an export named',
];

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

function fail(message) {
  console.error(`verify:dev-load FAIL: ${message}`);
  process.exit(1);
}

async function verifyModule(module) {
  const url = `${baseUrl}${module.path}`;
  let result;
  try {
    result = await fetchText(url);
  } catch (error) {
    fail(`Could not fetch ${url} (${error instanceof Error ? error.message : error})`);
  }

  if (!result.ok) {
    fail(`${url} returned HTTP ${result.status}`);
  }

  const bytes = result.text.length;
  if (bytes < 400) {
    fail(
      `${module.path} looks empty or stale (${bytes} bytes). ` +
        'Restart dev on port 8080 and run: rm -rf node_modules/.vite',
    );
  }

  for (const exportName of module.exports) {
    if (!result.text.includes(exportName)) {
      fail(`${module.path} is missing export "${exportName}" in dev transform`);
    }
  }
}

async function main() {
  let index;
  try {
    index = await fetchText(`${baseUrl}/`);
  } catch (error) {
    fail(
      `Dev server not reachable at ${baseUrl} (${error instanceof Error ? error.message : error}). ` +
        'Start it with: npm run dev',
    );
  }

  if (!index.ok) {
    fail(`GET / returned HTTP ${index.status}`);
  }

  for (const marker of STARTUP_ERROR_MARKERS) {
    if (index.text.includes(marker)) {
      fail(`Index HTML still contains startup error marker: ${marker}`);
    }
  }

  for (const module of CRITICAL_MODULES) {
    await verifyModule(module);
  }

  let market;
  try {
    market = await fetchText(`${baseUrl}/market`);
  } catch (error) {
    fail(`GET /market failed (${error instanceof Error ? error.message : error})`);
  }

  if (!market.ok) {
    fail(`GET /market returned HTTP ${market.status}`);
  }

  console.log(`verify:dev-load OK (${baseUrl})`);
}

main();
