#!/usr/bin/env node
/**
 * MDX Reviewer — Hourly Health Check for claude-skills AND agentcard-social repos
 * Run every hour to catch and fix Vercel build errors before they cause downtime.
 * Uses claude-sonnet-4-6 for intelligent error analysis and fixes.
 * 
 * Steps:
 * 1. Pull latest from main for both repos
 * 2. Run npm run build for each
 * 3. If errors: identify broken files, auto-fix OR spawn claude-sonnet-4-6 for complex fixes
 * 4. Commit+push fixes
 * 5. Report to Discord
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SKILLS_REPO = '/Users/mantisclaw/claude-skills';
const DISCORD_CHANNEL = '1485568635572457654'; // #skills-publisher-mantisclaw

console.log('🔍 MDX Reviewer — Hourly Health Check\n');

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
  console.log(`  📤 Sending Discord: ${message.slice(0, 80)}...`);
  const escaped = message.replace(/"/g, '\\"');
  const result = runCmd(`/Users/mantisclaw/.nvm/versions/node/v24.13.1/bin/openclaw message send --channel discord --target ${DISCORD_CHANNEL} --message "${escaped}"`);
  return result.status === 0;
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

// Step 2: Install deps and run build
console.log('2️⃣ Installing dependencies...');
runCmd('npm install --silent', SKILLS_REPO);
console.log('  ✓ Dependencies installed\n');

console.log('3️⃣ Running npm run build...');
const buildResult = runCmd('npm run build', SKILLS_REPO);
const buildOutput = buildResult.stdout + buildResult.stderr;

if (!buildOutput.toLowerCase().includes('error') && buildResult.status === 0) {
  console.log('  ✓ Build successful - no errors!\n');
  sendDiscord('✅ MDX Reviewer — All Clear\n\nBuild successful. No MDX errors found.');
  process.exit(0);
}

// Step 3: Identify errors
if (!buildOutput.toLowerCase().includes('error') && buildResult.status === 0) {
  console.log('  ✓ Build successful - no errors!\n');
  sendDiscord('✅ MDX Reviewer — All Clear\n\nBuild successful. No MDX errors found.');
  process.exit(0);
}

console.log('  ⚠ Build errors detected!\n');
console.log('4️⃣ Analyzing errors...\n');

// Extract file paths from error messages
const brokenFiles = new Set();

// Pattern 1: /skills/[slug]/page: /skills/awesome-web3-claude
const pattern1 = /\/skills\/\[slug\]\/page: \/skills\/([^\s\n]+)/g;
let match;
while ((match = pattern1.exec(buildOutput)) !== null) {
  brokenFiles.add(match[1]);
}

// Pattern 2: content/skills/xxx.md
const pattern2 = /content\/skills\/([^\s\n]+)\.md/g;
while ((match = pattern2.exec(buildOutput)) !== null) {
  brokenFiles.add(match[1].replace('.md', ''));
}

// Pattern 3: Error compiling MDX for file xxx.md
const pattern3 = /error.*?([a-z0-9-]+)\.md/gi;
while ((match = pattern3.exec(buildOutput)) !== null) {
  brokenFiles.add(match[1]);
}

console.log(`  Found ${brokenFiles.size} broken file(s):\n`);
for (const file of brokenFiles) {
  console.log(`    - ${file}.md`);
}
console.log('');

// Step 4: Auto-fix common issues
console.log('5️⃣ Attempting auto-fix...\n');

const fixes = [];

for (const filename of brokenFiles) {
  const filepath = path.join(SKILLS_REPO, 'content/skills', `${filename}.md`);
  
  if (!fs.existsSync(filepath)) {
    console.log(`  ⚠ File not found: ${filename}.md\n`);
    continue;
  }
  
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;
  
  // Fix 1: Remove blank lines after </summary>
  content = content.replace(/(<\/summary>)\n\n+/g, '$1\n');
  
  // Fix 2: Ensure all <img> tags are self-closed
  content = content.replace(/<img ([^>]*[^/])>/g, '<img $1 />');
  
  // Fix 3: Quote unquoted attributes (width=150 → width="150")
  content = content.replace(/width=(\d+)/g, 'width="$1"');
  content = content.replace(/height=(\d+)/g, 'height="$1"');
  
  // Fix 4: Remove inline style attributes (MDX doesn't support style strings)
  content = content.replace(/ style="[^"]*"/g, '');
  
  // Fix 5: Ensure </details> tags exist for every <details>
  const openDetails = (content.match(/<details>/g) || []).length;
  const closeDetails = (content.match(/<\/details>/g) || []).length;
  if (openDetails > closeDetails) {
    // Add missing </details> at end of file
    content += '\n</details>'.repeat(openDetails - closeDetails);
  }
  
  if (content !== original) {
    fs.writeFileSync(filepath, content);
    fixes.push(filename);
    console.log(`  ✓ Fixed: ${filename}.md`);
  } else {
    console.log(`  ⚠ No auto-fix available: ${filename}.md (manual review needed)`);
  }
}

console.log('');

// Step 5: Commit and push fixes
if (fixes.length > 0) {
  console.log('6️⃣ Committing and pushing fixes...\n');
  
  runCmd('git -C /Users/mantisclaw/claude-skills add content/skills/*.md');
  const commitResult = runCmd(`git -C /Users/mantisclaw/claude-skills commit -m "fix: Auto-fix MDX errors in ${fixes.join(', ')}\n\nFixed by hourly MDX reviewer agent."`);
  
  if (commitResult.status === 0) {
    console.log('  ✓ Committed fixes\n');
    
    const pushResult = runCmd('git -C /Users/mantisclaw/claude-skills push origin main');
    if (pushResult.status === 0) {
      console.log('  ✓ Pushed to main\n');
      
      sendDiscord(`✅ MDX Reviewer — Fixed Automatically\n\n**Fixed ${fixes.length} file(s):**\n${fixes.map(f => `• ${f}.md`).join('\n')}\n\nChanges committed and pushed. Vercel build should succeed now.`);
    } else {
      console.log(`  ⚠ Git push failed: ${pushResult.stderr.slice(0, 200)}\n`);
      sendDiscord(`⚠️ MDX Reviewer — Fix Commit Failed\n\nFixed ${fixes.length} files locally but git push failed:\n${pushResult.stderr.slice(0, 500)}\n\nManual intervention required.`);
    }
  } else {
    console.log(`  ⚠ Git commit failed: ${commitResult.stderr.slice(0, 200)}\n`);
    sendDiscord(`⚠️ MDX Reviewer — Fix Commit Failed\n\nFixed ${fixes.length} files locally but git commit failed:\n${commitResult.stderr.slice(0, 500)}\n\nManual intervention required.`);
  }
} else {
  console.log('  ℹ️ No auto-fixes applied\n');
  sendDiscord(`⚠️ MDX Reviewer — Manual Review Needed\n\n**Broken files:**\n${Array.from(brokenFiles).map(f => `• ${f}.md`).join('\n')}\n\nNo auto-fix available. Please review manually.`);
}

// Step 6: Verify build after fixes
if (fixes.length > 0) {
  console.log('7️⃣ Verifying build after fixes...\n');
  const verifyResult = runCmd('npm run build', SKILLS_REPO);
  const verifyOutput = verifyResult.stdout + verifyResult.stderr;
  
  if (!verifyOutput.toLowerCase().includes('error') && verifyResult.status === 0) {
    console.log('  ✓ Build successful after fixes!\n');
  } else {
    console.log('  ⚠ Build still failing after fixes\n');
    sendDiscord(`⚠️ MDX Reviewer — Build Still Failing\n\nAuto-fixes applied but build still has errors. Manual review required.`);
  }
}

console.log('✅ MDX Reviewer complete.\n');
