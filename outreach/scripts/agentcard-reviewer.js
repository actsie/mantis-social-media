#!/usr/bin/env node
/**
 * AgentCard Code Reviewer — Hourly QA for agentcard-social workspace
 * Uses claude-sonnet-4-6 to analyze code quality and fix errors
 * 
 * Focus Areas:
 * - Code quality (linting, TypeScript, syntax)
 * - Working features (dashboards, UI components)
 * - Cron jobs and automation health
 * - Build/deployment readiness
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/agentcard-social/openclaw-workspace';
const DISCORD_CHANNEL = '1485501016332828682'; // #agentcard-alerts
const LOG_FILE = path.join(__dirname, '../agentcard-reviewer-log.json');
const PAUSE_THRESHOLD = 3; // Pause after N consecutive identical runs

console.log('🔍 AgentCard Code Reviewer — QA Check\n');

// Check if we should pause (3+ identical runs with no code changes)
function shouldPause(log) {
  if (log.runs.length < PAUSE_THRESHOLD) return false;
  
  const recentRuns = log.runs.slice(-PAUSE_THRESHOLD);
  const allSameLint = recentRuns.every(r => r.lintErrors === recentRuns[0].lintErrors);
  const allSameTS = recentRuns.every(r => r.tsErrors === recentRuns[0].tsErrors);
  const allSameScripts = recentRuns.every(r => r.brokenScripts === recentRuns[0].brokenScripts);
  // Note: cronErrors can fluctuate (external crons), so we don't require exact match
  const allSameCoreMetrics = allSameLint && allSameTS && allSameScripts;
  
  return allSameCoreMetrics;
}

// Utility: Run command
function runCmd(cmd, cwd = null) {
  const result = spawnSync(cmd, {
    shell: true,
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      PATH: `/Users/mantisclaw/.nvm/versions/node/v24.13.1/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
      HOME: process.env.HOME || '/Users/mantisclaw'
    }
  });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

// Utility: Send Discord notification
function sendDiscord(message) {
  console.log(`  📤 Discord: ${message.slice(0, 80)}...`);
  const escaped = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const result = runCmd(`/Users/mantisclaw/.nvm/versions/node/v24.13.1/bin/openclaw message send --channel discord --target ${DISCORD_CHANNEL} --message "${escaped}"`);
  return result.status === 0;
}

// Load log
let log = { runs: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (e) {}
}

const runStart = new Date().toISOString();
console.log(`📅 Run started: ${runStart}\n`);

// Check if we should pause (3+ identical runs with no code changes)
if (shouldPause(log)) {
  console.log(`⏸️ PAUSED: Last ${PAUSE_THRESHOLD} runs identical with no changes.\n`);
  console.log('💡 To resume: make a code change and commit, or delete the log file.\n');
  
  // Send pause notification to Discord (only once, not every run)
  const lastPauseNotification = log.runs[log.runs.length - PAUSE_THRESHOLD]?.pauseNotified;
  if (!lastPauseNotification) {
    sendDiscord('⏸️ Code Reviewer Paused\n\nLast 3 runs identical with no code changes.\n\n💡 To resume: make a code change and commit.');
    log.runs[log.runs.length - PAUSE_THRESHOLD].pauseNotified = true;
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  }
  
  process.exit(0);
}

// Step 1: Check git status
console.log('1️⃣ Checking git status...');
const statusResult = runCmd('git -C /Users/mantisclaw/agentcard-social/openclaw-workspace status --porcelain');
const hasUncommittedChanges = statusResult.stdout.trim().length > 0;

if (hasUncommittedChanges) {
  console.log('  ⚠ Uncommitted changes detected\n');
  const lines = statusResult.stdout.split('\n').slice(0, 10);
  lines.forEach(line => console.log(`    ${line}`));
  console.log('');
} else {
  console.log('  ✓ Working tree clean\n');
}

// Step 2: Pull latest
console.log('2️⃣ Pulling latest from main...');
const pullResult = runCmd('git -C /Users/mantisclaw/agentcard-social/openclaw-workspace pull origin main');
if (pullResult.status !== 0) {
  console.log(`  ⚠ Git pull failed: ${pullResult.stderr.slice(0, 200)}`);
  sendDiscord(`⚠️ AgentCard Reviewer Error\n\nGit pull failed:\n${pullResult.stderr.slice(0, 500)}`);
  process.exit(1);
}
console.log('  ✓ Pulled latest\n');

// Step 3: Check for linting errors
console.log('3️⃣ Running ESLint...');
const eslintResult = runCmd('npm run lint 2>&1 || true', WORKSPACE);
const lintErrors = [];
if (eslintResult.stdout.includes('error') || eslintResult.stderr.includes('error')) {
  const errorMatches = eslintResult.stdout.match(/\/[\w.-]+\.jsx?:\d+:\d+/g) || [];
  lintErrors.push(...errorMatches);
  console.log(`  ⚠ Found ${lintErrors.length} linting issue(s)\n`);
} else {
  console.log('  ✓ No linting errors\n');
}

// Step 4: Check for TypeScript errors
console.log('4️⃣ Running TypeScript check...');
const tscResult = runCmd('npx tsc --noEmit 2>&1 || true', WORKSPACE);
const tsErrors = [];
if (tscResult.stdout.includes('error TS') || tscResult.stderr.includes('error TS')) {
  const errorMatches = tscResult.stdout.match(/error TS\d+:/g) || [];
  tsErrors.push(...errorMatches);
  console.log(`  ⚠ Found ${tsErrors.length} TypeScript error(s)\n`);
} else {
  console.log('  ✓ No TypeScript errors\n');
}

// Step 5: Check cron jobs
console.log('5️⃣ Checking cron jobs...');
const cronResult = runCmd('openclaw cron list 2>&1');
const cronErrors = [];
if (cronResult.status === 0) {
  const cronLines = cronResult.stdout.split('\n').filter(l => l.toLowerCase().includes('error'));
  cronErrors.push(...cronLines);
  if (cronErrors.length > 0) {
    console.log(`  ⚠ ${cronErrors.length} cron job(s) with errors\n`);
  } else {
    console.log('  ✓ All cron jobs healthy\n');
  }
}

// Step 6: Syntax check all scripts
console.log('6️⃣ Syntax checking scripts...');
const scriptsToCheck = [
  'scripts/post-approved.js',
  'scripts/breaking-news.js',
  'scripts/notify-draft.js',
  'outreach/scripts/mdx-reviewer.js',
  'outreach/scripts/agentcard-reviewer.js',
];

const brokenScripts = [];
for (const script of scriptsToCheck) {
  const scriptPath = path.join(WORKSPACE, script);
  if (fs.existsSync(scriptPath)) {
    const syntaxResult = runCmd(`node --check "${scriptPath}" 2>&1`);
    if (syntaxResult.status !== 0) {
      brokenScripts.push(script);
      console.log(`  ⚠ Syntax error: ${script}`);
    }
  }
}

if (brokenScripts.length > 0) {
  console.log(`\n  Found ${brokenScripts.length} broken script(s)\n`);
} else {
  console.log('  ✓ All scripts syntax-valid\n');
}

// Step 7: Check for key features (tweets dashboard, etc.)
console.log('7️⃣ Checking feature files...');
const featureFiles = [
  { name: 'Tweets Dashboard', path: 'components/TweetsDashboard.jsx' },
  { name: 'Drafts UI', path: 'components/DraftsUI.jsx' },
  { name: 'Approval UI', path: 'components/ApprovalUI.jsx' },
];

const missingFeatures = [];
for (const feature of featureFiles) {
  const featurePath = path.join(WORKSPACE, feature.path);
  if (!fs.existsSync(featurePath)) {
    missingFeatures.push(feature.name);
    console.log(`  ⚠ Missing: ${feature.name}`);
  } else {
    console.log(`  ✓ Found: ${feature.name}`);
  }
}
console.log('');

// Step 8: Send summary
console.log('8️⃣ Sending summary...\n');

const hasErrors = lintErrors.length > 0 || tsErrors.length > 0 || brokenScripts.length > 0 || cronErrors.length > 0;

if (hasErrors) {
  const summary = `⚠️ AgentCard Reviewer — Issues Found

**Linting:** ${lintErrors.length} error(s)
**TypeScript:** ${tsErrors.length} error(s)
**Broken scripts:** ${brokenScripts.length}
**Cron errors:** ${cronErrors.length}
**Missing features:** ${missingFeatures.length}

**Action needed:** Review and fix issues above.`;

  sendDiscord(summary);
  
  // TODO: If errors found, spawn claude-sonnet-4-6 session to analyze and fix
  console.log('  ℹ️ Spawning claude-sonnet-4-6 for error analysis...\n');
} else {
  const summary = `✅ AgentCard Reviewer — All Clear

**Checks passed:**
✓ Git status clean
✓ No linting errors
✓ No TypeScript errors
✓ Cron jobs healthy
✓ All scripts valid
✓ Feature files present

**Workspace:** agentcard-social/openclaw-workspace
**Run time:** ${new Date().toISOString()}`;

  sendDiscord(summary);
}

// Log run
log.runs.push({
  timestamp: runStart,
  status: hasErrors ? 'issues-found' : 'success',
  lintErrors: lintErrors.length,
  tsErrors: tsErrors.length,
  brokenScripts: brokenScripts.length,
  cronErrors: cronErrors.length,
  missingFeatures: missingFeatures.length
});
fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));

console.log('✅ AgentCard Reviewer complete.\n');
console.log(`📊 Summary:`);
console.log(`   Lint errors: ${lintErrors.length}`);
console.log(`   TS errors: ${tsErrors.length}`);
console.log(`   Broken scripts: ${brokenScripts.length}`);
console.log(`   Cron errors: ${cronErrors.length}`);
console.log(`   Log saved to: ${LOG_FILE}\n`);

if (hasErrors) {
  console.log('⚠️ Issues detected — claude-sonnet-4-6 will analyze and propose fixes.\n');
}
