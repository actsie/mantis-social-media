#!/usr/bin/env node
/**
 * daily-snapshots.js
 * Captures daily baseline snapshots of follower counts and karma at 11:59pm PHT.
 * This enables accurate delta calculations in the engagement summary.
 * 
 * Run at 11:59pm PHT daily via cron.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const DISCORD_ALERTS_CHANNEL = '1485556473873436743';

// ── Helper: Get current timestamp ─────────────────────────────────────────────
function getTimestamp() {
  return new Date().toISOString();
}

// ── Helper: Get PHT date string ───────────────────────────────────────────────
function getPHTDate() {
  const now = new Date();
  const phtOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', phtOptions).format(now).split('/');
  return `${parts[2]}-${parts[0]}-${parts[1]}`; // YYYY-MM-DD
}

// ── Capture Instagram followers ──────────────────────────────────────────────
function captureInstagramFollowers() {
  const stateFile = path.join(WORKSPACE, 'outreach/instagram/follower-state.json');
  if (!fs.existsSync(stateFile)) {
    console.log('⚠ Instagram follower-state.json not found');
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const snapshot = {
      timestamp: getTimestamp(),
      count: data.lastCount || 0
    };
    
    // Add to history if not already present for today
    const today = getPHTDate();
    const todaySnapshots = (data.history || []).filter(h => {
      const hDate = h.timestamp.split('T')[0];
      return hDate === today;
    });
    
    if (todaySnapshots.length === 0) {
      data.history = data.history || [];
      data.history.push(snapshot);
      fs.writeFileSync(stateFile, JSON.stringify(data, null, 2));
      console.log(`✓ Instagram snapshot: ${data.lastCount} followers`);
      return snapshot;
    } else {
      console.log(`✓ Instagram snapshot already captured today`);
      return todaySnapshots[0];
    }
  } catch (e) {
    console.error('✗ Failed to capture Instagram followers:', e.message);
    return null;
  }
}

// ── Capture X followers ──────────────────────────────────────────────────────
function captureXFollowers() {
  const stateFile = path.join(WORKSPACE, 'outreach/x/follower-state.json');
  if (!fs.existsSync(stateFile)) {
    console.log('⚠ X follower-state.json not found');
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const snapshot = {
      timestamp: getTimestamp(),
      count: data.lastCount || 0
    };
    
    // Add to history if not already present for today
    const today = getPHTDate();
    const todaySnapshots = (data.history || []).filter(h => {
      const hDate = h.timestamp.split('T')[0];
      return hDate === today;
    });
    
    if (todaySnapshots.length === 0) {
      data.history = data.history || [];
      data.history.push(snapshot);
      fs.writeFileSync(stateFile, JSON.stringify(data, null, 2));
      console.log(`✓ X snapshot: ${data.lastCount} followers`);
      return snapshot;
    } else {
      console.log(`✓ X snapshot already captured today`);
      return todaySnapshots[0];
    }
  } catch (e) {
    console.error('✗ Failed to capture X followers:', e.message);
    return null;
  }
}

// ── Capture Reddit karma ─────────────────────────────────────────────────────
function captureRedditKarma() {
  const stateFile = path.join(WORKSPACE, 'outreach/reddit/karma-state.json');
  if (!fs.existsSync(stateFile)) {
    console.log('⚠ Reddit karma-state.json not found');
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const snapshot = {
      timestamp: getTimestamp(),
      postKarma: data.postKarma || 0,
      commentKarma: data.commentKarma || 0,
      totalKarma: data.totalKarma || 0
    };
    
    // Add to history if not already present for today
    const today = getPHTDate();
    const todaySnapshots = (data.history || []).filter(h => {
      const hDate = h.timestamp.split('T')[0];
      return hDate === today;
    });
    
    if (todaySnapshots.length === 0) {
      data.history = data.history || [];
      data.history.push(snapshot);
      fs.writeFileSync(stateFile, JSON.stringify(data, null, 2));
      console.log(`✓ Reddit snapshot: ${data.totalKarma} total karma`);
      return snapshot;
    } else {
      console.log(`✓ Reddit snapshot already captured today`);
      return todaySnapshots[0];
    }
  } catch (e) {
    console.error('✗ Failed to capture Reddit karma:', e.message);
    return null;
  }
}

// ── Send Discord message ────────────────────────────────────────────────────
function sendDiscord(message) {
  const result = spawnSync('openclaw', [
    'message', 'send',
    '--channel', 'discord',
    '--target', DISCORD_ALERTS_CHANNEL,
    '--message', message
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  
  if (result.status === 0) {
    console.log('✓ Discord sent');
  } else {
    console.error('✗ Failed to send Discord:', result.stderr);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const todayPHT = getPHTDate();
const todayDisplay = new Date().toLocaleDateString('en-US', { 
  timeZone: 'Asia/Manila',
  weekday: 'long',
  month: 'short',
  day: 'numeric'
});

console.log(`\n📸 Daily Snapshots — ${todayDisplay} (${todayPHT})\n`);

// Capture all snapshots
const igSnapshot = captureInstagramFollowers();
const xSnapshot = captureXFollowers();
const redditSnapshot = captureRedditKarma();

// Build summary message
let message = `📸 *Daily Snapshots — ${todayDisplay}*\n\n`;
message += `Baseline captured at 11:59pm PHT for delta calculations.\n\n`;

if (igSnapshot) {
  message += `*Instagram:* ${igSnapshot.count} followers\n`;
}
if (xSnapshot) {
  message += `*X:* ${xSnapshot.count} followers\n`;
}
if (redditSnapshot) {
  message += `*Reddit:* ${redditSnapshot.totalKarma} total karma (${redditSnapshot.postKarma} post, ${redditSnapshot.commentKarma} comment)\n`;
}

message += `\n✅ All snapshots captured.`;

console.log(message);
sendDiscord(message);

console.log('\n✅ Daily snapshots done.\n');
