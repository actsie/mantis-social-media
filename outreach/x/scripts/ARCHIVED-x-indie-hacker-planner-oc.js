#!/usr/bin/env node
/**
 * x-indie-hacker-planner.js
 * Generates daily X search-based outreach sessions for indie hackers / contractors / real estate.
 * Run at 6:02am PST daily via master cron.
 * 
 * This is search-based discovery, not account-based.
 * We find people expressing real struggle and reply with grounded observations.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE  = '/Users/mantisclaw/.openclaw/workspace';
const LOG_FILE   = path.join(WORKSPACE, 'outreach/x/indie-hacker-log.json');
const TRACKER_FILE = path.join(WORKSPACE, 'outreach/x/indie-hacker-tracker.json');
const SCHED_FILE = path.join(WORKSPACE, 'outreach/x/indie-hacker-morning-schedule.json');
const FOLLOWER_STATE_FILE = path.join(WORKSPACE, 'outreach/x/follower-state.json');

const MIN_HOUR      = 7;    // 7:00 AM PST
const MAX_HOUR      = 22;   // 10:00 PM PST
const MIN_GAP       = 45;   // min minutes between sessions
const CLUSTER_MAX   = 90;   // "close pair" threshold
const LONG_GAP_MIN  = 180;  // "long break" threshold

// ── Search queries ──────────────────────────────────────────────────────────
// Focused on indie hackers / SaaS founders / solo builders
// Each query has 2 backup queries for retry logic if primary returns no suitable posts
const SEARCH_QUERIES = [
  // Core indie hacker struggles (highest priority)
  { query: 'stuck building in public', type: 'indie-hacker', label: 'stuck building', backup: ['no traction', 'can\'t get users'] },
  { query: 'no traction', type: 'indie-hacker', label: 'no traction', backup: ['zero revenue', 'stuck at $0'] },
  { query: 'can\'t get users', type: 'indie-hacker', label: 'no users', backup: ['no traction', 'should I keep going'] },
  { query: 'should I keep going', type: 'indie-hacker', label: 'doubt', backup: ['starting to not care', 'losing interest'] },
  { query: 'spent months building', type: 'indie-hacker', label: 'wasted time', backup: ['unfinished SaaS', 'can\'t ship'] },
  { query: 'starting to not care', type: 'indie-hacker', label: 'losing interest', backup: ['should I keep going', 'doubt'] },
  { query: 'unfinished SaaS', type: 'indie-hacker', label: 'unfinished', backup: ['spent months building', 'can\'t ship'] },
  { query: 'can\'t ship', type: 'indie-hacker', label: 'can\'t ship', backup: ['unfinished SaaS', 'stuck building'] },
  { query: 'overwhelmed founder', type: 'indie-hacker', label: 'overwhelmed', backup: ['golden handcuffs', 'burnout'] },
  { query: 'zero revenue', type: 'indie-hacker', label: 'zero revenue', backup: ['stuck at $0', 'no traction'] },
  { query: 'golden handcuffs', type: 'indie-hacker', label: 'golden handcuffs', backup: ['overwhelmed founder', 'quit my job'] },
  { query: 'stuck at $0', type: 'indie-hacker', label: 'stuck at zero', backup: ['zero revenue', 'no users'] },
  
  // Extended indie hacker pain points
  { query: 'quit my job to build', type: 'indie-hacker', label: 'quit job', backup: ['first time founder', 'solo founder'] },
  { query: 'first time founder', type: 'indie-hacker', label: 'first founder', backup: ['learning to code', 'non technical founder'] },
  { query: 'solo founder', type: 'indie-hacker', label: 'solo founder', backup: ['building alone', 'no cofounder'] },
  { query: 'launching soon', type: 'indie-hacker', label: 'launching', backup: ['about to launch', 'shipping soon'] },
  { query: 'just launched', type: 'indie-hacker', label: 'just launched', backup: ['launched yesterday', 'launch day'] },
  { query: 'nobody is using', type: 'indie-hacker', label: 'nobody using', backup: ['crickets after launch', 'launched to nothing'] },
  { query: 'churn is killing', type: 'indie-hacker', label: 'churn', backup: ['users leaving', 'retention problem'] },
  { query: 'can\'t find PMF', type: 'indie-hacker', label: 'no PMF', backup: ['searching for PMF', 'product market fit'] },
  { query: 'bootstrapping', type: 'indie-hacker', label: 'bootstrapping', backup: ['self funded', 'no VC'] },
  { query: 'runway running out', type: 'indie-hacker', label: 'runout runway', backup: ['months left', 'need revenue'] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return n.toString().padStart(2, '0'); }
function minsToHHMM(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateTimes(count) {
  const lo = MIN_HOUR * 60;
  const hi = MAX_HOUR * 60;
  for (let attempt = 0; attempt < 10000; attempt++) {
    const times = Array.from({ length: count }, () => rand(lo, hi)).sort((a, b) => a - b);
    const gaps  = times.slice(1).map((t, i) => t - times[i]);
    if (gaps.some(g => g < MIN_GAP))        continue;
    if (!gaps.some(g => g <= CLUSTER_MAX))  continue;
    if (!gaps.some(g => g >= LONG_GAP_MIN)) continue;
    return times;
  }
  throw new Error('Could not generate valid schedule after 10000 attempts');
}

function todayPST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function getLAOffset() {
  const tzDate  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const utcDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' }));
  const diffH   = Math.round((tzDate - utcDate) / 3600000);
  const sign    = diffH >= 0 ? '+' : '-';
  return `${sign}${Math.abs(diffH).toString().padStart(2, '0')}:00`;
}

function targetDate() {
  return process.env.DATE_OVERRIDE || todayPST();
}

// ── Load log ──────────────────────────────────────────────────────────────────
let log = { sessions: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) {}
}

// Track who we've engaged with in last 7 days (avoid repeat replies to same person)
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recentTargets = new Set(
  (log.sessions || [])
    .filter(s => s.type === 'indie-hacker' && new Date(s.timestamp).getTime() > sevenDaysAgo)
    .map(s => s.targetHandle)
);

// ── Generate schedule ────────────────────────────────────────────────────────
// Morning wave: 3 sessions (part of 7-8 total across all 3 waves)
const SESSION_COUNT = 3;
const today   = targetDate();
const times   = generateTimes(SESSION_COUNT);
const gaps    = times.slice(1).map((t, i) => t - times[i]);

// Shuffle queries and assign to sessions
const shuffledQueries = shuffle([...SEARCH_QUERIES]);

const sessions = times.map((t, i) => {
  const query = shuffledQueries[i % shuffledQueries.length];
  return {
    n:      i + 1,
    time:   minsToHHMM(t),
    query:  query.query,
    type:   query.type,
    label:  query.label,
    backup: query.backup,
    done:   false
  };
});

console.log(`\n📅 X indie hacker schedule for ${today} (${SESSION_COUNT} sessions)\n`);
sessions.forEach(s => console.log(`  ${s.n}. ${s.time}  Search: ${s.label} (${s.type})`));
console.log(`\n  Gaps (min): ${gaps.join(', ')}`);
console.log(`  Cluster ≤90min: ${gaps.some(g => g <= 90)}`);
console.log(`  Long gap ≥3hrs: ${gaps.some(g => g >= 180)}`);

fs.writeFileSync(SCHED_FILE, JSON.stringify({ date: today, sessionCount: SESSION_COUNT, sessions, track: 'indie-hacker' }, null, 2));
console.log(`\n✓ Written: today-schedule.json (indie-hacker track)\n`);

// ── Create session crons ─────────────────────────────────────────────────────
sessions.forEach(s => {
  const msg = [
    `X INDIE HACKER SESSION ${s.n}/${SESSION_COUNT} for ${today} — post as @stacydonna0x.`,
    ``,
    `BROWSER: Use profile="openclaw" for ALL browser tool calls. This browser should be logged into X as @stacydonna0x. Do NOT use profile="chrome" or the Chrome extension relay.`,
    ``,
    `Search query: ${s.query}`,
    `Target type: ${s.type}`,
    `Backup queries (retry in order if previous returns nothing):`,
    `  - Backup #1: ${s.backup[0]}`,
    `  - Backup #2: ${s.backup[1] || s.backup[0]}`,
    `  - Backup #3: Check indie-hacker-query-success.json for historically successful queries`,
    ``,
    `CRITICAL: Read these files first:`,
    `  /Users/mantisclaw/.openclaw/workspace/outreach/x/tone-guide.md`,
    `  /Users/mantisclaw/.openclaw/workspace/outreach/x/accounts.md`,
    `  /Users/mantisclaw/.openclaw/workspace/outreach/x/engagement-log.json`,
    ``,
    `GOAL: Find 1 person expressing real struggle and leave a grounded, observational reply.`,
    ``,
    `STEPS:`,
    ``,
    `0. ⚡ FOLLOWER COUNT CHECK (FIRST STEP — before any engagement):`,
    `   Navigate to https://x.com/stacydonna0x and capture the follower count from the profile.`,
    `   `,
    `   Log the follower count:`,
    `   const fs = require('fs');`,
    `   const statePath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/follower-state.json';`,
    `   const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));`,
    `   const now = new Date().toISOString();`,
    `   const count = FOLLOWER_COUNT_YOU_SAW; // replace with actual number`,
    `   const delta = state.lastCount ? count - state.lastCount : 0;`,
    `   state.history.push({ date: now.split('T')[0], count, delta, session: ${s.n} });`,
    `   state.lastCheck = now;`,
    `   state.lastCount = count;`,
    `   fs.writeFileSync(statePath, JSON.stringify(state, null, 2));`,
    `   `,
    `   Include in Telegram report: "Followers: ${state.lastCount || 'N/A'} (${delta >= 0 ? '+' : ''}${delta})"`,
    `   `,
    `1. Navigate to X search: https://x.com/search?q=${encodeURIComponent(s.query)}`,
    ``,
    `2. Filter to "Latest" tab if not already selected.`,
    ``,
    `3. Scan the results (scroll 2-3 pages). Look for posts that show:`,
    `   - Real doubt or struggle (not humblebragging)`,
    `   - Stuck between two directions`,
    `   - No traction / no users after months of building`,
    `   - Losing motivation, questioning whether to continue`,
    `   - Overwhelmed founder, burnout, golden handcuffs`,
    `   - Just launched to crickets, churn problems, can't find PMF`,
    ``,
    `4. SKIP these:`,
    `   - Design feedback requests ("rate my landing page")`,
    `   - Success flexes ("just hit $10k MRR!")`,
    `   - Generic engagement bait ("what are you building?")`,
    `   - Crypto/web3/NFT projects`,
    `   - Posts with no real substance`,
    `   - People we've replied to in the last 7 days (check engagement-log.json)`,
    ``,
    `4b. RETRY LOGIC — If no suitable posts found after 2-3 pages:`,
    `    Try backup #1: https://x.com/search?q=${encodeURIComponent(s.backup[0])}`,
    `    Scroll 2-3 pages. Still nothing? Try backup #2: https://x.com/search?q=${encodeURIComponent(s.backup[1] || s.backup[0])}`,
    `    Scroll 2-3 pages. Still nothing? Check indie-hacker-query-success.json for backup #3:`,
    `      const fs = require('fs');`,
    `      const successPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/indie-hacker-query-success.json';`,
    `      const successData = JSON.parse(fs.readFileSync(successPath, 'utf8'));`,
    `      const successfulQueries = Object.entries(successData.querySuccess)`,
    `        .filter(([q, data]) => data.successCount > 0)`,
    `        .sort((a, b) => b[1].successCount - a[1].successCount)`,
    `        .map(([q]) => q);`,
    `      If successfulQueries.length > 0, try: https://x.com/search?q=${encodeURIComponent('${s.backup[1] || s.backup[0]}')}`,
    `    Only skip if ALL 4 queries (primary + backup #1 + backup #2 + backup #3) return nothing suitable.`,
    ``,
    `5. Read the full post + any context. Find the line that contains the truth.`,
    ``,
    `6. Draft a reply using this formula:`,
    `   - Their line (the one with truth inside it)`,
    `   - What that probably means`,
    `   - One cost or consequence`,
    `   - End — stop early, don't over-conclude`,
    ``,
    `7. ⚡ HUMANIZER (MANDATORY — DO NOT SKIP):`,
    `   Before posting, run your draft through the humanizer skill.`,
    `   This is NON-NEGOTIABLE. Every reply must be humanized before posting.`,
    `   `,
    `   How to use:`,
    `   - Call the humanizer skill with your draft reply`,
    `   - Use the humanized output (not your original draft)`,
    `   - If humanizer suggests changes, accept them`,
    `   - DO NOT post without running humanizer first.`,
    `   `,
    `   After humanizing, scan your reply:`,
    `   - NO em dashes (—) or hyphens (-) → use period instead`,
    `   - NO quotation marks → rephrase`,
    `   - NO starting with "the" → rewrite the opening`,
    `   - NO "you said" or "you asked" → remove`,
    `   - NO banned words: weird, resonate, amazing, stunning, genuinely, actually, vibe, plot twist, lands, sticks, clicks, read/reads`,
    `   - NO calling people out or making them feel bad (no "that question already answers itself", no "you're wrong", no "you did X wrong")`,
    `   - NO repetitive phrases from earlier today (check engagement-log.json — if you used "costs more than", "silence", "that [thing] [consequence]" already, write differently)`,
    `   - 1-3 sentences max → trim if longer`,
    `   - Write like a human who's been there, not like someone analyzing from above`,
    ``,
    `8. ⚡ PRE-POST CHECK (STOP AND VERIFY):`,
    `   Before clicking Reply, ask yourself:`,
    `   - Does this reply sound like it came from a real person who's felt this?`,
    `   - Am I calling them out or making them feel dumb? If yes, rewrite.`,
    `   - Did I use any phrase I've already used today? Check engagement-log.json. If yes, rewrite.`,
    `   - Is this 1-3 sentences? If longer, cut it down.`,
    `   `,
    `   Only post if ALL answers are good. Otherwise rewrite first.`,
    ``,
    `9. Click Reply → type your reply → click Reply button to post.`,
    ``,
    `9. Like the post (click the heart icon).`,
    ``,
    `9.5. ⚡ ENGAGEMENT CHECK (wait 60-90 seconds after posting, then check):`,
    `    Navigate back to the post you replied to.`,
    `    Find your reply and check:`,
    `    - How many likes did your reply get?`,
    `    - Did anyone reply to your reply?`,
    `    - Did the original poster like or reply to your reply?`,
    `    `,
    `    Log engagement:`,
    `    const fs = require('fs');`,
    `    const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/engagement-log.json';`,
    `    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `    const lastSession = log.sessions[log.sessions.length - 1];`,
    `    if (lastSession) {`,
    `      lastSession.engagement = {`,
    `        checkedAt: new Date().toISOString(),`,
    `        likesOnOurReply: LIKES_COUNT, // replace with actual number (0 if none)`,
    `        repliesToOurReply: REPLIES_COUNT, // replace with actual number (0 if none)`,
    `        originalPosterEngaged: true/false, // did OP like or reply?`,
    `        replyTexts: ['reply 1 text', 'reply 2 text'] // array of reply texts, or [] if none`,
    `      };`,
    `      fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
    `    }`,
    `    `,
    `    If no engagement (0 likes, 0 replies), still log it with zeros.`,
    `    `,
    `10. Log to engagement-log.json using this EXACT method:`,
    `    const fs = require('fs');`,
    `    const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/engagement-log.json';`,
    `    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `    log.sessions.push({`,
    `      timestamp: new Date().toISOString(),`,
    `      type: 'indie-hacker',`,
    `      searchQuery: '${s.query}',`,
    `      targetHandle: '@HANDLE',`,
    `      postUrl: 'FULL_POST_URL',`,
    `      postText: 'POST TEXT',`,
    `      replyText: 'YOUR_REPLY',`,
    `      liked: true,`,
    `      platform: 'x',`,
    `      account: 'stacydonna0x',`,
    `      engagement: null`,
    `    });`,
    `    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
    ``,
    `11. Mark this session done in today-schedule.json:`,
    `    const schedPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/today-schedule.json';`,
    `    const sched = JSON.parse(fs.readFileSync(schedPath, 'utf8'));`,
    `    sched.sessions[${s.n - 1}].done = true;`,
    `    fs.writeFileSync(schedPath, JSON.stringify(sched, null, 2));`,
    ``,
    `12. Decide whether to follow:`,
    `    FOLLOW if:`,
    `    - They're actively building (not just talking about it)`,
    `    - They post regularly about their journey`,
    `    - They're in our ICP (indie hacker, contractor, real estate)`,
    `    - Their content is genuine, not promo-heavy`,
    `    `,
    `    SKIP if:`,
    `    - Mostly promo/spam`,
    `    - Crypto/web3/NFT focused`,
    `    - Already have 100K+ followers (can't build real relationship)`,
    `    - You already followed them in the last 30 days`,
    `    `,
    `    If following: Click Follow button on their profile.`,
    `    `,
    `13. Log to indie-hacker-tracker.json:`,
    `    const fs = require('fs');`,
    `    const trackerPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/indie-hacker-tracker.json';`,
    `    const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));`,
    `    tracker.engaged.push({`,
    `      date: new Date().toISOString().split('T')[0],`,
    `      handle: '@HANDLE',`,
    `      postUrl: 'POST_URL',`,
    `      replied: true,`,
    `      followed: true/false,`,
    `      liked: 1-3`,
    `    });`,
    `    if (followed) {`,
    `      tracker.follows.push({`,
    `        date: new Date().toISOString().split('T')[0],`,
    `        handle: '@HANDLE',`,
    `        profileUrl: 'https://x.com/HANDLE',`,
    `        building: 'what they\\'re building',`,
    `        notes: 'Posts regularly about X. X followers, X following. Not crypto/web3/NFT. Actively shipping/not shipping.',`,
    `        reason: 'actively building, genuine, in ICP',`,
    `        followBack: false // will update later if they follow back`,
    `      });`,
    `    }`,
    `    fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));`,
    ``,
    `14. Send a brief Telegram to ${'6241290513'}:`,
    `    Format:`,
    `    X IH Session ${s.n}/${SESSION_COUNT} ✅`,
    `    Target: @HANDLE`,
    `    Building: what they're building`,
    `    Struggle: what they expressed`,
    `    Our reply: "YOUR_REPLY_TEXT"`,
    `    Engagement: X likes, Y replies (check after 60-90s)`,
    `    OP engaged: yes/no`,
    `    Followed: yes/no`,
    `    Followers: COUNT (DELTA)`,
    `    `,
    `    ALWAYS include target="6241290513" — do NOT omit it.`,
    ``,
    `15. Log successful query to indie-hacker-query-success.json:`,
    `    const fs = require('fs');`,
    `    const successPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/indie-hacker-query-success.json';`,
    `    const successData = JSON.parse(fs.readFileSync(successPath, 'utf8'));`,
    `    const queryUsed = '${s.query}'; // or whichever backup query actually worked`,
    `    if (!successData.querySuccess[queryUsed]) {`,
    `      successData.querySuccess[queryUsed] = { successCount: 0, lastSuccess: null };`,
    `    }`,
    `    successData.querySuccess[queryUsed].successCount++;`,
    `    successData.querySuccess[queryUsed].lastSuccess = new Date().toISOString();`,
    `    successData.lastUpdated = new Date().toISOString();`,
    `    fs.writeFileSync(successPath, JSON.stringify(successData, null, 2));`,
    ``,
    `If no suitable post found after trying primary + backup #1 + backup #2 + backup #3:`,
    `Log as skipped with all queries tried:`,
    `    const fs = require('fs');`,
    `    const logPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/engagement-log.json';`,
    `    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));`,
    `    const successPath = '/Users/mantisclaw/.openclaw/workspace/outreach/x/indie-hacker-query-success.json';`,
    `    const successData = JSON.parse(fs.readFileSync(successPath, 'utf8'));`,
    `    const backup3 = Object.entries(successData.querySuccess)`,
    `      .filter(([q, data]) => data.successCount > 0)`,
    `      .sort((a, b) => b[1].successCount - a[1].successCount)[0];`,
    `    log.sessions.push({`,
    `      timestamp: new Date().toISOString(),`,
    `      type: 'indie-hacker',`,
    `      searchQuery: '${s.query}',`,
    `      backupQueries: ${JSON.stringify(s.backup)},`,
    `      queriesTried: ['${s.query}', '${s.backup[0]}', '${s.backup[1] || s.backup[0]}', backup3 ? backup3[0] : 'none (no historical successes)'],`,
    `      targetHandle: null,`,
    `      postUrl: null,`,
    `      postText: null,`,
    `      replyText: null,`,
    `      liked: false,`,
    `      platform: 'x',`,
    `      account: 'stacydonna0x',`,
    `      status: 'skipped',`,
    `      skipReason: 'No suitable posts found after trying primary + backup #1 + backup #2 + backup #3 (from success tracker)'`,
    `    });`,
    `    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));`,
  ].join('\n');

  const name = `x-ih-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
  const at   = `${today}T${s.time}:00${getLAOffset()}`;

  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', name,
    '--at',   at,
    '--message', msg,
    '--announce',
    '--delete-after-run',
    '--tz', 'America/Los_Angeles'
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  if (result.status === 0) {
    console.log(`✓ Cron: ${name} at ${s.time} → ${s.label}`);
  } else {
    console.error(`✗ Failed: ${name}\n${result.stderr}`);
    console.error(`  stdout: ${result.stdout}`);
  }
});

console.log('\n✅ X indie hacker daily planner done.\n');
