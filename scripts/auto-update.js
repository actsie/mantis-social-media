#!/usr/bin/env node
/**
 * auto-update.js
 * Checks for a newer openclaw version and updates if available.
 * Runs daily at 3:00 AM PST via cron.
 */

const { spawnSync } = require('child_process');

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

const current = run('openclaw', ['--version']).stdout.trim();
const latest  = run('npm', ['view', 'openclaw', 'version']).stdout.trim();

if (!current || !latest) {
  console.error('Could not determine versions. Aborting.');
  process.exit(1);
}

console.log(`Current: ${current} | Latest: ${latest}`);

if (current === latest) {
  console.log('Already up to date. No action needed.');
  process.exit(0);
}

console.log(`Update available: ${current} → ${latest}. Installing...`);
const install = run('npm', ['install', '-g', 'openclaw@latest'], { timeout: 120000 });

if (install.status !== 0) {
  console.error('npm install failed:\n' + install.stderr);
  process.exit(1);
}

console.log('Install complete. Restarting gateway...');
const restart = run('openclaw', ['gateway', 'restart'], { timeout: 30000 });

const msg = restart.status === 0
  ? `✅ OpenClaw updated ${current} → ${latest} and gateway restarted.`
  : `⚠️ OpenClaw updated ${current} → ${latest} but gateway restart may need attention.`;

console.log(msg);

// Notify via Telegram
run('openclaw', [
  'message', 'send',
  '--channel', 'telegram',
  '--target', '6241290513',
  '--message', msg
]);
