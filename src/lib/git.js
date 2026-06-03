import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getTokenForRepoPath } from './git-session.js';

const execFileAsync = promisify(execFile);

/**
 * GitHub HTTPS PAT を http.extraHeader（x-access-token basic）で付与。
 * credential.helper を無効化し、キーチェーンが .env トークンを上書きしないようにする。
 * @param {string} cwd
 * @param {string[]} args
 */
function gitArgsWithAuth(cwd, args) {
  const token = getTokenForRepoPath(cwd);
  if (!token) return args;
  const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
  return [
    '-c',
    'credential.helper=',
    '-c',
    `http.https://github.com/.extraHeader=AUTHORIZATION: basic ${basic}`,
    ...args,
  ];
}

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ env?: Record<string, string> }} [options]
 */
export async function git(cwd, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('git', gitArgsWithAuth(cwd, args), {
      cwd,
      env: { ...process.env, ...options.env, GIT_TERMINAL_PROMPT: '0' },
      maxBuffer: 50 * 1024 * 1024,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    const message = [
      `${cwd} で git ${args.join(' ')} が失敗しました`,
      err.stderr?.toString?.() || err.message,
    ]
      .filter(Boolean)
      .join('\n');
    const wrapped = new Error(message);
    wrapped.code = 'GIT';
    throw wrapped;
  }
}

/**
 * ローカルパスを検証し origin から fetch（clone はしない）
 * @param {string} dir
 */
export async function ensureLocalRepo(dir) {
  if (!existsSync(dir)) {
    const err = new Error(`ローカルパスが存在しません: ${dir}`);
    err.code = 'CONFIG';
    throw err;
  }
  if (!existsSync(join(dir, '.git'))) {
    const err = new Error(`Git リポジトリではありません: ${dir}`);
    err.code = 'CONFIG';
    throw err;
  }

  try {
    await git(dir, ['fetch', 'origin', '--prune']);
  } catch {
    // オフライン等で fetch が失敗する場合あり。pull 手順でエラーが表面化する
  }
}

/**
 * @param {string} cwd
 * @param {string} branch
 */
export async function checkoutPull(cwd, branch) {
  await git(cwd, ['checkout', branch]);
  await git(cwd, ['pull', 'origin', branch]);
}

/**
 * @param {string} cwd
 * @param {string} branch
 */
export async function checkoutPullMerge(cwd, branch) {
  await git(cwd, ['checkout', branch]);
  try {
    await git(cwd, ['pull', '--no-rebase', 'origin', branch]);
  } catch {
    await git(cwd, ['pull', 'origin', branch]);
  }
}

/**
 * @param {string} cwd
 * @param {string} baseBranch
 * @param {string} featureBranch
 */
export async function checkoutBasePullThenMergeFeature(
  cwd,
  baseBranch,
  featureBranch,
) {
  await checkoutPull(cwd, baseBranch);
  await git(cwd, ['checkout', featureBranch]);
  await git(cwd, ['merge', baseBranch, '--no-edit']);
}

/**
 * パスに「.」で始まるセグメント（.husky 等）を含むか
 * @param {string} relPath
 */
export function isDotPath(relPath) {
  return relPath.split('/').some((segment) => segment.startsWith('.'));
}

/**
 * 追跡済み + 未追跡（.gitignore 対象を除く）の相対パス一覧。
 * 「.」で始まるフォルダ配下のパスは含めない。
 * @param {string} cwd
 * @returns {Promise<string[]>}
 */
export async function listWorktreeFiles(cwd) {
  const { stdout } = await git(cwd, [
    'ls-files',
    '-z',
    '-co',
    '--exclude-standard',
  ]);
  if (!stdout) return [];
  return stdout.split('\0').filter((rel) => rel && !isDotPath(rel));
}

/**
 * @param {string} cwd
 * @returns {Promise<string>}
 */
export async function getHeadSha(cwd) {
  const { stdout } = await git(cwd, ['rev-parse', 'HEAD']);
  return stdout.trim();
}

/**
 * @param {string} sourceSha - source のフルコミット SHA
 * @returns {{ summary: string, description: string, prefix: string }}
 */
export function buildSyncCommitMessage(sourceSha) {
  const prefix = sourceSha.slice(0, 7);
  const line = `Sync: ${prefix}`;
  return { summary: line, description: line, prefix };
}

/**
 * @param {string} cwd
 * @param {string} branch
 */
export async function branchExists(cwd, branch) {
  try {
    await git(cwd, ['rev-parse', '--verify', branch]);
    return true;
  } catch {
    try {
      await git(cwd, ['rev-parse', '--verify', `origin/${branch}`]);
      return true;
    } catch {
      return false;
    }
  }
}
