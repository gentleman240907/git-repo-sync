/**
 * 各 source/target にローカル clone 絶対パス（path）必須。
 * .repos 自動 clone は使用しません。
 */

/** @type {Record<string, import('./src/lib/profile-types.js').SyncProfile>} */
export const profiles = {
  'dev-to-py-admin-panel': {
    label: 'admin-panel-nextjs: Scalyx → gentleman',
    baseBranch: true,
    source: {
      repo: 'Scalyx-ai/admin-panel-nextjs',
      baseBranch: 'develop',
      path: '/absolute/path/to/Scalyx-ai-admin-panel-nextjs',
    },
    target: {
      repo: 'gentleman240907/admin-panel-nextjs',
      baseBranch: 'dev',
      path: '/absolute/path/to/gentleman240907-admin-panel-nextjs',
    },
  },

  'branch-to-s-admin-panel': {
    label: 'admin-panel-nextjs: gentleman → Scalyx（指定ブランチ）',
    source: {
      repo: 'gentleman240907/admin-panel-nextjs',
      baseBranch: 'dev',
      path: '/absolute/path/to/gentleman240907-admin-panel-nextjs',
    },
    target: {
      repo: 'Scalyx-ai/admin-panel-nextjs',
      baseBranch: 'develop',
      path: '/absolute/path/to/Scalyx-ai-admin-panel-nextjs',
    },
  },
};
