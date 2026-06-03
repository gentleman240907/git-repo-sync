# git-repo-sync

**source → target** ローカル Git リポジトリ同期 CLI。

- リポジトリ・基準ブランチ・パス: **`sync.config.js`**（`source.path`, `target.path` **絶対パス必須**）
- `.repos` 自動 clone **なし** — 既に clone 済みのディレクトリのみ使用
- **ワークツリー同期** — source 基準で target に追加・更新・削除（`.gitignore` および `.` で始まるフォルダ配下は除外）
- **基準ブランチプロファイル** — 同期後、最終行に `Sync: {source HEAD 先頭 7 文字}` を出力（コミットなし）
- **指定ブランチプロファイル** — コミット・該当出力なし
- **トークン** — `.env` の `SOURCE_TOKEN` / `TARGET_TOKEN`（source・target それぞれ pull/fetch）

## `sync.config.js` 例

```javascript
'dev-to-py-admin-panel': {
  baseBranch: true,
  source: {
    repo: 'Scalyx-ai/admin-panel-nextjs',
    baseBranch: 'develop',
    path: '/Users/you/work/Scalyx-ai-admin-panel-nextjs',
  },
  target: {
    repo: 'gentleman240907/admin-panel-nextjs',
    baseBranch: 'dev',
    path: '/Users/you/work/gentleman-admin-panel-nextjs',
  },
},
```

| フィールド | 説明 |
|------|------|
| `path` | ローカル clone **絶対パス**（必須） |
| `baseBranch: true` | 基準ブランチ同期 |
| `baseBranch` 省略 | `--source-branch` / `--target-branch` で指定ブランチ同期 |

## 要件

- `.env` に `SOURCE_TOKEN` / `TARGET_TOKEN`（各リポジトリへの `git pull`/`fetch` 用 PAT）

## 使い方

`git pull`/`fetch` の認証は **`.env` トークン**のみ使用します（source → `SOURCE_TOKEN`, target → `TARGET_TOKEN`）。

```bash
node src/index.js --list-profiles

node src/index.js --profile dev-to-py-admin-panel

# baseBranch: true プロファイル一括（--profile, --source-branch / --target-branch と併用不可）
node src/index.js --all-base-branch

# source / target でブランチ名が異なる場合も指定可能
node src/index.js --profile branch-to-s-admin-panel \
  --source-branch feature/foo \
  --target-branch feature/foo
```

`npm run sync -- --profile ...` も同様（`--` は npm 引数渡し用）。

[spec.md](./spec.md)
