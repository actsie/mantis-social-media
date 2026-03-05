#!/usr/bin/env node
/**
 * x-follow-session.js
 * Standalone X/Twitter follow builder — browse a competitor's followers list,
 * pick 8-12 real/on-topic accounts active within the last 4 days, and follow them.
 * Run manually: node x-follow-session.js
 * Or via cron:  openclaw cron run <id>
 *
 * Rotates through SOURCE_ACCOUNTS so we hit a different one each run.
 * Logs all follows to follow-tracker.json.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const TRACKER   = path.join(WORKSPACE, 'outreach/x/follow-tracker.json');
const STATE     = path.join(WORKSPACE, 'outreach/x/follow-session-state.json');

// Competitor / peer accounts to pull followers from (rotate round-robin)
const SOURCE_ACCOUNTS = [
  'holotaco',       // nail creator, very on-topic audience
  'OPI_PRODUCTS',   // nail brand
  'essie',          // nail brand
  'elfcosmetics',   // beauty brand
  'nailboo',        // nail brand
  'glamnetic',      // nail brand
];

const FOLLOW_TARGET = 10; // aim for 8-12 per session
const TELEGRAM_ID   = '6241290513';

// ── Load state ────────────────────────────────────────────────────────────────

function loadState() {
  if (fs.existsSync(STATE)) return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  return { lastSourceIndex: -1 };
}

function saveState(s) {
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
}

function loadTracker() {
  if (fs.existsSync(TRACKER)) return JSON.parse(fs.readFileSync(TRACKER, 'utf8'));
  return { follows: [] };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const state = loadState();
const tracker = loadTracker();

// Pick next source account (round-robin)
const nextIndex = (state.lastSourceIndex + 1) % SOURCE_ACCOUNTS.length;
const sourceAccount = SOURCE_ACCOUNTS[nextIndex];

// Already-followed handles to avoid re-following
const alreadyFollowed = new Set(tracker.follows.map(f => f.handle));

state.lastSourceIndex = nextIndex;
saveState(state);

const today = new Date().toISOString().slice(0, 10);

// ── Session message ───────────────────────────────────────────────────────────

const sessionMsg = `
You are running a standalone X (Twitter) follow session for @stacydonna0x.

## Goal
Browse @${sourceAccount}'s followers list on X, identify 8-12 real, on-topic accounts that posted within the last 4 days, and follow them. Log every follow.

## Already-followed accounts (do NOT re-follow)
${alreadyFollowed.size > 0 ? [...alreadyFollowed].map(h => `- @${h}`).join('\n') : '- (none yet)'}

## Step 1 — Open profile and followers list
1. Open browser with profile="openclaw"
2. Navigate to: https://x.com/${sourceAccount}/followers
3. Take a snapshot. You should see a list of followers.
4. Scroll down to load more followers if needed.

## Step 2 — Browse and quick-filter followers
For each visible account in the list, do a quick scan:

**Initial SKIP criteria (check before clicking in):**
- No profile photo or placeholder avatar
- Bio/username has zero relevance to: nail, nails, beauty, salon, spa, lash, brow, makeup, hair, esthetician, glam, cosmo, aesthetic
- Already in the already-followed list above
- Follow button already shows "Following"
- Clearly a bot (random username + numbers, no bio)

## Step 3 — Visit profile + activity check (mandatory hard rule)
For every account that passes Step 2, click into their profile and check their timeline:

**FOLLOW if ALL of these are true:**
- Most recent post is **within the last 4 days** — check the timestamp on their most recent tweet. If it says "5d" or older, SKIP. This is a hard rule — do not bend it.
- Posts show nail/beauty/relevant content (at least a few posts visible in their timeline)
- Account looks real (not 0 tweets, not a bot ratio like 10K following / 2 followers)
- Not a massive brand with 500K+ followers (skip those — they won't follow back)
- Not already followed by @stacydonna0x (button shows "Following")

**SKIP if any of these:**
- Most recent post is older than 4 days — **hard stop, no exceptions**
- Protected/private account (lock icon)
- Clearly unrelated niche (politics, sports, finance, food only, etc.)
- Looks like a bot or spam account

## Step 4 — Follow qualifying accounts
For each account you decide to follow:
1. Click the Follow button on their profile
2. Go back to the followers list and continue
3. Repeat until you have followed ${FOLLOW_TARGET} accounts (aim for 8-12)

**Take it slow — at least 20-30 seconds between each follow action. Do not batch too fast.**

## Step 5 — Build the follow log
For every account you followed, record:
- handle (username, no @)
- display_name (their display name if visible)
- source: "${sourceAccount}_followers"
- date: "${today}"
- last_post_recency: how recent their last post was (e.g. "2d", "today")
- notes: brief reason they qualified (e.g. "nail artist, posted 2d ago", "beauty salon account, posted today")

## Step 6 — Update follow-tracker.json
Read the current file:
\`\`\`
/Users/mantisclaw/.openclaw/workspace/outreach/x/follow-tracker.json
\`\`\`
Append your new follows to the "follows" array. Each entry:
\`\`\`json
{
  "handle": "username",
  "display_name": "Their Name",
  "source": "${sourceAccount}_followers",
  "date": "${today}",
  "platform": "x",
  "followed_back": false,
  "last_post_recency": "2d",
  "notes": "nail artist, active account"
}
\`\`\`
Write the updated file back.

## Step 7 — Send Telegram report
Send a message to Telegram (channel=telegram, target=${TELEGRAM_ID}):

Format:
\`\`\`
➕ X Follow Session — @${sourceAccount} followers
Date: ${today}

Followed X accounts:
- @handle1 (last post: Xd ago) — [why]
- @handle2 (last post: today) — [why]
...

Skipped: Y accounts (inactive/bots/unrelated)
Source: @${sourceAccount} followers list
\`\`\`

If you couldn't access the followers list (private account, blocked, etc.), report that and stop.
If you followed fewer than 5 because qualifying accounts were scarce, report that too — don't force follows on bad accounts.

## Important rules
- Use profile="openclaw" for all browser actions
- Do NOT follow accounts already in the already-followed list
- Do NOT follow more than 12 in a single session
- **The 4-day activity rule is non-negotiable** — inactive accounts waste a follow slot
- Do NOT rush — space out follows naturally
- Only follow accounts you genuinely believe are real beauty/nail people
`.trim();

// ── Create cron ───────────────────────────────────────────────────────────────

const cronId = `x-follow-${today.replace(/-/g,'')}-${sourceAccount}`;

const tmpMsg = `/tmp/x-follow-msg-${Date.now()}.txt`;
fs.writeFileSync(tmpMsg, sessionMsg);

console.log(`\n🎯 X Follow Session`);
console.log(`   Source account: @${sourceAccount}`);
console.log(`   Follow target:  ${FOLLOW_TARGET}`);
console.log(`   Already followed: ${alreadyFollowed.size} accounts\n`);
console.log(`Running session now...\n`);

try {
  const result = execSync(
    `openclaw cron create --id "${cronId}" --name "X Follow Builder @${sourceAccount}" --once --message-file "${tmpMsg}" --channel telegram --target ${TELEGRAM_ID} --best-effort`,
    { encoding: 'utf8', stdio: 'pipe' }
  );
  console.log(result);
} catch(e) {
  console.log('Could not auto-create cron. Session message:\n');
  console.log(sessionMsg);
} finally {
  try { fs.unlinkSync(tmpMsg); } catch(_) {}
}
