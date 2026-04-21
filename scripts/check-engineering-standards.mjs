import { promises as fs } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, 'docs/04-operations/dev/engineering-standards-baseline.json');
const sourceRoot = path.join(repoRoot, 'src');

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const children = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      return fullPath;
    }),
  );
  return children.flat();
}

function countLines(sourceText) {
  if (sourceText.length === 0) return 0;
  const newlineCount = (sourceText.match(/\n/g) || []).length;
  return sourceText.endsWith('\n') ? newlineCount : newlineCount + 1;
}

function isTrackedSourceFile(filePath) {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
}

async function main() {
  const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
  const maxSourceLines = Number(baseline.max_source_lines || 400);
  const exemptFiles = new Set((baseline.exempt_files || []).map((file) => file.replace(/\\/g, '/')));
  const legacyAllowlist = Object.fromEntries(
    Object.entries(baseline.legacy_allowlist || {}).map(([file, max]) => [file.replace(/\\/g, '/'), Number(max)]),
  );

  const files = (await walk(sourceRoot))
    .filter(isTrackedSourceFile)
    .map((file) => path.relative(repoRoot, file).replace(/\\/g, '/'))
    .sort();

  const violations = [];

  for (const relativePath of files) {
    if (exemptFiles.has(relativePath)) continue;

    const fileText = await fs.readFile(path.join(repoRoot, relativePath), 'utf8');
    const lineCount = countLines(fileText);
    const legacyMax = legacyAllowlist[relativePath];

    if (legacyMax !== undefined) {
      if (lineCount > legacyMax) {
        violations.push(`${relativePath} has grown to ${lineCount} lines (baseline ${legacyMax}).`);
      }
      continue;
    }

    if (lineCount > maxSourceLines) {
      violations.push(`${relativePath} has ${lineCount} lines (limit ${maxSourceLines}).`);
    }
  }

  if (violations.length > 0) {
    console.error('Engineering standards check failed:\n');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log('Engineering standards check passed.');
}

await main();
