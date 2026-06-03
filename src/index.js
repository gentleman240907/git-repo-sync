#!/usr/bin/env node

import { parseArgs } from 'node:util';
import {
  listBaseProfilesForCli,
  loadConfig,
  listProfilesForCli,
} from './lib/config.js';
import { validateEnvTokens } from './lib/config.js';
import { logError, logInfo } from './lib/logger.js';
import { clearRepoAuth, syncBase, syncBranch } from './lib/sync.js';

const EXIT = {
  OK: 0,
  CONFIG: 1,
  BASE_MISMATCH: 2,
  GIT: 3,
};

function printUsage() {
  console.log(`使い方:
  git-repo-sync --profile <id>
  git-repo-sync --profile <id> --source-branch <name> --target-branch <name>
  git-repo-sync --all-base-branch
  git-repo-sync --list-profiles

オプション:
  --source-branch     source 側の同期対象ブランチ名（指定ブランチプロファイルで必須）
  --target-branch     target 側の同期対象ブランチ名（指定ブランチプロファイルで必須）
  --all-base-branch   baseBranch: true の全プロファイルで基準ブランチ同期
                      （--profile および --source-branch / --target-branch と併用不可）

設定:
  sync.config.js   source/target リポジトリ、baseBranch、path（ローカル clone 絶対パス）
  .env             SOURCE_TOKEN, TARGET_TOKEN（リポジトリ側ごとの git pull/fetch）
`);
}

/**
 * @param {unknown} err
 */
function exitCodeFor(err) {
  if (err && typeof err === 'object' && 'code' in err) {
    if (err.code === 'CONFIG') return EXIT.CONFIG;
    if (err.code === 'BASE_MISMATCH') return EXIT.BASE_MISMATCH;
    if (err.code === 'GIT') return EXIT.GIT;
  }
  return EXIT.GIT;
}

async function printProfileList() {
  const profiles = await listProfilesForCli();
  if (profiles.length === 0) {
    console.log('sync.config.js にプロファイルが定義されていません');
    return;
  }
  console.log('利用可能なプロファイル:\n');
  for (const p of profiles) {
    const label = p.label ? ` — ${p.label}` : '';
    const type =
      p.syncMode === 'base'
        ? `基準ブランチ (${p.sourceBaseBranch} → ${p.targetBaseBranch})`
        : '指定ブランチ (--source-branch と --target-branch 必須)';
    console.log(`  ${p.id}${label}`);
    console.log(`    ${p.source} → ${p.target}`);
    console.log(`    source.path: ${p.sourcePath}`);
    console.log(`    target.path: ${p.targetPath}`);
    console.log(`    動作: ${type}`);
    console.log('');
  }
}

async function syncAllBaseBranchProfiles() {
  const profileIds = await listBaseProfilesForCli();
  if (profileIds.length === 0) {
    const err = new Error(
      'sync.config.js に baseBranch: true のプロファイルがありません',
    );
    err.code = 'CONFIG';
    throw err;
  }

  logInfo(`基準ブランチ同期対象 ${profileIds.length} 件: ${profileIds.join(', ')}`);

  for (const profileId of profileIds) {
    logInfo(`--- ${profileId} ---`);
    const config = await loadConfig(profileId);
    await syncBase(config);
  }
}

/**
 * @param {() => Promise<void>} run
 */
async function withSyncAuth(run) {
  validateEnvTokens();
  try {
    await run();
  } finally {
    clearRepoAuth();
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      profile: { type: 'string', short: 'p' },
      'source-branch': { type: 'string' },
      'target-branch': { type: 'string' },
      'all-base-branch': { type: 'boolean', default: false },
      'list-profiles': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help || positionals.includes('help')) {
    printUsage();
    process.exit(EXIT.OK);
  }

  if (values['list-profiles']) {
    await printProfileList();
    process.exit(EXIT.OK);
  }

  const allBaseBranch = values['all-base-branch'];
  const profileId = values.profile?.trim();
  const sourceBranchArg = values['source-branch']?.trim();
  const targetBranchArg = values['target-branch']?.trim();
  const hasBranchArgs = Boolean(sourceBranchArg || targetBranchArg);

  if (allBaseBranch) {
    if (profileId) {
      const err = new Error('--all-base-branch は --profile と併用できません');
      err.code = 'CONFIG';
      throw err;
    }
    if (hasBranchArgs) {
      const err = new Error(
        '--all-base-branch は --source-branch / --target-branch と併用できません',
      );
      err.code = 'CONFIG';
      throw err;
    }
    await withSyncAuth(() => syncAllBaseBranchProfiles());
    return;
  }

  if (!profileId) {
    printUsage();
    const err = new Error(
      '必須: --profile <id> または --all-base-branch（--list-profiles 参照）',
    );
    err.code = 'CONFIG';
    throw err;
  }

  await withSyncAuth(async () => {
    const config = await loadConfig(profileId);

    if (config.syncMode === 'base') {
      if (hasBranchArgs) {
        const err = new Error(
          `プロファイル "${profileId}" は基準ブランチプロファイル（baseBranch: true）です。--source-branch / --target-branch は指定しないでください。`,
        );
        err.code = 'CONFIG';
        throw err;
      }
      await syncBase(config);
      return;
    }

    if (!sourceBranchArg || !targetBranchArg) {
      const err = new Error(
        `プロファイル "${profileId}" には --source-branch <name> と --target-branch <name> の両方が必要です`,
      );
      err.code = 'CONFIG';
      throw err;
    }

    await syncBranch(config, sourceBranchArg, targetBranchArg);
  });
}

main().catch((err) => {
  if (err?.code === 'BASE_MISMATCH') {
    logError(err.message);
    if (err.diffFiles?.length) {
      const preview = err.diffFiles.slice(0, 10);
      console.error(`差分ファイル（先頭 ${preview.length} 件）:`);
      for (const f of preview) {
        console.error(`  - ${f}`);
      }
      if (err.diffFiles.length > preview.length) {
        console.error(`  ... 他 ${err.diffFiles.length - preview.length} 件`);
      }
    }
    process.exit(EXIT.BASE_MISMATCH);
  }

  logError('git-repo-sync が失敗しました', err);
  process.exit(exitCodeFor(err));
});
