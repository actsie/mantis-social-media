#!/usr/bin/env node
/**
 * ig-follow-session.js
 * Standalone IG follow builder — browse a competitor's followers list,
 * pick 10-15 real/on-topic accounts, follow them.
 * Run manually: node ig-follow-session.js
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
const TRACKER   = path.join(WORKSPACE, 'outreach/instagram/follow-tracker.json');
const STATE     = path.join(WORKSPACE, 'outreach/instagram/follow-session-state.json');

// Competitor / peer accounts to pull followers from
// Rotated round-robin — state.json tracks lastSourceIndex
const SOURCE_ACCOUNTS = [
  'nailboo',        // huge nail brand, highly engaged follower base
  'holotaco',       // creator account, very on-topic audience
  'glamnetic',      // nail art brand
  'gelish',         // nail brand
  'nailchemy',      // nail art
  'olive_and_june', // nail brand, consumer-facing
  'nailsofla',      // salon/creator
  'thenailhall',    // salon
];

const FOLLOW_TARGET = 12; // aim for 10-15 per session
const DISCORD_SESSIONS_CHANNEL = '1485556397293703279';

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
You are running a standalone Instagram follow session for @stacyd0nna.

## Goal
Browse @${sourceAccount}'s followers list on Instagram, identify 10-15 real, on-topic accounts, and follow them. Log every follow.

## Already-followed accounts (do NOT re-follow)
${alreadyFollowed.size > 0 ? [...alreadyFollowed].map(h => `- @${h}`).join('\n') : '- (none yet)'}

## Step 1 — Open profile and followers list
1. Open browser with profile="openclaw"
2. Navigate to: https://www.instagram.com/${sourceAccount}/
3. Take a snapshot. Find the "Followers" count link and click it.
4. A modal should open showing the followers list.
5. Snapshot again to confirm modal is open.

## Step 2 — Browse and qualify followers
Scroll through the followers modal. For each visible account, do a quick scan:

**Initial SKIP criteria (check before clicking in):**
- Private account (lock icon)
- No profile photo (default grey silhouette)
- Bio/username has zero relevance to: nail, nails, beauty, salon, spa, lash, brow, makeup, hair, esthetician, glam, cosmo, aesthetic
- Already in the already-followed list above
- Follow button already shows "Following"

## Step 3 — Visit profile + activity check (mandatory)
For every account that passes Step 2, click into their profile and check:

**FOLLOW if ALL of these are true:**
- Most recent post is **within the last 7 days** (look at the timestamp on their most recent post — if it says "1w" or more, SKIP)
- Posts show nail/beauty content (at least a few posts in their grid)
- Account looks real (not 0 posts, not a bot ratio like 5K following / 3 followers)
- Not a massive brand with 100K+ followers (skip those)

**SKIP if any of these:**
- Most recent post is older than 7 days — **this is a hard rule, do not bend it**
- Clearly unrelated niche (sports, finance, food only, etc.)
- Looks like a bot (random username, no real content)

After checking, either click Follow or go back to the modal and move on.

**Take it slow — at least 15-20 seconds between each follow action. Do not batch too fast.**

## Step 4 — Build the follow log
For every account you followed, record:
- handle (username, no @)
- display_name (their display name if visible)
- source: "${sourceAccount}_followers"
- date: "${today}"
- notes: brief reason they qualified (e.g., "nail artist bio", "beauty salon account")

## Step 5 — Update follow-tracker.json
Read the current file:
\`\`\`
/Users/mantisclaw/.openclaw/workspace/outreach/instagram/follow-tracker.json
\`\`\`
Append your new follows to the "follows" array. Each entry:
\`\`\`json
{
  "handle": "username",
  "display_name": "Their Name",
  "source": "${sourceAccount}_followers",
  "date": "${today}",
  "platform": "instagram",
  "followed_back": false,
  "notes": "nail artist, public account"
}
\`\`\`
Write the updated file back.

## Step 6 — Send Discord report
Send a message to Discord (channel=discord, target=${DISCORD_SESSIONS_CHANNEL}):

Format:
\`\`\`
➕ IG Follow Session — @${sourceAccount} followers
Date: ${today}

Followed X accounts:
- @handle1 — [why]
- @handle2 — [why]
...

Skipped: Y accounts (bots/private/unrelated)
Source: @${sourceAccount} followers list
\`\`\`

If you couldn't access the followers list (private account, blocked, etc.), report that and stop.
If you followed fewer than 5 because qualifying accounts were scarce, report that too — don't force follows on bad accounts.

## Important rules
- Use profile="openclaw" for all browser actions
- Do NOT follow accounts already in the already-followed list
- Do NOT follow more than 15 in a single session
- Do NOT rush — space out follows naturally
- Only follow accounts you genuinely believe are real beauty/nail people
`.trim();

// ── Create cron ───────────────────────────────────────────────────────────────

const cronId = `ig-follow-${today.replace(/-/g,'')}-${sourceAccount}`;

const cronPayload = {
  id:       cronId,
  name:     `IG Follow Builder — @${sourceAccount} followers`,
  schedule: `once:${new Date(Date.now() + 30000).toISOString()}`, // 30s from now
  session: {
    message: sessionMsg,
  },
  delivery: {
    channel: 'telegram',
    target: TELEGRAM_ID,
    bestEffort: true,
  },
};

console.log(`\n🎯 IG Follow Session`);
console.log(`   Source account: @${sourceAccount}`);
console.log(`   Follow target:  ${FOLLOW_TARGET}`);
console.log(`   Already followed: ${alreadyFollowed.size} accounts\n`);
console.log(`Running session now...\n`);

// Write session message to a temp file and use openclaw session create
const tmpMsg = `/tmp/ig-follow-msg-${Date.now()}.txt`;
fs.writeFileSync(tmpMsg, sessionMsg);

try {
  // Use openclaw sessions to fire this immediately
  const result = execSync(
    `openclaw cron create --id "${cronId}" --name "IG Follow Builder @${sourceAccount}" --once --message-file "${tmpMsg}" --channel telegram --target ${TELEGRAM_ID} --best-effort`,
    { encoding: 'utf8', stdio: 'pipe' }
  );
  console.log(result);
} catch(e) {
  // Fallback: print the message so user can run manually
  console.log('Could not auto-create cron. Session message:\n');
  console.log(sessionMsg);
} finally {
  try { fs.unlinkSync(tmpMsg); } catch(_) {}
}
