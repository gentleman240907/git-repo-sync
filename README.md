# git-repo-sync

**source → target** ローカル Git リポジトリ同期 CLI。

- リポジトリ・基準ブランチ・パス: **`sync.config.js`**（`source.path`, `target.path` **絶対パス必須**）
- `.repos` 自動 clone **なし** — 既に clone 済みのディレクトリのみ使用
- **ワークツリー同期** — source 基準で target に追加・更新・削除
- **基準ブランチプロファイル** — 同期後、最終行に `Sync: {source HEAD 先頭 7 文字}` を出力（コミットなし）
- **指定ブランチプロファイル** — コミット・該当出力なし
- **GitHub アカウント** — 同期前にログインアカウント一覧から選択（`gh` CLI）
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
| `baseBranch` 省略 | `--branch` 指定ブランチ同期 |

## 要件

- [GitHub CLI](https://cli.github.com/)（`gh`）のインストールと `gh auth login` によるアカウント登録

## 使い方

同期コマンド実行時、ログイン済み GitHub アカウント一覧のみ表示し、アカウントを選びます。  
実際の `git pull`/`fetch` 認証は **`.env` トークン**を使用します（source → `SOURCE_TOKEN`, target → `TARGET_TOKEN`）。

```bash
node src/index.js --list-profiles

node src/index.js --profile dev-to-py-admin-panel

# baseBranch: true プロファイル一括（--profile, --branch と併用不可）
node src/index.js --all-base-branch

node src/index.js --profile branch-to-s-admin-panel --branch feature/foo
```

`npm run sync -- --profile ...` も同様（`--` は npm 引数渡し用）。

[spec.md](./spec.md)
