#!/usr/bin/env node
/**
 * x-daily-planner.js
 * Generates today's X (Twitter) engagement schedule and creates OpenClaw cron jobs.
 * Run at 5:55am PST daily via master cron.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE  = '/Users/mantisclaw/.openclaw/workspace';
const LOG_FILE   = path.join(WORKSPACE, 'outreach/x/engagement-log.json');
const SCHED_FILE = path.join(WORKSPACE, 'outreach/x/today-schedule.json');

const MIN_HOUR      = 6;    // 6:00 AM PST
const MAX_HOUR      = 23;   // 11:00 PM PST
const MIN_GAP       = 30;   // min minutes between any two sessions
const CLUSTER_MAX   = 90;   // "close pair" threshold (minutes)
const LONG_GAP_MIN  = 180;  // "long break" threshold (minutes)

// ── Target accounts ──────────────────────────────────────────────────────────
// Update status: 'confirmed' | 'verify'
// engagement: 'full' (reply+like) | 'like-only'
const ACCOUNTS = [
  // Nail creators — full engagement
  { handle: 'holotaco',        type: 'creator',    engagement: 'full',      status: 'confirmed' },
  { handle: 'N_P_Society',     type: 'creator',    engagement: 'full',      status: 'confirmed' },
  // removed: nailogical (inactive Jul 2024), hannahroxit (inactive Sep 2022), jackiemonttnail (inactive Dec 2021)
  // Nail brands — full engagement
  { handle: 'OPI_PRODUCTS',    type: 'nail-brand', engagement: 'full',      status: 'confirmed' },
  { handle: 'essie',           type: 'nail-brand', engagement: 'full',      status: 'confirmed' },
  { handle: 'sallyhansenusa',  type: 'nail-brand', engagement: 'full',      status: 'verify'    },
  { handle: 'zoyanailpolish',  type: 'nail-brand', engagement: 'full',      status: 'verify'    },
  { handle: 'ORLYbeauty',      type: 'nail-brand', engagement: 'full',      status: 'verify'    },
  { handle: 'ChinaGlazeNails', type: 'nail-brand', engagement: 'full',      status: 'verify'    },
  { handle: 'GelishNails',     type: 'nail-brand', engagement: 'full',      status: 'verify'    },
  { handle: 'OliveAndJune',    type: 'nail-brand', engagement: 'full',      status: 'verify'    },
  // Hair brands — like only (reply only if caption has technique detail)
  { handle: 'olaplex',         type: 'hair-brand', engagement: 'like-only', status: 'verify'    },
  { handle: 'redken',          type: 'hair-brand', engagement: 'like-only', status: 'verify'    },
  { handle: 'moroccanoil',     type: 'hair-brand', engagement: 'like-only', status: 'verify'    },
  { handle: 'OUAI',            type: 'hair-brand', engagement: 'like-only', status: 'verify'    },
  { handle: 'IGK_hair',        type: 'hair-brand', engagement: 'like-only', status: 'verify'    },
  // Skincare — like only
  { handle: 'CeraVe',          type: 'skincare',   engagement: 'like-only', status: 'verify'    },
  { handle: 'TheOrdinary',     type: 'skincare',   engagement: 'like-only', status: 'verify'    },
  { handle: 'DrunkElephant',   type: 'skincare',   engagement: 'like-only', status: 'verify'    },
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
    if (gaps.some(g => g < MIN_GAP))        continue; // too close
    if (!gaps.some(g => g <= CLUSTER_MAX))  continue; // needs a cluster pair
    if (!gaps.some(g => g >= LONG_GAP_MIN)) continue; // needs a long break
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

// ── Load log ─────────────────────────────────────────────────────────────────
let log = { sessions: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (_) {}
}

// Accounts engaged with in last 7 days
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recentAccounts = new Set(
  (log.sessions || [])
    .filter(s => new Date(s.timestamp).getTime() > sevenDaysAgo)
    .map(s => s.account?.toLowerCase())
);

// ── Generate schedule ─────────────────────────────────────────────────────────
const SESSION_COUNT = rand(4, 5); // random 4 or 5 per day
const today   = targetDate();
const times   = generateTimes(SESSION_COUNT);
const gaps    = times.slice(1).map((t, i) => t - times[i]);

// Filter out recently engaged, prefer confirmed accounts, shuffle for variety
const available = shuffle(ACCOUNTS.filter(a => !recentAccounts.has(a.handle.toLowerCase())));
// Bias toward confirmed accounts — put them first but keep some verify ones
const confirmed = available.filter(a => a.status === 'confirmed');
const toVerify  = available.filter(a => a.status === 'verify');
// Mix: 60% confirmed, 40% verify (but always fill slots)
const pool = [...confirmed, ...toVerify];

const sessions = times.map((t, i) => {
  const account = pool[i % pool.length];
  return {
    n:          i + 1,
    time:       minsToHHMM(t),
    account:    account.handle,
    type:       account.type,
    engagement: account.engagement,
    status:     account.status,
    done:       false
  };
});

console.log(`\n📅 X schedule for ${today} (${SESSION_COUNT} sessions)`);
sessions.forEach(s => {
  const flag = s.status === 'verify' ? ' [verify first]' : '';
  console.log(`  ${s.n}. ${s.time}  @${s.account}  (${s.engagement})${flag}`);
});
console.log(`  Gaps (min): ${gaps.join(', ')}`);
console.log(`  Cluster ≤90min: ${gaps.some(g => g <= 90)}`);
console.log(`  Long gap ≥3hrs: ${gaps.some(g => g >= 180)}`);
console.log(`  Recent accounts (skip): ${[...recentAccounts].join(', ') || 'none'}`);

fs.writeFileSync(SCHED_FILE, JSON.stringify({ date: today, sessionCount: SESSION_COUNT, sessions }, null, 2));
console.log(`\n✓ Written: today-schedule.json`);

// ── Create session crons ──────────────────────────────────────────────────────
sessions.forEach(s => {
  const isLikeOnly = s.engagement === 'like-only';
  const isVerify   = s.status === 'verify';

  const verifyNote = isVerify
    ? `NOTE: @${s.account} is unverified — first confirm the account exists and is active before engaging. If inactive or not found, pick the next account on the list in outreach/x/accounts.md instead.`
    : '';

  const engagementInstructions = isLikeOnly
    ? [
        `ENGAGEMENT: LIKE ONLY by default.`,
        `Only reply if the caption/post has specific technique or product detail worth responding to.`,
        `If replying: Style 1 or 3 only (observation or opinion), no question, no hype compliment.`,
      ].join('\n')
    : [
        `ENGAGEMENT: Full — reply + like.`,
        `Reply to ONE recent post (same-day if possible). Like that post + 1-2 older posts from the same account.`,
      ].join('\n');

  const msg = [
    `X SESSION ${s.n}/${SESSION_COUNT} for ${today} — run as @stacydonna0x.`,
    ``,
    `Target account: @${s.account} (${s.type})`,
    verifyNote,
    ``,
    engagementInstructions,
    ``,
    `Steps:`,
    `1. Read /Users/mantisclaw/.openclaw/workspace/outreach/x/tone-guide.md`,
    `   Read /Users/mantisclaw/.openclaw/workspace/outreach/x/posting-rules.md`,
    ``,
    `2. Navigate to https://x.com/${s.account} — check the profile loads and is active.`,
    ``,
    `3. Find a recent post (same-day preferred). Use JS to extract tweet URLs:`,
    `   document.querySelectorAll('article a[href*="/status/"]').map(a => a.href)`,
    ``,
    `4. Navigate to the tweet URL. BEFORE typing anything:`,
    `   Snapshot → read article text in Conversation region.`,
    `   Confirm tweet content matches what you plan to respond to.`,
    `   If wrong tweet, try next URL. NEVER post without verifying content.`,
    ``,
    `5. Draft a fresh, specific reply based on the actual post content.`,
    `   Follow tone-guide.md styles. No hyphens, no quotation marks.`,
    `   Banned: weird, resonate, amazing, stunning, love your content.`,
    `   Never start with "the". Never use "actually".`,
    ``,
    `6. Click reply textbox (ref) → type comment → click Reply button (ref).`,
    `   DO NOT use Ctrl+Enter.`,
    ``,
    `7. Like the post (JS: document.querySelectorAll('[data-testid="like"]')[0]?.click()).`,
    `   If full engagement: also like 1-2 older posts from the same account.`,
    ``,
    `8. Append to /Users/mantisclaw/.openclaw/workspace/outreach/x/engagement-log.json:`,
    `   { timestamp, account, tweetUrl, reply (or null if like-only), liked: true, type, platform: "x" }`,
    ``,
    `9. Send a brief Telegram message using the message tool (channel="telegram", target="6241290513"): account name + what was done (reply text or "liked only"). ALWAYS include target="6241290513" — do NOT omit it.`,
  ].filter(Boolean).join('\n');

  const name = `x-s${s.n}-${today.replace(/-/g,'')}-${s.time.replace(':','')}`;
  const at   = `${today}T${s.time}:00${getLAOffset()}`;

  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', name,
    '--at',   at,
    '--message', msg,
    '--announce',
    '--delete-after-run',
    '--tz', 'America/Los_Angeles'
  ], { encoding: 'utf8' });

  if (result.status === 0) {
    console.log(`✓ Cron: ${name} at ${s.time} → @${s.account}`);
  } else {
    console.error(`✗ Failed: ${name}\n${result.stderr}`);
  }
});

console.log('\n✅ X daily planner done.\n');
