#!/usr/bin/env node
/**
 * daily-engagement-summary.js
 * Checks engagement on all comments/replies from today and sends a summary via Telegram.
 * Run at 11:30pm PST daily via cron.
 * 
 * FIXED (Mar 17):
 * - Bug 1: Sessions showing 0 - Fixed timezone handling (now uses PST for all date comparisons)
 * - Bug 2: +0 today on karma/followers - Fixed delta calculation with proper history tracking
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
  return `${parts[2]}-${parts[0]}-${parts[1]}`; // YYYY-MM-DD
}

// ── Helper: Parse timestamp to PST date ─────────────────────────────────────────
function toPSTDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const pstOptions = { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', pstOptions).format(date).split('/');
  return `${parts[2]}-${parts[0]}-${parts[1]}`; // YYYY-MM-DD
}

// ── Helper: Get yesterday's date in PST ─────────────────────────────────────────
function getYesterdayPST() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const pstOptions = { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', pstOptions).format(now).split('/');
  return `${parts[2]}-${parts[0]}-${parts[1]}`; // YYYY-MM-DD
}

// ── Load today's engagement logs ─────────────────────────────────────────────
function loadTodaySessions(platform) {
  const today = getTodayPST();
  let logFile;
  
  if (platform === 'instagram') {
    logFile = path.join(WORKSPACE, 'outreach/instagram/engagement-log.json');
  } else if (platform === 'x') {
    logFile = path.join(WORKSPACE, 'outreach/x/engagement-log.json');
  } else if (platform === 'reddit') {
    logFile = path.join(WORKSPACE, 'outreach/reddit/engagement-log.json');
  }
  
  if (!fs.existsSync(logFile)) return [];
  
  try {
    const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    return (log.sessions || []).filter(s => {
      if (!s.timestamp) return false;
      const sessionDate = toPSTDate(s.timestamp);
      return sessionDate === today;
    });
  } catch (e) {
    console.error(`Error loading ${platform} log:`, e.message);
    return [];
  }
}

// ── Load daily snapshots ─────────────────────────────────────────────────────
function loadSnapshots() {
  const snapshotsFile = path.join(WORKSPACE, 'dashboard/data/snapshots.json');
  if (!fs.existsSync(snapshotsFile)) return { snapshots: [] };
  
  try {
    return JSON.parse(fs.readFileSync(snapshotsFile, 'utf8'));
  } catch (e) {
    return { snapshots: [] };
  }
}

// ── Load follower state ──────────────────────────────────────────────────────
function loadFollowerState(platform) {
  const stateFile = path.join(WORKSPACE, `outreach/${platform}/follower-state.json`);
  if (!fs.existsSync(stateFile)) return { lastCount: null, history: [] };
  
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    return { lastCount: null, history: [] };
  }
}

// ── Load Reddit karma state ──────────────────────────────────────────────────
function loadKarmaState() {
  const stateFile = path.join(WORKSPACE, 'outreach/reddit/karma-state.json');
  if (!fs.existsSync(stateFile)) return { lastTotalKarma: null, lastPostKarma: null, lastCommentKarma: null, history: [] };
  
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return {
      lastTotalKarma: data.totalKarma || data.lastTotalKarma || null,
      lastPostKarma: data.postKarma || data.lastPostKarma || null,
      lastCommentKarma: data.commentKarma || data.lastCommentKarma || null,
      history: data.history || []
    };
  } catch (e) {
    return { lastTotalKarma: null, lastPostKarma: null, lastCommentKarma: null, history: [] };
  }
}

// ── Calculate delta from snapshots ───────────────────────────────────────────
function calculateDeltaFromSnapshots(snapshots, today, key) {
  // Find today's snapshot
  const todaySnapshot = snapshots.find(s => s.date === today);
  const currentValue = todaySnapshot ? todaySnapshot[key] : null;
  
  // Find yesterday's snapshot
  const yesterday = getYesterdayPST();
  const yesterdaySnapshot = snapshots.find(s => s.date === yesterday);
  const yesterdayValue = yesterdaySnapshot ? yesterdaySnapshot[key] : null;
  
  // If we have both, calculate delta
  if (currentValue !== null && yesterdayValue !== null) {
    return currentValue - yesterdayValue;
  }
  
  // If only current, no baseline yet
  if (currentValue !== null && yesterdayValue === null) {
    return '--';
  }
  
  // No data
  return 0;
}

// ── Calculate engagement stats ───────────────────────────────────────────────
function calculateEngagementStats(sessions) {
  const total = sessions.length;
  const withEngagement = sessions.filter(s => s.engagement && (s.engagement.likesOnOurComment || s.engagement.likesOnOurReply || s.engagement.repliesToOurComment || s.engagement.repliesToOurReply)).length;
  
  let totalLikes = 0;
  let totalReplies = 0;
  let bestPost = null;
  let bestEngagement = 0;
  
  sessions.forEach(s => {
    if (!s.engagement) return;
    
    const likes = s.engagement.likesOnOurComment || s.engagement.likesOnOurReply || 0;
    const replies = s.engagement.repliesToOurComment || s.engagement.repliesToOurReply || 0;
    const sessionTotal = likes + replies;
    
    totalLikes += likes;
    totalReplies += replies;
    
    if (sessionTotal > bestEngagement) {
      bestEngagement = sessionTotal;
      bestPost = {
        account: s.account || s.targetHandle,
        url: s.postUrl,
        comment: s.comment || s.replyText,
        likes,
        replies
      };
    }
  });
  
  return {
    total,
    withEngagement,
    totalLikes,
    totalReplies,
    bestPost,
    avgLikes: total > 0 ? (totalLikes / total).toFixed(1) : 0,
    avgReplies: total > 0 ? (totalReplies / total).toFixed(1) : 0
  };
}

// ── Calculate follower/karma delta ───────────────────────────────────────────
function calculateDelta(history, todayPST) {
  if (!history || history.length === 0) return 0;
  
  const yesterday = getYesterdayPST();
  
  // Find yesterday's last snapshot (baseline)
  const yesterdaySnapshots = history.filter(h => {
    const hDate = toPSTDate(h.timestamp);
    return hDate === yesterday;
  });
  
  // Find today's snapshots
  const todaySnapshots = history.filter(h => {
    const hDate = toPSTDate(h.timestamp);
    return hDate === todayPST;
  });
  
  // If we have both yesterday and today, calculate delta
  if (yesterdaySnapshots.length > 0 && todaySnapshots.length > 0) {
    const yesterdayLast = yesterdaySnapshots[yesterdaySnapshots.length - 1];
    const todayLast = todaySnapshots[todaySnapshots.length - 1];
    
    const yesterdayCount = yesterdayLast.count || yesterdayLast.totalKarma || 0;
    const todayCount = todayLast.count || todayLast.totalKarma || 0;
    
    return todayCount - yesterdayCount;
  }
  
  // If no yesterday data, try to find the most recent snapshot before today
  if (todaySnapshots.length > 0) {
    const todayLast = todaySnapshots[todaySnapshots.length - 1];
    const todayCount = todayLast.count || todayLast.totalKarma || 0;
    
    // Find the most recent snapshot before today
    const priorSnapshots = history.filter(h => {
      const hDate = toPSTDate(h.timestamp);
      return hDate < todayPST;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (priorSnapshots.length > 0) {
      const priorLast = priorSnapshots[0];
      const priorCount = priorLast.count || priorLast.totalKarma || 0;
      return todayCount - priorCount;
    }
  }
  
  return 0;
}

// ── Send Telegram message ────────────────────────────────────────────────────
function sendTelegram(message) {
  const result = spawnSync('openclaw', [
    'message', 'send',
    '--channel', 'telegram',
    '--target', TELEGRAM_TARGET,
    '--message', message
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  
  if (result.status === 0) {
    console.log('✓ Telegram sent');
  } else {
    console.error('✗ Failed to send Telegram:', result.stderr);
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

console.log(`\n📊 Daily Engagement Summary for ${todayDisplay} (${todayPST})\n`);

// Load data
const igSessions = loadTodaySessions('instagram');
const xSessions = loadTodaySessions('x');
const redditSessions = loadTodaySessions('reddit');

const igStats = calculateEngagementStats(igSessions);
const xStats = calculateEngagementStats(xSessions);
const redditStats = calculateEngagementStats(redditSessions);

const igFollowers = loadFollowerState('instagram');
const xFollowers = loadFollowerState('x');
const redditKarma = loadKarmaState();

// Load snapshots for delta calculation
const snapshots = loadSnapshots();

// Calculate deltas from snapshots (preferred) or fallback to history
let igDelta = calculateDeltaFromSnapshots(snapshots.snapshots, todayPST, 'ig_followers');
let xDelta = calculateDeltaFromSnapshots(snapshots.snapshots, todayPST, 'x_followers');
let redditDelta = calculateDeltaFromSnapshots(snapshots.snapshots, todayPST, 'reddit_karma');

// Fallback to history-based calculation if snapshots don't have data
if (igDelta === 0) igDelta = calculateDelta(igFollowers.history, todayPST);
if (xDelta === 0) xDelta = calculateDelta(xFollowers.history, todayPST);
if (redditDelta === 0) redditDelta = calculateDelta(redditKarma.history, todayPST);

// Build summary message
let message = `📊 *Daily Engagement Summary — ${todayDisplay}*\n\n`;

// Instagram section
message += `*INSTAGRAM (@stacyd0nna)*\n`;
message += `├ Sessions: ${igStats.total}\n`;
message += `├ Comments with engagement: ${igStats.withEngagement}/${igStats.total}\n`;
message += `├ Total likes on our comments: ${igStats.totalLikes}\n`;
message += `├ Total replies to our comments: ${igStats.totalReplies}\n`;
message += `├ Avg likes/comment: ${igStats.avgLikes}\n`;
message += `├ Avg replies/comment: ${igStats.avgReplies}\n`;
const igDeltaStr = igDelta === '--' ? '+--' : (igDelta >= 0 ? '+' + igDelta : igDelta);
message += `└ Followers: ${igFollowers.lastCount || 'N/A'} (${igDeltaStr} today)\n\n`;

if (igStats.bestPost) {
  message += `🏆 Best IG post: @${igStats.bestPost.account}\n`;
  message += `   "${igStats.bestPost.comment?.substring(0, 60)}${igStats.bestPost.comment?.length > 60 ? '...' : ''}"\n`;
  message += `   ${igStats.bestPost.likes} likes, ${igStats.bestPost.replies} replies\n\n`;
}

// X section
message += `*X (@stacydonna0x)*\n`;
message += `├ Sessions: ${xStats.total}\n`;
message += `├ Replies with engagement: ${xStats.withEngagement}/${xStats.total}\n`;
message += `├ Total likes on our replies: ${xStats.totalLikes}\n`;
message += `├ Total replies to our replies: ${xStats.totalReplies}\n`;
message += `├ Avg likes/reply: ${xStats.avgLikes}\n`;
message += `├ Avg replies/reply: ${xStats.avgReplies}\n`;
const xDeltaStr = xDelta === '--' ? '+--' : (xDelta >= 0 ? '+' + xDelta : xDelta);
message += `└ Followers: ${xFollowers.lastCount || 'N/A'} (${xDeltaStr} today)\n\n`;

if (xStats.bestPost) {
  message += `🏆 Best X reply: @${xStats.bestPost.account}\n`;
  message += `   "${xStats.bestPost.comment?.substring(0, 60)}${xStats.bestPost.comment?.length > 60 ? '...' : ''}"\n`;
  message += `   ${xStats.bestPost.likes} likes, ${xStats.bestPost.replies} replies\n\n`;
}

// Reddit section
message += `*REDDIT (u/Alive_Kick7098)*\n`;
message += `├ Sessions: ${redditStats.total}\n`;
message += `├ Comments posted: ${redditStats.total}\n`;
message += `├ Post karma: ${redditKarma.lastPostKarma || 'N/A'}\n`;
message += `├ Comment karma: ${redditKarma.lastCommentKarma || 'N/A'}\n`;
const redditDeltaStr = redditDelta === '--' ? '+--' : (redditDelta >= 0 ? '+' + redditDelta : redditDelta);
message += `└ Total karma: ${redditKarma.lastTotalKarma || 'N/A'} (${redditDeltaStr} today)\n\n`;

// Totals
const totalSessions = igStats.total + xStats.total + redditStats.total;
const totalEngagement = igStats.totalLikes + igStats.totalReplies + xStats.totalLikes + xStats.totalReplies;

message += `*DAY TOTALS*\n`;
message += `├ Total sessions: ${totalSessions}\n`;
message += `├ Total engagement received: ${totalEngagement}\n`;
message += `├ IG followers: ${igFollowers.lastCount || 'N/A'}\n`;
message += `├ X followers: ${xFollowers.lastCount || 'N/A'}\n`;
message += `└ Reddit karma: ${redditKarma.lastTotalKarma || 'N/A'}\n`;

console.log(message);
sendTelegram(message);

// Save structured summary to file
const phtNow = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
const summaryDir = path.join(WORKSPACE, 'dashboard/data/summaries/engagement');
if (!fs.existsSync(summaryDir)) fs.mkdirSync(summaryDir, { recursive: true });

const summaryData = {
  date: todayPST,
  generated_at: new Date().toISOString(),
  generated_at_pht: phtNow,
  platform: 'combined',
  instagram: {
    sessions_completed: igStats.total,
    sessions_with_engagement: igStats.withEngagement,
    comments_posted: igStats.total,
    total_likes_received: igStats.totalLikes,
    total_replies_received: igStats.totalReplies,
    avg_likes_per_comment: parseFloat(igStats.avgLikes),
    avg_replies_per_comment: parseFloat(igStats.avgReplies),
    followers: {
      current: igFollowers.lastCount || 0,
      delta: typeof igDelta === 'number' ? igDelta : 0
    },
    best_post: igStats.bestPost || null
  },
  x: {
    sessions_completed: xStats.total,
    sessions_with_engagement: xStats.withEngagement,
    replies_posted: xStats.total,
    total_likes_received: xStats.totalLikes,
    total_replies_received: xStats.totalReplies,
    avg_likes_per_reply: parseFloat(xStats.avgLikes),
    avg_replies_per_reply: parseFloat(xStats.avgReplies),
    followers: {
      current: xFollowers.lastCount || 0,
      delta: typeof xDelta === 'number' ? xDelta : 0
    },
    best_post: xStats.bestPost || null
  },
  reddit: {
    sessions_completed: redditStats.total,
    comments_posted: redditStats.total,
    post_karma: redditKarma.lastPostKarma || 0,
    comment_karma: redditKarma.lastCommentKarma || 0,
    total_karma: redditKarma.lastTotalKarma || 0,
    karma_delta: typeof redditDelta === 'number' ? redditDelta : 0
  },
  totals: {
    total_sessions: totalSessions,
    total_engagement_received: totalEngagement
  },
  raw_summary: message
};

const summaryFile = path.join(summaryDir, `${todayPST}.json`);
fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2));
console.log(`✓ Summary saved to: ${summaryFile}`);

console.log('\n✅ Daily engagement summary done.\n');
