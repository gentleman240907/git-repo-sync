import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

loadEnv();

const CONFIG_FILENAME = 'sync.config.js';

/**
 * @param {string} primary
 * @param {string} [legacy]
 */
function env(primary, legacy) {
  return process.env[primary]?.trim() || legacy?.trim() || '';
}

/**
 * @param {import('./profile-types.js').RepoSideConfig} raw
 * @returns {import('./profile-types.js').RepoSideConfig}
 */
function normalizeRepoSide(raw) {
  return {
    repo: raw.repo,
    baseBranch: raw.baseBranch,
    path: raw.path ? resolve(raw.path) : '',
    token: raw.token,
  };
}

/**
 * @param {import('./profile-types.js').SyncProfile & {
 *   repo1?: import('./profile-types.js').RepoSideConfig,
 *   repo2?: import('./profile-types.js').RepoSideConfig,
 * }} raw
 * @returns {import('./profile-types.js').SyncProfile}
 */
export function normalizeProfile(raw) {
  const sourceRaw = raw.source ?? raw.repo1;
  const targetRaw = raw.target ?? raw.repo2;

  if (!sourceRaw?.repo || !targetRaw?.repo) {
    const err = new Error(
      'プロファイルに source と target（または旧形式 repo1 と repo2）を定義してください',
    );
    err.code = 'CONFIG';
    throw err;
  }

  /** @type {import('./profile-types.js').SyncProfile} */
  const profile = {
    label: raw.label,
    source: normalizeRepoSide(sourceRaw),
    target: normalizeRepoSide(targetRaw),
  };

  if (raw.baseBranch === true) {
    profile.baseBranch = true;
  }

  return profile;
}

/**
 * @returns {Record<string, import('./profile-types.js').SyncProfile> | null}
 */
function buildEnvFallbackProfiles() {
  const sourceRepo = env('SOURCE_REPO', process.env.REPO1_REPO);
  const targetRepo = env('TARGET_REPO', process.env.REPO2_REPO);
  const sourcePath = env('SOURCE_PATH', process.env.REPO1_PATH);
  const targetPath = env('TARGET_PATH', process.env.REPO2_PATH);
  if (!sourceRepo || !targetRepo || !sourcePath || !targetPath) return null;

  return {
    env: normalizeProfile({
      label: '.env から（SOURCE_* / TARGET_*）',
      baseBranch: true,
      source: {
        repo: sourceRepo,
        baseBranch: env('SOURCE_BASE_BRANCH', process.env.REPO1_BASE_BRANCH),
        path: sourcePath,
      },
      target: {
        repo: targetRepo,
        baseBranch: env('TARGET_BASE_BRANCH', process.env.REPO2_BASE_BRANCH),
        path: targetPath,
      },
    }),
  };
}

/**
 * @returns {Promise<Record<string, import('./profile-types.js').SyncProfile>>}
 */
export async function loadProfileDefinitions() {
  const configPath = resolve(process.cwd(), CONFIG_FILENAME);

  if (existsSync(configPath)) {
    const mod = await import(pathToFileURL(configPath).href);
    if (!mod.profiles || typeof mod.profiles !== 'object') {
      const err = new Error(`${CONFIG_FILENAME} は "profiles" オブジェクトを export する必要があります`);
      err.code = 'CONFIG';
      throw err;
    }

    /** @type {Record<string, import('./profile-types.js').SyncProfile>} */
    const normalized = {};
    for (const [id, raw] of Object.entries(mod.profiles)) {
      normalized[id] = normalizeProfile(raw);
    }
    return normalized;
  }

  const fallback = buildEnvFallbackProfiles();
  if (fallback) return fallback;

  const err = new Error(
    `${CONFIG_FILENAME} がありません。sync.config.example.js を ${CONFIG_FILENAME} にコピーし、プロファイルを定義してください。`,
  );
  err.code = 'CONFIG';
  throw err;
}

/**
 * @param {Record<string, import('./profile-types.js').SyncProfile>} profiles
 */
export function listProfileIds(profiles) {
  return Object.keys(profiles).sort();
}

/**
 * @param {string} path
 * @param {'source' | 'target'} side
 * @param {string} profileId
 */
function assertLocalRepoPath(path, side, profileId) {
  if (!path) {
    const err = new Error(
      `プロファイル "${profileId}" は sync.config.js で ${side}.path（ローカル絶対パス）を定義してください`,
    );
    err.code = 'CONFIG';
    throw err;
  }

  if (!existsSync(path)) {
    const err = new Error(`ローカルパスが存在しません（${side}）: ${path}`);
    err.code = 'CONFIG';
    throw err;
  }

  if (!existsSync(join(path, '.git'))) {
    const err = new Error(`Git リポジトリではありません（${side}）: ${path}`);
    err.code = 'CONFIG';
    throw err;
  }
}

/**
 * @param {Record<string, import('./profile-types.js').SyncProfile>} profiles
 * @param {string} profileId
 */
export function getProfile(profiles, profileId) {
  const profile = profiles[profileId];
  if (!profile) {
    const available = listProfileIds(profiles).join(', ');
    const err = new Error(
      `不明なプロファイル "${profileId}"。利用可能: ${available || '（なし）'}`,
    );
    err.code = 'CONFIG';
    throw err;
  }

  if (!profile.source?.repo || !profile.target?.repo) {
    const err = new Error(
      `プロファイル "${profileId}" は source.repo と target.repo を定義してください`,
    );
    err.code = 'CONFIG';
    throw err;
  }

  if (!profile.source?.baseBranch || !profile.target?.baseBranch) {
    const err = new Error(
      `プロファイル "${profileId}" は source.baseBranch と target.baseBranch を定義してください`,
    );
    err.code = 'CONFIG';
    throw err;
  }

  assertLocalRepoPath(profile.source.path, 'source', profileId);
  assertLocalRepoPath(profile.target.path, 'target', profileId);

  return profile;
}

/**
 * @param {import('./profile-types.js').SyncProfile} profile
 * @returns {'base' | 'branch'}
 */
export function getProfileSyncMode(profile) {
  return profile.baseBranch === true ? 'base' : 'branch';
}

/**
 * @param {Record<string, import('./profile-types.js').SyncProfile>} profiles
 * @returns {string[]}
 */
export function listBaseProfileIds(profiles) {
  return listProfileIds(profiles).filter((id) => profiles[id].baseBranch === true);
}
