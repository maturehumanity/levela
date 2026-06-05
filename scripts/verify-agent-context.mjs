#!/usr/bin/env node
/**
 * Ensures agent context files exist and AGENTS.md references them.
 * Usage: node scripts/verify-agent-context.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const REQUIRED = [
  'memory-bank/activeContext.md',
  'memory-bank/systemPatterns.md',
  'memory-bank/projectbrief.md',
  'docs/04-operations/dev/nav-secondary-carousel.md',
  '.cursor/rules/levela-project.mdc',
];

const AGENTS = 'docs/04-operations/dev/AGENTS.md';

function fail(msg) {
  console.error(`verify:agent-context FAIL: ${msg}`);
  process.exit(1);
}

for (const path of REQUIRED) {
  if (!existsSync(path)) {
    fail(`missing ${path}`);
  }
}

const agents = readFileSync(AGENTS, 'utf8');
if (!agents.includes('nav-secondary-carousel.md')) {
  fail('AGENTS.md must reference docs/04-operations/dev/nav-secondary-carousel.md');
}
if (!agents.includes('memory-bank/activeContext.md')) {
  fail('AGENTS.md must reference memory-bank/activeContext.md');
}
if (!agents.includes('verify:agent-context')) {
  fail('AGENTS.md must reference verify:agent-context in post-dev sequence');
}

const spec = readFileSync('docs/04-operations/dev/nav-secondary-carousel.md', 'utf8');
if (!spec.includes('Sell') || !spec.includes('Jobs') || !spec.includes('390px')) {
  fail('nav-secondary-carousel.md missing key acceptance criteria');
}

console.log('verify:agent-context OK');
