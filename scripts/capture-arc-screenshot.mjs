#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? '/tmp/levela-arc-market.png';
const baseUrl = 'http://127.0.0.1:8080';
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const email = env.match(/^TEST_USER_ROLE_MEMBER_EMAIL=(.+)$/m)?.[1]?.trim();
const password = env.match(/^TEST_USER_ROLE_MEMBER_PASSWORD=(.+)$/m)?.[1]?.trim();

const browser = await chromium.launch({ headless: true });
const width = Number(process.argv[3] ?? 390);
const page = await browser.newPage({ viewport: { width, height: 844 } });
await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
await page.getByLabel(/email/i).fill(email);
await page.getByLabel(/password/i).fill(password);
await page.getByRole('button', { name: /sign in|log in/i }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'));
await page.goto(`${baseUrl}/market?section=for-you`, { waitUntil: 'networkidle' });
await page.waitForSelector('[role="listbox"][aria-label="Section navigation"]', { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: false });
const report = await page.evaluate(() => {
  const options = Array.from(document.querySelectorAll('[role="option"]'));
  const visible = options.filter((e) => Number(getComputedStyle(e).opacity) > 0.5);
  const rects = visible.map((e) => ({ title: e.getAttribute('title'), ...e.getBoundingClientRect() }));
  let overlap = 0;
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlap += 1;
    }
  }
  return { visible: rects, overlap };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
