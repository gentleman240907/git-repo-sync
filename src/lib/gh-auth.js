import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { promisify } from 'node:util';
import { logInfo } from './logger.js';

const execFileAsync = promisify(execFile);

/**
 * @param {string[]} args
 */
async function runGh(args) {
  try {
    const { stdout, stderr } = await execFileAsync('gh', args, {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    return [stdout, stderr].filter(Boolean).join('\n').trim();
  } catch (err) {
    const message = [
      `gh ${args.join(' ')} が失敗しました`,
      err.stderr?.toString?.() || err.message,
    ]
      .filter(Boolean)
      .join('\n');
    const wrapped = new Error(message);
    wrapped.code = 'CONFIG';
    throw wrapped;
  }
}

/**
 * @param {string} text
 * @returns {{ login: string, isActive: boolean }[]}
 */
export function parseGhAuthStatus(text) {
  const lines = text.split('\n');
  /** @type {{ login: string, isActive: boolean }[]} */
  const accounts = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/Logged in to github\.com account (\S+)/);
    if (!match) continue;

    const login = match[1];
    if (seen.has(login)) continue;
    seen.add(login);

    let isActive = false;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (/Logged in to github\.com account /.test(line)) break;
      if (line.includes('Active account: true')) {
        isActive = true;
        break;
      }
    }

    accounts.push({ login, isActive });
  }

  return accounts;
}

/**
 * @param {{ login: string, isActive: boolean }[]} accounts
 */
async function promptAccountSelection(accounts) {
  console.log('ログイン可能な GitHub アカウント:\n');
  accounts.forEach((account, index) => {
    const active = account.isActive ? '（有効）' : '';
    console.log(`  ${index + 1}. ${account.login}${active}`);
  });
  console.log('');

  const defaultIndex = Math.max(
    0,
    accounts.findIndex((a) => a.isActive),
  );

  const rl = createInterface({ input, output });
  const answer = await rl.question(
    `使用するアカウント番号 [1-${accounts.length}] (Enter = ${defaultIndex + 1}): `,
  );
  rl.close();

  const trimmed = answer.trim();
  const index = trimmed === '' ? defaultIndex : Number.parseInt(trimmed, 10) - 1;

  if (!Number.isInteger(index) || index < 0 || index >= accounts.length) {
    const err = new Error('アカウント選択が無効です');
    err.code = 'CONFIG';
    throw err;
  }

  return accounts[index];
}

/**
 * gh auth status を内部実行し、アカウント選択 UI のみ表示（識別用）。
 * git pull/fetch は .env の SOURCE_TOKEN / TARGET_TOKEN を使用。
 * @returns {Promise<{ login: string }>}
 */
export async function resolveGhAuthentication() {
  const statusText = await runGh(['auth', 'status']);
  const accounts = parseGhAuthStatus(statusText);
  if (accounts.length === 0) {
    const err = new Error(
      'GitHub アカウントが見つかりません。`gh auth login` でアカウントを追加してください。',
    );
    err.code = 'CONFIG';
    throw err;
  }

  const selected =
    accounts.length === 1
      ? accounts[0]
      : await promptAccountSelection(accounts);

  logInfo(`選択した GitHub アカウント: ${selected.login}（git 認証は .env トークンを使用）`);
  return { login: selected.login };
}
