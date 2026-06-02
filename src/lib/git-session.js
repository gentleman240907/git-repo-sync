import { resolve } from 'node:path';

/** @type {Map<string, string>} */
const tokenByRepoPath = new Map();

/**
 * @param {string} repoPath
 * @param {string} token
 */
export function registerRepoToken(repoPath, token) {
  tokenByRepoPath.set(resolve(repoPath), token);
}

/**
 * @param {string} cwd
 * @returns {string | undefined}
 */
export function getTokenForRepoPath(cwd) {
  const resolved = resolve(cwd);
  if (tokenByRepoPath.has(resolved)) {
    return tokenByRepoPath.get(resolved);
  }
  for (const [repoPath, token] of tokenByRepoPath) {
    if (resolved.startsWith(`${repoPath}/`)) {
      return token;
    }
  }
  return undefined;
}

export function clearRepoTokens() {
  tokenByRepoPath.clear();
}
