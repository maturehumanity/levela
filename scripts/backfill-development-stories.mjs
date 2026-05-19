import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORY_AUTHOR_ID = process.env.STORY_AUTHOR_ID;
const AGENT_TRANSCRIPTS_DIR = process.env.AGENT_TRANSCRIPTS_DIR || '';
const DRY_RUN = process.env.DRY_RUN === '1';
const MAX_COMMITS = Number(process.env.BACKFILL_MAX_COMMITS || 250);
const MAX_CHAT_STORIES = Number(process.env.BACKFILL_MAX_CHAT_STORIES || 400);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STORY_AUTHOR_ID) {
  console.error(
    'Missing required env vars. Required: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, STORY_AUTHOR_ID',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function classifyStory(text) {
  const value = text.toLowerCase();

  let section = 'General';
  if (/home/.test(value)) section = 'Home';
  else if (/search/.test(value)) section = 'Search';
  else if (/governance/.test(value)) section = 'Governance';
  else if (/messag/.test(value)) section = 'Messaging';
  else if (/market/.test(value)) section = 'Market';
  else if (/study/.test(value)) section = 'Study';
  else if (/profile/.test(value)) section = 'Profile';
  else if (/settings|admin/.test(value)) section = 'Settings';

  let area = 'Product Evolution';
  if (/bug|fix|error|crash|broken/.test(value)) area = 'Stability + Bug Fixes';
  else if (/ui|ux|layout|design|style|tab|card|button/.test(value)) area = 'UI/UX';
  else if (/search|find|discover/.test(value)) area = 'Navigation + Discovery';
  else if (/story|stories|history|timeline|log/.test(value)) area = 'Product Governance + Transparency';
  else if (/auth|permission|role|security/.test(value)) area = 'Security + Access';
  else if (/performance|speed|optimi/.test(value)) area = 'Performance';

  return { section, area };
}

function makeExpectedBehavior(title) {
  return `This change should be visible in app behavior and aligned with the request: ${title}`;
}

function parseTimestampFromText(text) {
  const match = text.match(/<timestamp>(.*?)<\/timestamp>/i);
  if (!match) return null;
  const parsed = new Date(match[1]);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseUserQueryFromText(text) {
  const match = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i);
  if (match) return normalizeWhitespace(match[1]);
  return normalizeWhitespace(text);
}

/**
 * Persisted story fields should reflect: main topic, summarized title, and
 * reader-useful specs/behavior — not raw chat noise (acknowledgements, empty
 * questions, meta tooling chatter).
 */
function stripChatNoiseForStorage(text) {
  let t = normalizeWhitespace(text);
  if (!t) return t;
  t = t.replace(/^user-requested change captured from chat history:\s*/i, '');
  while (true) {
    const m = t.match(
      /^what do you mean,?\s*(will you please give me examples of how\s+)?/i,
    );
    if (m?.[0]) {
      t = t.slice(m[0].length).trim();
      continue;
    }
    if (/^(ok|okay)\s*[,.-]?\s*implement\s*$/i.test(t)) return '';
    if (/^(ok|okay)\s*[,.-]\s*/i.test(t) && t.length < 28) {
      t = t.replace(/^(ok|okay)\s*[,.-]\s*/i, '').trim();
      continue;
    }
    break;
  }
  return normalizeWhitespace(t);
}

function extractSpecsBody(instruction) {
  let t = stripChatNoiseForStorage(instruction);
  if (!t) return '';
  if (/^what do you mean/i.test(t)) {
    const how = t.match(/\bhow\s+(.+)/i);
    if (how?.[1] && how[1].length > 24) {
      t = how[1].replace(/^(the|a|an)\s+/i, '').trim();
    }
  }
  return normalizeWhitespace(t).slice(0, 480);
}

function pickTitleFromInstruction(instruction) {
  const cleaned = stripChatNoiseForStorage(instruction);
  const base = cleaned || normalizeWhitespace(instruction);
  const firstLine =
    base
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length >= 12) || base;
  let candidate = firstLine;
  if (/^what do you mean/i.test(candidate)) {
    const how = candidate.match(/\bhow\s+(.+)/i);
    if (how?.[1] && how[1].length > 20) {
      candidate = how[1].replace(/^(the|a|an)\s+/i, '').trim();
    }
  }
  if (!candidate || candidate.length < 8) candidate = base.slice(0, 120);
  return normalizeWhitespace(candidate).slice(0, 120);
}

function buildRephrasedFromInstruction(instruction, section, area) {
  const specs = extractSpecsBody(instruction);
  if (!specs) return `${section} / ${area}: product change requested from chat export.`;
  return `${section} / ${area}: ${specs}`;
}

function isAcknowledgementOnlyInstruction(instruction) {
  const t = stripChatNoiseForStorage(instruction).toLowerCase();
  if (!t) return true;
  if (/^ok\b[,.\s-]*implement\.?$/.test(t)) return true;
  if (t.length < 48 && !/\b(search|keyword|fix|add|remove|update|scroll|apk|policy|implement\s+\w|bug|error)\b/i.test(t)) {
    return true;
  }
  return false;
}

/** Skip ingest for “do the process” lines with no product signal (matches client-side meta filter). */
function isProcessOnlyInstruction(instruction) {
  const t = stripChatNoiseForStorage(instruction).toLowerCase();
  if (!t) return false;
  if (/\b(move on as per your recommendations)\b/.test(t) && !/\b(migration|ssh|vps|database|deploy)\b/.test(t)) {
    return true;
  }
  if (/\b(commit,?\s*push,?\s*build and ship|build and ship the updated version)\b/.test(t)) {
    return true;
  }
  if (/\b(divide\s+(the\s+)?plan\s+into)\b.*\b(chunk|chunks|slice|slices)\b/.test(t)) return true;
  if (/\bmove\s+on\s*,?\s*with\s+(?:a\s+)?(?:much\s+)?larger\s+chunks?\b/.test(t)) return true;
  if (
    /\b(you\s+)?didn'?t\s+move\s+on\b/.test(t)
    && !/\b(decentrali|migration|ssh|vps|search|schema|fix\s|bug\b|apk)\b/.test(t)
  ) {
    return true;
  }
  if (/\b(can we|could we)\s+move\s+on\s+to\s+the\s+next\s+slice\b/.test(t)) return true;
  if (/\bso,?\s+can\s+we\s+move\s+on\b.*\b(next\s+slice|slice\s+now)\b/.test(t)) return true;
  if (/\bmove\s+on\s+to\s+the\s+next\s+slice\b/.test(t) && !/\b(decentrali|migration|ssh|vps|fix|implement|preload)\b/.test(t)) {
    return true;
  }
  if (/\b(if we'?re\s+done\s+with\s+the\s+previous\s+one)\b/.test(t)) return true;
  if (/\bmove\s+on,?\s+and\s+at\s+the\s+end\s+of\s+every\s+(report|rerport|repport)\b/.test(t)) return true;
  if (/\b(are you asking me|you'?re gonna bring)\b/.test(t) && t.length < 200) return true;
  if (
    /\b(i\s+just\s+restarted|restarted\s+the\s+application)\b/.test(t)
    && /\b(failed to connect|couldn'?t connect)\b/.test(t)
    && t.length < 260
    && !/\b(please\s+fix|investigate|implement)\b/.test(t)
  ) {
    return true;
  }
  if (/\bdid\s+you\s+take\s+all\s+necessary\s+measures\b/.test(t) && !/\b(preload|prefetch)\b/.test(t)) {
    return true;
  }
  if (/\bmove\s+on\s+with\s+larger\s+ch[uw]+/.test(t)) return true;
  if (/\bchuncks\b/.test(t) || /\bchunds\b/.test(t)) return true;
  if (/^\s*chore:\s*refresh\b/i.test(t) && /\bmanifest\b/.test(t)) return true;
  return false;
}

async function listTranscriptFiles(rootDir) {
  const results = [];
  if (!rootDir) return results;

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(target);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(target);
      }
    }
  }

  await walk(rootDir);
  return results;
}

function getGitCommitStories() {
  const pretty = '%H%x1f%aI%x1f%s%x1f%b%x1e';
  const raw = execSync(`git log --date=iso-strict --pretty=format:${pretty} -n ${MAX_COMMITS}`, {
    encoding: 'utf8',
  });

  return raw
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, authoredAt, subject, body = ''] = entry.split('\x1f');
      const instruction = normalizeWhitespace(`${subject}\n${body}`.trim());
      const { section, area } = classifyStory(instruction);
      return {
        source_story_key: `git:${sha}`,
        title: normalizeWhitespace(subject).slice(0, 120),
        original_instruction: instruction,
        rephrased_description: `Implemented repository change: ${normalizeWhitespace(subject)}.`,
        section,
        area,
        created_features: [`Commit ${sha.slice(0, 8)} recorded from git history`],
        expected_behavior: makeExpectedBehavior(subject),
        requested_at: authoredAt,
        source: 'git',
        source_type: 'git',
        source_id: sha,
        source_url: null,
        commit_sha: sha,
        story_kind: 'development',
        status: 'published',
        visibility: 'public',
        metadata: { origin: 'backfill', commitSha: sha },
      };
    });
}

async function getTranscriptStories() {
  if (!AGENT_TRANSCRIPTS_DIR) return [];
  let files = [];
  try {
    files = await listTranscriptFiles(AGENT_TRANSCRIPTS_DIR);
  } catch (error) {
    console.warn(`Skipping transcripts backfill: ${(error && error.message) || error}`);
    return [];
  }

  const stories = [];
  for (const filePath of files) {
    const chatId = path.basename(filePath, '.jsonl');
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);

    for (let idx = 0; idx < lines.length; idx += 1) {
      if (stories.length >= MAX_CHAT_STORIES) return stories;
      let parsed;
      try {
        parsed = JSON.parse(lines[idx]);
      } catch {
        continue;
      }

      if (parsed?.role !== 'user') continue;
      const textParts = (parsed?.message?.content || [])
        .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
        .map((part) => part.text);
      if (textParts.length === 0) continue;

      const combinedText = textParts.join('\n');
      const instruction = parseUserQueryFromText(combinedText);
      if (!instruction || instruction.length < 8) continue;
      if (isAcknowledgementOnlyInstruction(instruction)) continue;
      if (isProcessOnlyInstruction(instruction)) continue;

      const timestamp = parseTimestampFromText(combinedText);
      const { section, area } = classifyStory(instruction);
      const title = pickTitleFromInstruction(instruction);
      const rephrasedDescription = buildRephrasedFromInstruction(instruction, section, area);

      stories.push({
        source_story_key: `chat:${chatId}:${idx + 1}`,
        title,
        original_instruction: instruction,
        rephrased_description: rephrasedDescription,
        section,
        area,
        created_features: ['Source: Cursor agent chat export (topic + behavior summarized on ingest)'],
        expected_behavior: makeExpectedBehavior(title),
        requested_at: timestamp || new Date().toISOString(),
        source: 'chat',
        source_type: 'chat',
        source_id: `${chatId}:${idx + 1}`,
        source_url: null,
        chat_id: chatId,
        story_kind: 'development',
        status: 'published',
        visibility: 'public',
        metadata: { origin: 'backfill', transcript: filePath, lineNumber: idx + 1 },
      });
    }
  }

  return stories;
}

async function upsertStories(stories) {
  if (stories.length === 0) return { inserted: 0 };
  const payload = stories.map((story) => ({
    author_id: STORY_AUTHOR_ID,
    ...story,
  }));

  if (DRY_RUN) {
    console.log(`DRY_RUN=1 -> would upsert ${payload.length} stories`);
    return { inserted: payload.length };
  }

  const { error } = await supabase
    .from('development_stories')
    .upsert(payload, { onConflict: 'source_story_key' });

  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }

  return { inserted: payload.length };
}

async function run() {
  const gitStories = getGitCommitStories();
  const transcriptStories = await getTranscriptStories();
  const all = [...gitStories, ...transcriptStories].sort(
    (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime(),
  );

  const dedup = new Map();
  all.forEach((story) => {
    if (!dedup.has(story.source_story_key)) dedup.set(story.source_story_key, story);
  });
  const merged = Array.from(dedup.values());

  const { inserted } = await upsertStories(merged);
  console.log(`Backfill complete. Processed ${merged.length} unique stories (${inserted} upserted).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
