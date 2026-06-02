/**
 * @typedef {object} RepoSideConfig
 * @property {string} repo - owner/name（ログ・識別用）
 * @property {string} baseBranch
 * @property {string} path - ローカル clone 絶対パス（必須）
 * @property {string} [token] - .env トークンの代わりに使用する場合
 */

/**
 * @typedef {object} SyncProfile
 * @property {string} [label]
 * @property {true} [baseBranch] - true: 基準ブランチ同期
 * @property {RepoSideConfig} source
 * @property {RepoSideConfig} target
 */

export {};
