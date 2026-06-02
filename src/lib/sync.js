import { compareTrackedTrees } from './compare.js';
import {
  branchExists,
  checkoutBasePullThenMergeFeature,
  checkoutPull,
  checkoutPullMerge,
  buildSyncCommitMessage,
  ensureLocalRepo,
  getHeadSha,
} from './git.js';
import { clearRepoTokens, registerRepoToken } from './git-session.js';
import { logInfo, logStep } from './logger.js';
import { syncWorktreeFromSource } from './worktree-sync.js';

/**
 * @param {{ id: string, path: string }} side
 */
async function prepareSide(side) {
  logStep(side.id, null, `ローカルリポジトリを使用: ${side.path}`);
  await ensureLocalRepo(side.path);
}

/**
 * @param {Awaited<ReturnType<import('./config.js').loadConfig>>} config
 */
export async function prepareRepos(config) {
  const { source, target } = config;
  const modeLabel = config.syncMode === 'base' ? '基準ブランチ' : '指定ブランチ';

  registerRepoToken(source.path, source.token);
  registerRepoToken(target.path, target.token);

  logInfo(
    `プロファイル: ${config.profileId} — ${config.profileLabel} [${modeLabel}]（${source.repo} → ${target.repo}）`,
  );
  await prepareSide(source);
  await prepareSide(target);
}

export function clearRepoAuth() {
  clearRepoTokens();
}

/**
 * @param {Awaited<ReturnType<import('./config.js').loadConfig>>} config
 * @param {string} sourceBranch
 * @param {string} targetBranch
 */
async function syncTargetFromSource(config, sourceBranch, targetBranch) {
  const { source, target } = config;

  logStep(
    target.id,
    targetBranch,
    `source（${sourceBranch}）からワークツリーを同期 — 追加/更新/削除`,
  );
  const stats = syncWorktreeFromSource(source.path, target.path);

  logInfo(`target 反映: 追加 ${stats.added}、更新 ${stats.updated}、削除 ${stats.deleted}`);
}

/**
 * FR-01: 基準ブランチ同期（source → target）
 * @param {Awaited<ReturnType<import('./config.js').loadConfig>>} config
 */
export async function syncBase(config) {
  const { source, target } = config;

  await prepareRepos(config);

  logStep(source.id, source.baseBranch, 'チェックアウトして pull');
  await checkoutPull(source.path, source.baseBranch);

  const sourceSha = await getHeadSha(source.path);

  logStep(target.id, target.baseBranch, 'チェックアウトして pull');
  await checkoutPull(target.path, target.baseBranch);

  await syncTargetFromSource(config, source.baseBranch, target.baseBranch);

  const { summary } = buildSyncCommitMessage(sourceSha);
  console.log(summary);
}

/**
 * FR-02: 指定ブランチ同期（source → target）
 * @param {Awaited<ReturnType<import('./config.js').loadConfig>>} config
 * @param {string} branch
 */
export async function syncBranch(config, branch) {
  const { source, target } = config;
  const isSourceBase = branch === source.baseBranch;
  const isTargetBase = branch === target.baseBranch;

  if (isSourceBase && isTargetBase) {
    logInfo(
      `指定ブランチ "${branch}" は両側の基準ブランチと同一です。基準ブランチ同期を実行します。`,
    );
    return syncBase(config);
  }

  await prepareRepos(config);

  for (const side of [source, target]) {
    const exists = await branchExists(side.path, branch);
    if (!exists) {
      throw Object.assign(
        new Error(
          `ブランチ "${branch}" は ${side.id} に存在しません（${config.profileId}）`,
        ),
        { code: 'GIT' },
      );
    }
  }

  logStep(source.id, source.baseBranch, 'チェックアウトして pull（事前確認）');
  await checkoutPull(source.path, source.baseBranch);

  logStep(target.id, target.baseBranch, 'チェックアウトして pull（事前確認）');
  await checkoutPull(target.path, target.baseBranch);

  const comparison = await compareTrackedTrees(source.path, target.path);

  if (comparison.diffCount > 0) {
    const err = new Error(
      `比較: ${comparison.total} ファイル中 ${comparison.diffCount} ファイルが異なります。`,
    );
    err.code = 'BASE_MISMATCH';
    err.diffFiles = comparison.diffFiles;
    throw err;
  }

  logInfo('基準ブランチの内容が一致しました。指定ブランチ同期を続行します。');

  logStep(source.id, branch, 'チェックアウト、pull、マージ');
  await checkoutPullMerge(source.path, branch);

  logStep(target.id, branch, 'チェックアウト、pull、マージ');
  await checkoutPullMerge(target.path, branch);

  logStep(target.id, branch, '基準ブランチをフィーチャーブランチにマージ');
  await checkoutBasePullThenMergeFeature(target.path, target.baseBranch, branch);

  logStep(source.id, branch, 'コピー元のチェックアウト');
  await checkoutPull(source.path, branch);

  await syncTargetFromSource(config, branch, branch);

  logInfo(
    `同期完了 [${config.profileId}]: source → target（指定ブランチ "${branch}"）`,
  );
}
