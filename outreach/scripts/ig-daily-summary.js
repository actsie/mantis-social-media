#!/usr/bin/env node
/**
 * ig-daily-summary.js
 * Generates Instagram daily summary and saves to dashboard + sends to Discord.
 * Run at 11:15pm PST daily via cron.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const DISCORD_SUMMARIES_CHANNEL = '1485556428377948161';

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

// ── Load today's sessions ──────────────────────────────────────────────────────
function loadTodaySessions() {
  const today = getTodayPST();
  const logFile = path.join(WORKSPACE, 'outreach/instagram/engagement-log.json');
  
  if (!fs.existsSync(logFile)) return [];
  
  try {
    const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    return (log.sessions || []).filter(s => {
      if (!s.timestamp) return false;
      const sessionDate = toPSTDate(s.timestamp);
      return sessionDate === today;
    });
  } catch (e) {
    console.error('Error loading IG log:', e.message);
    return [];
  }
}

// ── Load today's schedule ──────────────────────────────────────────────────────
function loadTodaySchedule() {
  const today = getTodayPST();
  const scheduleFile = path.join(WORKSPACE, 'outreach/instagram/today-schedule.json');
  
  if (!fs.existsSync(scheduleFile)) return { sessions: [] };
  
  try {
    return JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
  } catch (e) {
    return { sessions: [] };
  }
}

// ── Load follower state ──────────────────────────────────────────────────────
function loadFollowerState() {
  const stateFile = path.join(WORKSPACE, 'outreach/instagram/follower-state.json');
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

// ── Calculate follower delta ──────────────────────────────────────────────────
function calculateFollowerDelta(snapshotsData, today) {
  const snapshots = snapshotsData.snapshots || [];
  const todaySnapshot = snapshots.find(s => s.date === today);
  const yesterday = getYesterdayPST();
  const yesterdaySnapshot = snapshots.find(s => s.date === yesterday);
  
  if (todaySnapshot && yesterdaySnapshot) {
    return todaySnapshot.ig_followers - yesterdaySnapshot.ig_followers;
  }
  return 0;
}

// ── Find follow-backs needed ──────────────────────────────────────────────────
function findFollowBacksNeeded() {
  const trackerFile = path.join(WORKSPACE, 'outreach/instagram/follow-tracker.json');
  if (!fs.existsSync(trackerFile)) return [];
  
  try {
    const tracker = JSON.parse(fs.readFileSync(trackerFile, 'utf8'));
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    return (tracker.follows || []).filter(f => {
      if (!f.followedDate) return false;
      if (f.followedBack) return false;
      const followedDate = new Date(f.followedDate);
      return followedDate <= sevenDaysAgo;
    }).map(f => ({
      handle: f.handle,
      followedDate: f.followedDate,
      followerCount: f.followerCount
    }));
  } catch (e) {
    return [];
  }
}

// ── Send Discord ────────────────────────────────────────────────────────────
function sendDiscord(message) {
  const result = spawnSync('openclaw', [
    'message', 'send',
    '--channel', 'discord',
    '--target', DISCORD_SUMMARIES_CHANNEL,
    '--message', message
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  
  if (result.status === 0) {
    console.log('✓ Discord sent');
    return true;
  } else {
    console.error('✗ Failed to send Discord:', result.stderr);
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

console.log(`\n📸 Instagram Daily Summary — ${todayDisplay}\n`);

// Load data
const sessions = loadTodaySessions();
const schedule = loadTodaySchedule();
const followers = loadFollowerState();
const snapshots = loadSnapshots();

// Calculate stats
const sessionsCompleted = sessions.length;
const sessionsScheduled = (schedule.sessions || []).filter(s => s.n).length;
const sessionsIncomplete = (schedule.sessions || []).filter(s => s.n && !s.done).length;
const commentsPosted = sessions.filter(s => s.type === 'comment').length;
const likesOnly = sessions.filter(s => s.type === 'like-only').length;
const totalLikes = sessions.reduce((sum, s) => sum + (s.likes ? s.likes.length : 0), 0);

// Follows added today
const followsAdded = [];
const followTrackerFile = path.join(WORKSPACE, 'outreach/instagram/follow-tracker.json');
if (fs.existsSync(followTrackerFile)) {
  try {
    const tracker = JSON.parse(fs.readFileSync(followTrackerFile, 'utf8'));
    followsAdded.push(...(tracker.follows || []).filter(f => {
      if (!f.followedDate) return false;
      const fDate = toPSTDate(f.followedDate);
      return fDate === todayPST;
    }));
  } catch (e) {}
}

// Follower delta
const followerDelta = calculateFollowerDelta(snapshots, todayPST);

// Follow-backs needed
const followBacksNeeded = findFollowBacksNeeded();

// Build message
let message = `📸 *Instagram Daily Summary — ${todayDisplay}*\n\n`;
message += `*Account:* @stacyd0nna\n\n`;
message += `*Sessions:*\n`;
message += `├ Completed: ${sessionsCompleted}\n`;
message += `├ Scheduled: ${sessionsScheduled}\n`;
message += `├ Incomplete: ${sessionsIncomplete}\n`;
message += `├ Comments posted: ${commentsPosted}\n`;
message += `└ Likes only: ${likesOnly}\n\n`;

message += `*Engagement:*\n`;
message += `└ Total likes sent: ${totalLikes}\n\n`;

if (followsAdded.length > 0) {
  message += `*Follows Added (${followsAdded.length}):*\n`;
  followsAdded.slice(0, 5).forEach(f => {
    message += `├ @${f.handle} (${f.followerCount || '?'} followers)\n`;
  });
  if (followsAdded.length > 5) message += `└ ... and ${followsAdded.length - 5} more\n`;
  message += `\n`;
}

message += `*Followers:* ${followers.lastCount || 0} (${followerDelta >= 0 ? '+' : ''}${followerDelta} today)\n\n`;

if (followBacksNeeded.length > 0) {
  message += `⚠️ *Follow-Back Check:*\n`;
  message += `${followBacksNeeded.length} accounts followed 7+ days ago haven't followed back:\n`;
  followBacksNeeded.slice(0, 5).forEach(f => {
    message += `├ @${f.handle} (followed ${new Date(f.followedDate).toLocaleDateString()})\n`;
  });
  if (followBacksNeeded.length > 5) message += `└ ... and ${followBacksNeeded.length - 5} more\n`;
  message += `\n`;
}

if (sessionsIncomplete > 0) {
  message += `*Incomplete Sessions:* ${sessionsIncomplete}\n`;
  message += `Check today-schedule.json for sessions with done: false\n\n`;
}

// Build structured data
const summaryData = {
  date: todayPST,
  generated_at: new Date().toISOString(),
  generated_at_pht: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
  platform: 'instagram',
  account: '@stacyd0nna',
  sessions_completed: sessionsCompleted,
  sessions_scheduled: sessionsScheduled,
  sessions_incomplete: sessionsIncomplete,
  comments_posted: commentsPosted,
  likes_only: likesOnly,
  likes_sent: totalLikes,
  follows_added: followsAdded.length,
  follows_added_details: followsAdded.slice(0, 10),
  followers: {
    current: followers.lastCount || 0,
    delta: followerDelta
  },
  follow_backs_needed: followBacksNeeded.length,
  follow_backs_details: followBacksNeeded.slice(0, 10),
  raw_summary: message
};

// Save to file
const summaryDir = path.join(WORKSPACE, 'dashboard/data/summaries/instagram');
if (!fs.existsSync(summaryDir)) fs.mkdirSync(summaryDir, { recursive: true });
const summaryFile = path.join(summaryDir, `${todayPST}.json`);
fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2));
console.log(`✓ Summary saved to: ${summaryFile}`);

// Send Discord
sendDiscord(message);

console.log('\n✅ Instagram daily summary done.\n');


