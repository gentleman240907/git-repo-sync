# Git Repository Sync — 機能仕様書

| バージョン | 1.9.0 |

## 概要

- **ローカルパスのみ使用**: `sync.config.js` の `source.path`, `target.path`（絶対パス、必須）
- 自動 clone（`.repos`）**非対応**
- プロファイル `baseBranch: true` → FR-01 / 省略 → FR-02 + `--branch`
- `.env`: トークンのみ

## プロファイルスキーマ

```javascript
source: { repo: 'owner/name', baseBranch: 'develop', path: '/abs/path' },
target: { repo: 'other/name', baseBranch: 'dev', path: '/abs/path' },
```

## 範囲

同期は **source ワークツリー基準**で target を合わせる（`.git` 除く）:

- source にない → target から削除
- source のみ → target に追加
- 両方にあるが内容が異なる → target を更新

**FR-01 (baseBranch: true)** 同期後 stdout に `Sync: {SHA7}` 1 行のみ出力（コミットなし）。**FR-02** は該当出力なし。

## CLI

| `--profile` | 単一プロファイル |
| `--all-base-branch` | `baseBranch: true` プロファイル一括同期（`--profile`・`--branch` 不可） |

## 認証

同期前にアカウント選択（`gh auth status` は内部参照のみ、画面非表示）。  
`git pull`/`fetch`: `.env` の `SOURCE_TOKEN` / `TARGET_TOKEN`（リポジトリ側ごと）。

## 変更履歴

| 1.9.0 | `gh` アカウント選択後に同期 |
| 1.8.0 | `--all-base-branch` |
| 1.7.1 | FR-01 コミット削除、`Sync: {SHA7}` 出力のみ |
| 1.7.0 | FR-01 target コミット（後に削除） |
| 1.6.0 | 増分同期（削除・追加・更新）、全体 rm+コピー削除 |
| 1.5.1 | commit/push 削除（コピーのみ） |
| 1.5.0 | `.repos` clone 削除、`path` 必須 |
