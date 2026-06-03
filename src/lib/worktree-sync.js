import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { listWorktreeFiles } from './git.js';

/**
 * @param {string} filePath
 */
function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * @param {string} a
 * @param {string} b
 */
function filesContentEqual(a, b) {
  return hashFile(a) === hashFile(b);
}

/**
 * source ワークツリーを target にミラー（.git / .gitignore / 「.」始まりフォルダ配下を除く）
 * - source のみ: target から削除
 * - target にない、または内容が異なる: source から追加/更新
 *
 * @param {string} sourceDir
 * @param {string} destDir
 */
export async function syncWorktreeFromSource(sourceDir, destDir) {
  const [sourceFiles, targetFiles] = await Promise.all([
    listWorktreeFiles(sourceDir),
    listWorktreeFiles(destDir),
  ]);
  const sourceSet = new Set(sourceFiles);

  let deleted = 0;
  let added = 0;
  let updated = 0;

  for (const rel of targetFiles) {
    if (sourceSet.has(rel)) continue;
    rmSync(join(destDir, rel), { force: true });
    deleted += 1;
  }

  for (const rel of sourceFiles) {
    const srcPath = join(sourceDir, rel);
    const destPath = join(destDir, rel);

    if (!existsSync(destPath)) {
      mkdirSync(dirname(destPath), { recursive: true });
      cpSync(srcPath, destPath);
      added += 1;
      continue;
    }

    if (!filesContentEqual(srcPath, destPath)) {
      mkdirSync(dirname(destPath), { recursive: true });
      cpSync(srcPath, destPath, { force: true });
      updated += 1;
    }
  }

  return { added, updated, deleted };
}
