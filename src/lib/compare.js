import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listTrackedFiles } from './git.js';

/**
 * @param {string} filePath
 */
function hashFile(filePath) {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * 2 つのチェックアウト間で追跡ファイルの内容を比較
 * @param {string} sourceDir
 * @param {string} destDir
 */
export async function compareTrackedTrees(sourceDir, destDir) {
  const sourceFiles = await listTrackedFiles(sourceDir);
  const destFiles = await listTrackedFiles(destDir);
  const allPaths = new Set([...sourceFiles, ...destFiles]);

  const diffFiles = [];

  for (const relPath of allPaths) {
    const sourcePath = join(sourceDir, relPath);
    const destPath = join(destDir, relPath);
    const sourceExists = existsSync(sourcePath);
    const destExists = existsSync(destPath);

    if (!sourceExists || !destExists) {
      diffFiles.push(relPath);
      continue;
    }

    const sourceHash = hashFile(sourcePath);
    const destHash = hashFile(destPath);
    if (sourceHash !== destHash) {
      diffFiles.push(relPath);
    }
  }

  return {
    total: allPaths.size,
    diffCount: diffFiles.length,
    diffFiles,
  };
}
