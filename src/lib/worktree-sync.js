import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

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
 * @param {string} root
 * @param {string} [relative]
 * @returns {{ files: string[], dirs: string[] }}
 */
function walkWorktree(root, relative = '') {
  /** @type {string[]} */
  const files = [];
  /** @type {string[]} */
  const dirs = [];

  const absDir = relative ? join(root, relative) : root;
  for (const name of readdirSync(absDir)) {
    if (name === '.git') continue;

    const rel = relative ? `${relative}/${name}` : name;
    const abs = join(root, rel);
    const stat = statSync(abs);

    if (stat.isDirectory()) {
      dirs.push(rel);
      const nested = walkWorktree(root, rel);
      files.push(...nested.files);
      dirs.push(...nested.dirs);
    } else {
      files.push(rel);
    }
  }

  return { files, dirs };
}

/**
 * source ワークツリーを target にミラー（.git 除く）
 * - source のみ: target から削除
 * - target にない、または内容が異なる: source から追加/更新
 *
 * @param {string} sourceDir
 * @param {string} destDir
 */
export function syncWorktreeFromSource(sourceDir, destDir) {
  const source = walkWorktree(sourceDir);
  const target = walkWorktree(destDir);
  const sourceFiles = new Set(source.files);
  const sourceDirs = new Set(source.dirs);

  let deleted = 0;
  let added = 0;
  let updated = 0;

  for (const rel of target.files) {
    if (sourceFiles.has(rel)) continue;
    rmSync(join(destDir, rel), { force: true });
    deleted += 1;
  }

  const targetDirsByDepth = [...target.dirs].sort(
    (a, b) => b.split('/').length - a.split('/').length,
  );
  for (const rel of targetDirsByDepth) {
    if (sourceDirs.has(rel)) continue;
    const destPath = join(destDir, rel);
    if (existsSync(destPath)) {
      rmSync(destPath, { recursive: true, force: true });
      deleted += 1;
    }
  }

  for (const rel of source.files) {
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

  for (const rel of source.dirs) {
    const destPath = join(destDir, rel);
    if (!existsSync(destPath)) {
      mkdirSync(destPath, { recursive: true });
    }
  }

  return { added, updated, deleted };
}
