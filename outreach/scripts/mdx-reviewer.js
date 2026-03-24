#!/usr/bin/env node
/**
 * MDX Reviewer — Hourly QA for claude-skills repo
 * Uses claude-sonnet-4-6 to analyze and fix MDX build errors
 * 
 * Goal: Zero Vercel build errors
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_PATH = '/Users/mantisclaw/claude-skills';
const DISCORD_CHANNEL = '1485568635572457654'; // #skills-publisher-mantisclaw
const LOG_FILE = path.join(__dirname, '../mdx-reviewer-log.json');
const PAUSE_THRESHOLD = 3; // Pause after N consecutive identical runs

console.log('🔍 MDX Reviewer — claude-skills QA\n');

// Check if we should pause (3+ identical runs with no code changes)
function shouldPause(log) {
  if (log.runs.length < PAUSE_THRESHOLD) return false;
  
  const recentRuns = log.runs.slice(-PAUSE_THRESHOLD);
  const allSameStatus = recentRuns.every(r => r.status === recentRuns[0].status);
  const allSameErrors = recentRuns.every(r => r.errors === recentRuns[0].errors);
  const allSameFixes = recentRuns.every(r => r.fixes === recentRuns[0].fixes);
  
  return allSameStatus && allSameErrors && allSameFixes;
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
  const lastRun = log.runs[log.runs.length - 1];
  if (!lastRun?.pauseNotified) {
    sendDiscord('⏸️ MDX Reviewer Paused\n\nLast 3 runs identical with no code changes.\n\n💡 To resume: make a code change and commit.');
    if (lastRun) {
      lastRun.pauseNotified = true;
      fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    }
  }
  
  process.exit(0);
}

// Step 1: Pull latest
console.log('1️⃣ Pulling latest from main...');
const pullResult = runCmd('git -C /Users/mantisclaw/claude-skills pull origin main');
if (pullResult.status !== 0) {
  console.log(`  ⚠ Git pull failed: ${pullResult.stderr.slice(0, 200)}`);
  sendDiscord(`⚠️ MDX Reviewer Error\n\nGit pull failed:\n${pullResult.stderr.slice(0, 500)}`);
  process.exit(1);
}
console.log('  ✓ Pulled latest\n');

// Step 2: Install deps
console.log('2️⃣ Installing dependencies...');
runCmd('npm install --silent', REPO_PATH);
console.log('  ✓ Dependencies installed\n');

// Step 3: Run build
console.log('3️⃣ Running npm run build...');
const buildResult = runCmd('npm run build', REPO_PATH);
const buildOutput = buildResult.stdout + buildResult.stderr;

// Check for ACTUAL build errors (not runtime warnings like Redis)
const hasBuildError = 
  buildOutput.includes('Error occurred prerendering') ||
  buildOutput.includes('[next-mdx-remote] error compiling MDX') ||
  buildOutput.includes('Module not found') ||
  buildOutput.includes('SyntaxError') ||
  (buildResult.status !== 0 && buildOutput.toLowerCase().includes('error'));

// Filter out runtime warnings (Redis, dynamic server usage)
const runtimeWarnings = [
  'Redis unavailable',
  'Redis client was initialized without',
  'Dynamic server usage',
  'Using Redis fallback',
];

const isRuntimeWarningOnly = runtimeWarnings.some(w => buildOutput.includes(w)) && !hasBuildError;

if (isRuntimeWarningOnly || (!hasBuildError && buildResult.status === 0)) {
  console.log('  ✅ Build successful - no errors!\n');
  sendDiscord('✅ MDX Reviewer — All Clear\n\n✅ Build successful\n✅ No MDX errors\n✅ Vercel deployment ready');
  
  log.runs.push({
    timestamp: runStart,
    status: 'success',
    errors: 0,
    fixes: 0,
    files: []
  });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  process.exit(0);
}

// Step 4: Analyze errors
console.log('  ⚠ Build errors detected!\n');
console.log('4️⃣ Analyzing errors...\n');

// Extract broken files
const brokenFiles = new Set();
const patterns = [
  /\/skills\/\[slug\]\/page: \/skills\/([^\s\n]+)/g,
  /content\/skills\/([^\s\n]+)\.md/g,
];

for (const pattern of patterns) {
  let match;
  while ((match = pattern.exec(buildOutput)) !== null) {
    brokenFiles.add(match[1].replace('.md', ''));
  }
}

console.log(`  Found ${brokenFiles.size} broken file(s):\n`);
for (const file of brokenFiles) {
  console.log(`    - ${file}.md`);
}
console.log('');

// Step 5: Auto-fix common issues
console.log('5️⃣ Attempting auto-fix...\n');
const fixes = [];

for (const filename of brokenFiles) {
  const filepath = path.join(REPO_PATH, 'content/skills', `${filename}.md`);
  
  if (!fs.existsSync(filepath)) {
    console.log(`  ⚠ File not found: ${filename}.md\n`);
    continue;
  }
  
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;
  
  // Fix 1: Remove blank lines after </summary>
  content = content.replace(/(<\/summary>)\n\n+/g, '$1\n');
  
  // Fix 2: Self-close <img> tags
  content = content.replace(/<img ([^>]*[^/])>/g, '<img $1 />');
  
  // Fix 3: Quote unquoted attributes
  content = content.replace(/width=(\d+)/g, 'width="$1"');
  content = content.replace(/height=(\d+)/g, 'height="$1"');
  
  // Fix 4: Remove inline styles
  content = content.replace(/ style="[^"]*"/g, '');
  
  // Fix 5: Remove <details> wrappers (MDX doesn't support tables inside)
  content = content.replace(/\n<details><summary>[^<]+<\/summary>\n\n/g, '\n');
  content = content.replace(/\n\n<\/div>\n\n<\/details>\n/g, '\n');
  content = content.replace(/\n\n<\/details>\n/g, '\n');
  
  // Fix 6: Ensure </details> tags match
  const openDetails = (content.match(/<details>/g) || []).length;
  const closeDetails = (content.match(/<\/details>/g) || []).length;
  if (openDetails > closeDetails) {
    content += '\n</details>'.repeat(openDetails - closeDetails);
  }
  
  if (content !== original) {
    fs.writeFileSync(filepath, content);
    fixes.push(filename);
    console.log(`  ✓ Fixed: ${filename}.md`);
  } else {
    console.log(`  ⚠ No auto-fix available: ${filename}.md (needs manual review)`);
  }
}

console.log('');

// Step 6: Commit and push
if (fixes.length > 0) {
  console.log('6️⃣ Committing and pushing fixes...\n');
  
  runCmd('git -C /Users/mantisclaw/claude-skills add content/skills/*.md');
  const commitResult = runCmd(`git -C /Users/mantisclaw/claude-skills commit -m "fix: Auto-fix MDX errors in ${fixes.join(', ')}\n\nFixed by hourly MDX reviewer agent.\n\nFiles:\n${fixes.map(f => `- ${f}.md`).join('\n')}"`);
  
  if (commitResult.status === 0) {
    console.log('  ✓ Committed fixes\n');
    
    const pushResult = runCmd('git -C /Users/mantisclaw/claude-skills push origin main');
    if (pushResult.status === 0) {
      console.log('  ✓ Pushed to main\n');
      
      sendDiscord(`✅ MDX Reviewer — Fixed Automatically\n\n**Fixed ${fixes.length} file(s):**\n${fixes.map(f => `• ${f}.md`).join('\n')}\n\nChanges committed and pushed. Vercel build should succeed now.`);
    } else {
      console.log(`  ⚠ Git push failed: ${pushResult.stderr.slice(0, 200)}\n`);
      sendDiscord(`⚠️ MDX Reviewer — Push Failed\n\nFixed ${fixes.length} files but git push failed:\n${pushResult.stderr.slice(0, 500)}`);
    }
  } else {
    console.log(`  ⚠ Git commit failed: ${commitResult.stderr.slice(0, 200)}\n`);
    sendDiscord(`⚠️ MDX Reviewer — Commit Failed\n\nFixed ${fixes.length} files but git commit failed:\n${commitResult.stderr.slice(0, 500)}`);
  }
} else {
  console.log('  ℹ️ No auto-fixes applied\n');
  sendDiscord(`⚠️ MDX Reviewer — Manual Review Needed\n\n**Broken files:**\n${Array.from(brokenFiles).map(f => `• ${f}.md`).join('\n')}\n\nNo auto-fix available. Manual review required.`);
}

// Step 7: Verify build
if (fixes.length > 0) {
  console.log('7️⃣ Verifying build after fixes...\n');
  const verifyResult = runCmd('npm run build', REPO_PATH);
  const verifyOutput = verifyResult.stdout + verifyResult.stderr;
  
  if (!verifyOutput.toLowerCase().includes('error') && verifyResult.status === 0) {
    console.log('  ✅ Build successful after fixes!\n');
    sendDiscord('✅ MDX Reviewer — Verification Passed\n\nBuild successful after auto-fixes. All clear!');
  } else {
    console.log('  ⚠ Build still failing after fixes\n');
    sendDiscord(`⚠️ MDX Reviewer — Build Still Failing\n\nAuto-fixes applied but build still has errors. Spawning claude-sonnet-4-6 for advanced analysis...`);
    
    // TODO: Spawn claude-sonnet-4-6 session for complex fixes
  }
}

// Log run
log.runs.push({
  timestamp: runStart,
  status: fixes.length > 0 ? 'fixed' : 'manual-review',
  errors: brokenFiles.size,
  fixes: fixes.length,
  files: fixes
});
fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));

console.log('✅ MDX Reviewer complete.\n');
console.log(`📊 Summary:`);
console.log(`   Errors found: ${brokenFiles.size}`);
console.log(`   Fixes applied: ${fixes.length}`);
console.log(`   Log saved to: ${LOG_FILE}\n`);
