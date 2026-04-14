import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');

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

function toRemotePathExpression(remotePath) {
  if (remotePath.startsWith('~/')) {
    return `"$HOME/${remotePath.slice(2)}"`;
  }

  return `'${String(remotePath).replace(/'/g, `'"'"'`)}'`;
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
    throw new Error('Could not resolve SERVICE_ROLE_KEY and API_EXTERNAL_URL from remote Supabase stack.');
  }

  return {
    serviceRoleKey: remoteVars.SERVICE_ROLE_KEY,
    apiUrl: remoteVars.API_EXTERNAL_URL,
  };
}

function isRandomAdminTestUsername(username) {
  const normalized = String(username || '').toLowerCase();
  return /^levela(_\d+)?$/.test(normalized) || /^levela_biz_\d+$/.test(normalized);
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

async function main() {
  const env = loadSimpleEnvFile(envPath);
  const remoteHost = env.REMOTE_DB_HOST;
  const remoteDockerDir = env.REMOTE_DOCKER_DIR;

  if (!remoteHost || !remoteDockerDir) {
    throw new Error('REMOTE_DB_HOST and REMOTE_DOCKER_DIR must be set in .env.local');
  }

  const { serviceRoleKey, apiUrl } = fetchRemoteConfig(remoteHost, remoteDockerDir);
  const supabase = createClient(apiUrl, serviceRoleKey);

  let softDeletedAuthCount = 0;
  for (const user of await listAllUsers(supabase)) {
    const username = user.user_metadata?.username || user.app_metadata?.username || '';
    if (!isRandomAdminTestUsername(username)) continue;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,deleted_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.id || profile.deleted_at) continue;
    const { error } = await supabase
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        deletion_reason: 'cleanup-random-test-user',
      })
      .eq('id', profile.id);
    if (error) throw error;
    softDeletedAuthCount += 1;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id,username')
    .limit(5000);

  if (profilesError) throw profilesError;

  let softDeletedProfileCount = 0;
  for (const profile of profiles || []) {
    if (!isRandomAdminTestUsername(profile.username)) continue;
    const { error } = await supabase
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        deletion_reason: 'cleanup-random-test-user',
      })
      .eq('id', profile.id);
    if (error) throw error;
    softDeletedProfileCount += 1;
  }

  console.log(
    JSON.stringify({
      softDeletedAuthCount,
      softDeletedProfileCount,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
