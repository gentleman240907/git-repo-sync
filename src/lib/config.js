import { config as loadEnv } from 'dotenv';
import {
  getProfile,
  getProfileSyncMode,
  listBaseProfileIds,
  loadProfileDefinitions,
  listProfileIds,
} from './load-profiles.js';

loadEnv();

/**
 * @param {string} primary
 * @param {string} [legacy]
 */
function env(primary, legacy) {
  return process.env[primary]?.trim() || legacy?.trim() || '';
}

export function validateEnvTokens() {
  const sourceToken = env('SOURCE_TOKEN', process.env.REPO1_TOKEN);
  const targetToken = env('TARGET_TOKEN', process.env.REPO2_TOKEN);
  const missing = [];
  if (!sourceToken) missing.push('SOURCE_TOKEN');
  if (!targetToken) missing.push('TARGET_TOKEN');
  if (missing.length > 0) {
    const err = new Error(
      `.env に必須トークンがありません: ${missing.join(', ')}`,
    );
    err.code = 'CONFIG';
    throw err;
  }
}

/**
 * @param {import('./profile-types.js').RepoSideConfig} cfg
 * @param {'source' | 'target'} side
 */
function buildRepoSide(cfg, side) {
  const envKey = side === 'source' ? 'SOURCE_TOKEN' : 'TARGET_TOKEN';
  const token =
    cfg.token ||
    env(envKey, side === 'source' ? process.env.REPO1_TOKEN : process.env.REPO2_TOKEN);

  if (!token) {
    const err = new Error(`.env に ${envKey} がありません`);
    err.code = 'CONFIG';
    throw err;
  }

  return {
    id: side,
    repo: cfg.repo,
    baseBranch: cfg.baseBranch,
    token,
    path: cfg.path,
  };
}

/**
 * @param {string} profileId
 */
export async function loadConfig(profileId) {
  const profiles = await loadProfileDefinitions();
  const profile = getProfile(profiles, profileId);
  const syncMode = getProfileSyncMode(profile);

  const source = buildRepoSide(profile.source, 'source');
  const target = buildRepoSide(profile.target, 'target');

  return {
    profileId,
    profileLabel: profile.label || profileId,
    syncMode,
    source,
    target,
  };
}

export async function listBaseProfilesForCli() {
  const profiles = await loadProfileDefinitions();
  return listBaseProfileIds(profiles);
}

export async function listProfilesForCli() {
  const profiles = await loadProfileDefinitions();

  return listProfileIds(profiles).map((id) => {
    const profile = profiles[id];
    const syncMode = getProfileSyncMode(profile);
    return {
      id,
      label: profile.label || '',
      syncMode,
      source: profile.source.repo,
      target: profile.target.repo,
      sourcePath: profile.source.path,
      targetPath: profile.target.path,
      sourceBaseBranch: profile.source.baseBranch,
      targetBaseBranch: profile.target.baseBranch,
    };
  });
}
