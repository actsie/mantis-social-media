#!/usr/bin/env node
/**
 * x-daily-summary.js
 * Generates X (Twitter) daily summary and saves to dashboard + sends to Telegram.
 * Run at 11:10pm PST daily via cron.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const TELEGRAM_TARGET = '6241290513';

// ── Helper: Get today's date in PST ─────────────────────────────────────────────
function getTodayPST() {
  const now = new Date();
  const pstOptions = { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', pstOptions).format(now).split('/');
  return `${parts[2]}-${parts[0]}-${parts[1]}`;
}

// ── Helper: Parse timestamp to PST date ─────────────────────────────────────────
function toPSTDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const pstOptions = { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', pstOptions).format(date).split('/');
  return `${parts[2]}-${parts[0]}-${parts[1]}`;
}

// ── Helper: Get yesterday's date in PST ─────────────────────────────────────────
function getYesterdayPST() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const pstOptions = { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', pstOptions).format(now).split('/');
  return `${parts[2]}-${parts[0]}-${parts[1]}`;
}

// ── Load today's sessions from engagement-log ──────────────────────────────────
function loadTodaySessions() {
  const today = getTodayPST();
  const logFile = path.join(WORKSPACE, 'outreach/x/engagement-log.json');
  
  if (!fs.existsSync(logFile)) return [];
  
  try {
    const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    return (log.sessions || []).filter(s => {
      if (!s.timestamp) return false;
      const sessionDate = toPSTDate(s.timestamp);
      return sessionDate === today;
    });
  } catch (e) {
    console.error('Error loading X log:', e.message);
    return [];
  }
}

// ── Load follower state ──────────────────────────────────────────────────────
function loadFollowerState() {
  const stateFile = path.join(WORKSPACE, 'outreach/x/follower-state.json');
  if (!fs.existsSync(stateFile)) return { lastCount: 0, history: [] };
  
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    return { lastCount: 0, history: [] };
  }
}

// ── Load snapshots for delta ──────────────────────────────────────────────────
function loadSnapshots() {
  const snapshotsFile = path.join(WORKSPACE, 'dashboard/data/snapshots.json');
  if (!fs.existsSync(snapshotsFile)) return { snapshots: [] };
  
  try {
    return JSON.parse(fs.readFileSync(snapshotsFile, 'utf8'));
  } catch (e) {
    return { snapshots: [] };
  }
}

// ── Load approval queue ──────────────────────────────────────────────────────
function loadApprovalQueue() {
  const queueFile = path.join(WORKSPACE, 'outreach/x/approval-queue.json');
  if (!fs.existsSync(queueFile)) return { entries: [] };
  
  try {
    return JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  } catch (e) {
    return { entries: [] };
  }
}

// ── Load original posts log ──────────────────────────────────────────────────
function loadOriginalPosts() {
  const postsFile = path.join(WORKSPACE, 'outreach/x/original-posts-log.json');
  if (!fs.existsSync(postsFile)) return { posts: [] };
  
  try {
    return JSON.parse(fs.readFileSync(postsFile, 'utf8'));
  } catch (e) {
    return { posts: [] };
  }
}

// ── Calculate follower delta ──────────────────────────────────────────────────
function calculateFollowerDelta(snapshotsData, today) {
  const snapshots = snapshotsData.snapshots || [];
  const todaySnapshot = snapshots.find(s => s.date === today);
  const yesterday = getYesterdayPST();
  const yesterdaySnapshot = snapshots.find(s => s.date === yesterday);
  
  if (todaySnapshot && yesterdaySnapshot) {
    return (todaySnapshot.x_followers || 0) - (yesterdaySnapshot.x_followers || 0);
  }
  return 0;
}

// ── Send Telegram ────────────────────────────────────────────────────────────
function sendTelegram(message) {
  const result = spawnSync('openclaw', [
    'message', 'send',
    '--channel', 'telegram',
    '--target', TELEGRAM_TARGET,
    '--message', message
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  
  if (result.status === 0) {
    console.log('✓ Telegram sent');
    return true;
  } else {
    console.error('✗ Failed to send Telegram:', result.stderr);
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const todayPST = getTodayPST();
const todayDisplay = new Date().toLocaleDateString('en-US', { 
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  month: 'short',
  day: 'numeric'
});

console.log(`\n🐦 X Daily Summary — ${todayDisplay}\n`);

// Load data
const sessions = loadTodaySessions();
const followerState = loadFollowerState();
const snapshots = loadSnapshots();
const approvalQueue = loadApprovalQueue();
const originalPosts = loadOriginalPosts();

// Calculate stats
const sessionsCompleted = sessions.length;
const repliesPosted = (approvalQueue.entries || []).filter(e => {
  const entryDate = toPSTDate(e.created_at);
  return entryDate === todayPST && e.status === 'posted';
}).length;
const originalPostsCount = (originalPosts.posts || []).filter(p => p.date === todayPST).length;
const pendingApprovals = (approvalQueue.entries || []).filter(e => {
  const entryDate = toPSTDate(e.created_at);
  return entryDate === todayPST && e.status === 'pending';
}).length;
const postedToday = repliesPosted + originalPostsCount;

// Follower stats
const followersCurrent = followerState.lastCount || 0;
const followersDelta = calculateFollowerDelta(snapshots, todayPST);

// Build message
let message = `🐦 *X Daily Summary — ${todayDisplay}*\n\n`;
message += `*Account:* @stacydonna0x\n\n`;
message += `*Sessions:*\n`;
message += `├ Completed: ${sessionsCompleted}\n`;
message += `├ Replies posted: ${repliesPosted}\n`;
message += `└ Original posts: ${originalPostsCount}\n\n`;

message += `*Approval Queue:*\n`;
message += `├ Pending: ${pendingApprovals}\n`;
message += `└ Posted today: ${postedToday}\n\n`;

message += `*Followers:* ${followersCurrent} (${followersDelta >= 0 ? '+' : ''}${followersDelta} today)`;

// Build structured data
const summaryData = {
  date: todayPST,
  generated_at: new Date().toISOString(),
  generated_at_pht: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
  platform: 'x',
  account: '@stacydonna0x',
  sessions_completed: sessionsCompleted,
  replies_posted: repliesPosted,
  original_posts: originalPostsCount,
  pending_approvals: pendingApprovals,
  followers: {
    current: followersCurrent,
    delta: followersDelta
  },
  raw_summary: message
};

// Save to file
const summaryDir = path.join(WORKSPACE, 'dashboard/data/summaries/x');
if (!fs.existsSync(summaryDir)) fs.mkdirSync(summaryDir, { recursive: true });
const summaryFile = path.join(summaryDir, `${todayPST}.json`);
fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2));
console.log(`✓ Summary saved to: ${summaryFile}`);

// Send Telegram
sendTelegram(message);

console.log('\n✅ X daily summary done.\n');
