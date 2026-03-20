#!/usr/bin/env node
/**
 * reddit-daily-summary.js
 * Generates Reddit daily summary and saves to dashboard + sends to Telegram.
 * Run at 11:21pm PST daily via cron.
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

// ── Load today's sessions ──────────────────────────────────────────────────────
function loadTodaySessions() {
  const today = getTodayPST();
  const logFile = path.join(WORKSPACE, 'outreach/reddit/engagement-log.json');
  
  if (!fs.existsSync(logFile)) return [];
  
  try {
    const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    return (log.sessions || []).filter(s => {
      if (!s.timestamp) return false;
      const sessionDate = toPSTDate(s.timestamp);
      return sessionDate === today;
    });
  } catch (e) {
    console.error('Error loading Reddit log:', e.message);
    return [];
  }
}

// ── Load today's schedule ──────────────────────────────────────────────────────
function loadTodaySchedule() {
  const today = getTodayPST();
  const scheduleFile = path.join(WORKSPACE, 'outreach/reddit/today-schedule.json');
  
  if (!fs.existsSync(scheduleFile)) return { sessions: [] };
  
  try {
    return JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
  } catch (e) {
    return { sessions: [] };
  }
}

// ── Load warm leads ────────────────────────────────────────────────────────────
function loadWarmLeads() {
  const leadsFile = path.join(WORKSPACE, 'outreach/reddit/warm-leads.json');
  if (!fs.existsSync(leadsFile)) return { leads: [] };
  
  try {
    return JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  } catch (e) {
    return { leads: [] };
  }
}

// ── Load karma state ──────────────────────────────────────────────────────────
function loadKarmaState() {
  const stateFile = path.join(WORKSPACE, 'outreach/reddit/karma-state.json');
  if (!fs.existsSync(stateFile)) return { totalKarma: 0, postKarma: 0, commentKarma: 0 };
  
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return {
      totalKarma: data.totalKarma || 0,
      postKarma: data.postKarma || 0,
      commentKarma: data.commentKarma || 0
    };
  } catch (e) {
    return { totalKarma: 0, postKarma: 0, commentKarma: 0 };
  }
}

// ── Load subreddit cooldowns ──────────────────────────────────────────────────
function loadSubredditCooldowns() {
  const cooldownFile = path.join(WORKSPACE, 'outreach/reddit/subreddit-cooldowns.json');
  if (!fs.existsSync(cooldownFile)) return {};
  
  try {
    return JSON.parse(fs.readFileSync(cooldownFile, 'utf8'));
  } catch (e) {
    return {};
  }
}

// ── Generate subreddit status ─────────────────────────────────────────────────
function getSubredditStatus(cooldowns) {
  // Config from planner
  const MUTED = ['Nails'];
  const COOLDOWNS = {
    'Nails': 3,
    'beauty': 2,
  };
  const SUBS = [
    'Nails', 'beauty', 'femalehairadvice', 'SkincareAddicts',
    '30PlusSkinCare', 'curlyhair', 'longhair'
  ];
  
  const today = new Date(getTodayPST());
  const lines = [];
  
  SUBS.forEach(sub => {
    if (MUTED.includes(sub)) {
      lines.push(`• r/${sub} — MUTED ⛔️`);
    } else if (cooldowns[sub] && COOLDOWNS[sub]) {
      const lastHit = new Date(cooldowns[sub] + 'T00:00:00');
      if (isNaN(lastHit.getTime())) {
        lines.push(`• r/${sub} — available ✅`);
        return;
      }
      const availableDate = new Date(lastHit.getTime() + (COOLDOWNS[sub] * 24 * 60 * 60 * 1000));
      const availStr = availableDate.toISOString().split('T')[0];
      if (availableDate <= today) {
        lines.push(`• r/${sub} — available ✅`);
      } else {
        lines.push(`• r/${sub} — cooling, available ${availStr}`);
      }
    } else {
      lines.push(`• r/${sub} — available ✅`);
    }
  });
  
  return lines.join('\n');
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

// ── Calculate karma delta ─────────────────────────────────────────────────────
function calculateKarmaDelta(snapshotsData, today) {
  const snapshots = snapshotsData.snapshots || [];
  const todaySnapshot = snapshots.find(s => s.date === today);
  const yesterday = getYesterdayPST();
  const yesterdaySnapshot = snapshots.find(s => s.date === yesterday);
  
  if (todaySnapshot && yesterdaySnapshot) {
    return todaySnapshot.reddit_karma - yesterdaySnapshot.reddit_karma;
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

console.log(`\n📖 Reddit Daily Summary — ${todayDisplay}\n`);

// Load data
const sessions = loadTodaySessions();
const schedule = loadTodaySchedule();
const warmLeads = loadWarmLeads();
const karma = loadKarmaState();
const snapshots = loadSnapshots();
const cooldowns = loadSubredditCooldowns();

// Calculate stats
const sessionsCompleted = sessions.length;
const sessionsScheduled = (schedule.sessions || []).filter(s => s.n).length;
const sessionsIncomplete = (schedule.sessions || []).filter(s => s.n && !s.done).length;
const commentsPosted = sessions.filter(s => s.type === 'comment').length;
const dmsSent = sessions.filter(s => s.type === 'dm').length;
const postsPosted = sessions.filter(s => s.type === 'post').length;

// Karma delta
const karmaDelta = calculateKarmaDelta(snapshots, todayPST);

// Warm lead counts by status
const leadCounts = {
  found: (warmLeads.leads || []).filter(l => l.status === 'found').length,
  commented: (warmLeads.leads || []).filter(l => l.status === 'commented').length,
  dm_sent: (warmLeads.leads || []).filter(l => l.status === 'dm-sent').length,
  replied: (warmLeads.leads || []).filter(l => l.status === 'replied').length
};

// Build message
let message = `📖 *Reddit Daily Summary — ${todayDisplay}*\n\n`;
message += `*Account:* u/Alive_Kick7098\n\n`;
message += `*Sessions:*\n`;
message += `├ Completed: ${sessionsCompleted}\n`;
message += `├ Scheduled: ${sessionsScheduled}\n`;
message += `├ Incomplete: ${sessionsIncomplete}\n`;
message += `├ Comments posted: ${commentsPosted}\n`;
message += `├ DMs sent: ${dmsSent}\n`;
message += `└ Posts posted: ${postsPosted}\n\n`;

message += `*Karma:*\n`;
message += `├ Post: ${karma.postKarma}\n`;
message += `├ Comment: ${karma.commentKarma}\n`;
message += `└ Total: ${karma.totalKarma} (${karmaDelta >= 0 ? '+' : ''}${karmaDelta} today)\n\n`;

message += `*Warm Leads:*\n`;
message += `├ Found: ${leadCounts.found}\n`;
message += `├ Commented: ${leadCounts.commented}\n`;
message += `├ DM sent: ${leadCounts.dm_sent}\n`;
message += `└ Replied: ${leadCounts.replied}\n\n`;

message += `*SUBREDDIT STATUS:*\n`;
message += getSubredditStatus(cooldowns) + `\n\n`;

if (dmsSent > 0) {
  const dmSessions = sessions.filter(s => s.type === 'dm');
  message += `*DMs Sent Today:*\n`;
  dmSessions.slice(0, 5).forEach(s => {
    message += `├ u/${s.author || 'unknown'} — ${s.painType || s.topic || 'general'}\n`;
  });
  message += `\n`;
}

if (postsPosted > 0) {
  const postSessions = sessions.filter(s => s.type === 'post');
  message += `*Posts Posted Today:*\n`;
  postSessions.slice(0, 3).forEach(s => {
    message += `├ r/${s.subreddit || 'unknown'}: ${s.postTitle || 'Untitled'}\n`;
    message += `│  ${s.postUrl || ''}\n`;
  });
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
  platform: 'reddit',
  account: 'u/Alive_Kick7098',
  sessions_completed: sessionsCompleted,
  sessions_scheduled: sessionsScheduled,
  sessions_incomplete: sessionsIncomplete,
  comments_posted: commentsPosted,
  dms_sent: dmsSent,
  posts_posted: postsPosted,
  karma: {
    post: karma.postKarma,
    comment: karma.commentKarma,
    total: karma.totalKarma,
    delta: karmaDelta
  },
  warm_leads: {
    found: leadCounts.found,
    commented: leadCounts.commented,
    dm_sent: leadCounts.dm_sent,
    replied: leadCounts.replied
  },
  dm_details: sessions.filter(s => s.type === 'dm').slice(0, 10),
  post_details: sessions.filter(s => s.type === 'post').slice(0, 5),
  raw_summary: message
};

// Save to file
const summaryDir = path.join(WORKSPACE, 'dashboard/data/summaries/reddit');
if (!fs.existsSync(summaryDir)) fs.mkdirSync(summaryDir, { recursive: true });
const summaryFile = path.join(summaryDir, `${todayPST}.json`);
fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2));
console.log(`✓ Summary saved to: ${summaryFile}`);

// Send Telegram
sendTelegram(message);

console.log('\n✅ Reddit daily summary done.\n');
