import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import {
  TEST_USER_FIXTURES,
  LEGACY_TEST_EMAIL_PREFIXES,
  LEGACY_TEST_USERNAME_PATTERNS,
  fixtureEnvPrefix,
} from './test-user-fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');
const envBlockStart = '# TEST_USER_CREDENTIALS_START';
const envBlockEnd = '# TEST_USER_CREDENTIALS_END';

function loadSimpleEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return accumulator;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex < 0) return accumulator;
      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function toRemotePathExpression(remotePath) {
  if (remotePath.startsWith('~/')) {
    return `"$HOME/${remotePath.slice(2)}"`;
  }

  return shellEscape(remotePath);
}

function fetchRemoteConfig(remoteHost, remoteDockerDir) {
  const command = `cd ${toRemotePathExpression(remoteDockerDir)} && grep -E '^(SERVICE_ROLE_KEY|API_EXTERNAL_URL)=' .env`;
  const output = execFileSync('ssh', ['-o', 'IdentitiesOnly=yes', remoteHost, command], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const remoteVars = {};
  for (const line of output.split(/\r?\n/)) {
    const [key, ...rest] = line.split('=');
    if (!key || rest.length === 0) continue;
    remoteVars[key] = rest.join('=').trim();
  }

  if (!remoteVars.SERVICE_ROLE_KEY || !remoteVars.API_EXTERNAL_URL) {
    throw new Error('Could not resolve SERVICE_ROLE_KEY and API_EXTERNAL_URL from the remote Supabase stack.');
  }

  return {
    serviceRoleKey: remoteVars.SERVICE_ROLE_KEY,
    apiUrl: remoteVars.API_EXTERNAL_URL,
  };
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = randomBytes(24);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (!data.nextPage) break;
    page = data.nextPage;
  }

  return users;
}

function isLegacyEmail(email) {
  const normalized = String(email || '').toLowerCase();
  return LEGACY_TEST_EMAIL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isManagedFixtureEmail(email) {
  const normalized = String(email || '').toLowerCase();
  return TEST_USER_FIXTURES.some((fixture) => fixture.email.toLowerCase() === normalized);
}

function isLegacyOrManagedUsername(username) {
  const normalized = String(username || '').toLowerCase();
  if (!normalized) return false;
  if (TEST_USER_FIXTURES.some((fixture) => fixture.username === normalized)) return true;
  return LEGACY_TEST_USERNAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

async function waitForProfile(supabase, userId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for profile creation for auth user ${userId}.`);
}

async function getVerifierProfileId(supabase) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,role,username')
    .order('created_at', { ascending: true })
    .limit(1000);

  if (error) throw error;
  const verifierProfile = (data || []).find((profile) => profile.role === 'founder' || profile.role === 'admin');

  if (!verifierProfile?.id) {
    throw new Error('Could not locate an existing founder/admin profile to mark profession approvals.');
  }

  return verifierProfile.id;
}

async function deleteManagedAndLegacyUsers(supabase) {
  const authUsers = await listAllUsers(supabase);
  const authUsersById = new Map(authUsers.map((user) => [user.id, user]));
  const deletedUserIds = new Set();

  for (const user of authUsers) {
    const email = user.email || '';
    if (!isManagedFixtureEmail(email) && !isLegacyEmail(email)) continue;
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw error;
    deletedUserIds.add(user.id);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id,user_id,username,full_name')
    .limit(1000);

  if (profilesError) throw profilesError;

  for (const profile of profiles || []) {
    if (!isLegacyOrManagedUsername(profile.username)) continue;

    if (profile.user_id && authUsersById.has(profile.user_id) && !deletedUserIds.has(profile.user_id)) {
      const { error } = await supabase.auth.admin.deleteUser(profile.user_id);
      if (error) throw error;
      deletedUserIds.add(profile.user_id);
      continue;
    }

    const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
    if (error) throw error;
  }
}

async function createFixtureUser(supabase, verifierProfileId, fixture) {
  const password = generatePassword();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: fixture.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fixture.fullName,
      username: fixture.username,
    },
  });

  if (createError || !created.user) {
    throw createError || new Error(`Failed to create ${fixture.username}.`);
  }

  const profile = await waitForProfile(supabase, created.user.id);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: fixture.fullName,
      username: fixture.username,
      role: fixture.role,
      is_verified: fixture.isVerified,
      country: fixture.country,
      country_code: fixture.countryCode,
      language_code: fixture.languageCode,
      bio: fixture.bio,
    })
    .eq('id', profile.id);

  if (profileError) throw profileError;

  const { error: deleteProfessionsError } = await supabase
    .from('profile_professions')
    .delete()
    .eq('profile_id', profile.id);

  if (deleteProfessionsError) throw deleteProfessionsError;

  for (const professionId of fixture.professions) {
    console.log(`  assigning profession ${professionId} to ${fixture.username}...`);
    const { error: professionError } = await supabase
      .from('profile_professions')
      .insert({
        profile_id: profile.id,
        profession_id: professionId,
        status: 'approved',
        verified_by: verifierProfileId,
        verified_at: new Date().toISOString(),
        notes: 'Seeded by scripts/sync-test-users.mjs',
      });

    if (professionError) throw professionError;
  }

  console.log(`  finalizing role ${fixture.role} for ${fixture.username}...`);
  const { error: finalRoleError } = await supabase
    .from('profiles')
    .update({
      role: fixture.role,
      is_verified: fixture.isVerified,
    })
    .eq('id', profile.id);

  if (finalRoleError) throw finalRoleError;

  return {
    ...fixture,
    password,
  };
}

function buildEnvBlock(fixturesWithPasswords) {
  const vitePayload = fixturesWithPasswords.map((fixture) => ({
    key: fixture.key,
    scope: fixture.scope,
    username: fixture.username,
    email: fixture.email,
    password: fixture.password,
    fullName: fixture.fullName,
    role: fixture.role,
    professions: fixture.professions,
  }));
  const lines = [
    envBlockStart,
    '# Managed by scripts/sync-test-users.mjs. Credentials stay local to this machine.',
    `VITE_TEST_USERS_JSON=${shellEscape(JSON.stringify(vitePayload))}`,
    '',
  ];

  for (const fixture of fixturesWithPasswords) {
    const prefix = fixtureEnvPrefix(fixture);
    lines.push(`${prefix}_USERNAME=${fixture.username}`);
    lines.push(`${prefix}_EMAIL=${fixture.email}`);
    lines.push(`${prefix}_PASSWORD=${fixture.password}`);
    lines.push(`${prefix}_FULL_NAME=${fixture.fullName}`);
    lines.push(`${prefix}_ROLE=${fixture.role}`);
    lines.push(`${prefix}_VERIFIED=${fixture.isVerified ? 'true' : 'false'}`);
    lines.push(`${prefix}_PROFESSIONS=${fixture.professions.join(',')}`);
    lines.push('');
  }

  lines.push(envBlockEnd);
  return `${lines.join('\n')}\n`;
}

function writeEnvBlock(fixturesWithPasswords) {
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const block = buildEnvBlock(fixturesWithPasswords);
  const pattern = new RegExp(`${envBlockStart}[\\s\\S]*?${envBlockEnd}\\n?`, 'm');

  const nextContent = pattern.test(existing)
    ? existing.replace(pattern, block)
    : `${existing.replace(/\s*$/, '\n')}${block}`;

  writeFileSync(envPath, nextContent, 'utf8');
}

async function main() {
  const localEnv = loadSimpleEnvFile(envPath);
  const remoteHost = localEnv.REMOTE_DB_HOST || 'soc-yeremyan-net';
  const remoteDockerDir = localEnv.REMOTE_DOCKER_DIR || '/home/ubuntu/supabase-stack/supabase/docker';
  const remoteConfig = fetchRemoteConfig(remoteHost, remoteDockerDir);

  const supabase = createClient(remoteConfig.apiUrl, remoteConfig.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Resolving verifier profile...');
  const verifierProfileId = await getVerifierProfileId(supabase);
  console.log('Cleaning managed and legacy test users...');
  await deleteManagedAndLegacyUsers(supabase);

  const fixturesWithPasswords = [];
  for (const fixture of TEST_USER_FIXTURES) {
    console.log(`Creating fixture ${fixture.scope}:${fixture.username}...`);
    fixturesWithPasswords.push(await createFixtureUser(supabase, verifierProfileId, fixture));
  }

  writeEnvBlock(fixturesWithPasswords);

  console.log(`Seeded ${fixturesWithPasswords.length} curated test users.`);
  console.log('Credentials were written to .env.local inside the managed TEST_USER_CREDENTIALS block.');
}

try {
  await main();
} catch (error) {
  console.error('Test user sync failed.');
  console.error(error);
  process.exitCode = 1;
}
