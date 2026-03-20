#!/usr/bin/env node
/**
 * agentcard-post-approved — runs every 30 min
 * Reads drafts.json, posts all approved items with timing rules.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/agentcard-social/openclaw-workspace';
const DRAFTS = path.join(WORKSPACE, 'drafts.json');
const TODAY = (() => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return d.toISOString().slice(0, 10).replace(/-/g, '-');
})();
const MEMORY = path.join(WORKSPACE, `memory/${TODAY}.md`);

// ─── helpers ────────────────────────────────────────────────────────────────

function nowEST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function isWeekday(d) {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

// EDT = UTC-4. 9am EDT = 13:00 UTC, 1pm EDT = 17:00 UTC
function edtHour() {
  // Returns current hour in EDT (UTC-4), regardless of server timezone
  return new Date().getUTCHours() - 4 < 0
    ? new Date().getUTCHours() - 4 + 24
    : new Date().getUTCHours() - 4;
}

function inPostingWindow(d) {
  if (!isWeekday(d)) return false;
  const h = edtHour();
  // 9:00–10:00 EDT or 13:00–14:00 EDT
  return (h === 9) || (h === 13);
}

function nextWindowUTC() {
  // Returns UTC ISO string for next EDT posting window (9am or 1pm EDT)
  const nowUTC = new Date();
  const h = edtHour();
  const isWkd = isWeekday(nowEST());

  // Today's 9am EDT = 13:00 UTC, 1pm EDT = 17:00 UTC
  const todayDate = nowUTC.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  const today9utc  = new Date(`${todayDate}T13:00:00.000Z`);
  const today13utc = new Date(`${todayDate}T17:00:00.000Z`);

  if (isWkd && nowUTC < today9utc)  return today9utc.toISOString();
  if (isWkd && nowUTC < today13utc) return today13utc.toISOString();

  // Find next weekday
  let next = new Date(nowUTC);
  next.setUTCDate(next.getUTCDate() + 1);
  while (!isWeekday(new Date(next.toLocaleString('en-US', { timeZone: 'America/New_York' })))) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  const nextDate = next.toISOString().slice(0, 10);
  return `${nextDate}T13:00:00.000Z`; // 9am EDT next weekday
}

function nextWindow() { return nextWindowUTC(); }

function recentPostCount(drafts) {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  return drafts.filter(d =>
    d.status === 'posted' &&
    d.posted_at &&
    new Date(d.posted_at).getTime() > cutoff
  ).length;
}

function readDrafts() {
  try { return JSON.parse(fs.readFileSync(DRAFTS, 'utf8')); }
  catch (e) { return []; }
}

function saveDrafts(drafts) {
  fs.writeFileSync(DRAFTS, JSON.stringify(drafts, null, 2));
}

function appendMemory(text) {
  try {
    fs.mkdirSync(path.dirname(MEMORY), { recursive: true });
    let content = '';
    if (fs.existsSync(MEMORY)) content = fs.readFileSync(MEMORY, 'utf8');
    if (!content.includes('## Posted')) content += '\n\n## Posted\n';
    content += text;
    fs.writeFileSync(MEMORY, content);
  } catch (e) { /* non-fatal */ }
}

function gitCommitPush(msg) {
  spawnSync('git', ['-C', '/Users/mantisclaw/agentcard-social', 'add', 'openclaw-workspace/drafts.json', `openclaw-workspace/memory/${TODAY}.md`], { encoding: 'utf8' });
  spawnSync('git', ['-C', '/Users/mantisclaw/agentcard-social', 'commit', '-m', msg], { encoding: 'utf8' });
  spawnSync('git', ['-C', '/Users/mantisclaw/agentcard-social', 'push', 'origin', 'main'], { encoding: 'utf8' });
}

function notifyDraft(draftId) {
  spawnSync('node', [
    '/Users/mantisclaw/agentcard-social/openclaw-workspace/scripts/notify-draft.js',
    draftId,
  ], {
    encoding: 'utf8',
    env: { ...process.env,
      DISCORD_WEBHOOK_AGENTCARD: process.env.DISCORD_WEBHOOK_AGENTCARD || '',
      SLACK_WEBHOOK_AGENTCARD: '',
    },
  });
}

function postToX(draft) {
  /**
   * Compose a session prompt for posting. The session agent (--session main)
   * will handle the browser automation.
   */
  const type = draft.type || 'original';
  let prompt;

  if (type === 'reply') {
    prompt = [
      `AGENT CARD POST — reply`,
      ``,
      `Post the following reply on X (@agentcardai or @stacydonna0x):`,
      ``,
      `Source post URL: ${draft.source_post_url}`,
      `Reply text:`,
      draft.text,
      ``,
      `Steps:`,
      `1. Navigate to source_post_url`,
      `2. Click reply button`,
      `3. Type exactly the reply text above`,
      `4. Click Post/Reply`,
      `5. Confirm post is visible`,
      `6. Report back: "✅ Posted" or "❌ Failed: [reason]"`,
    ].join('\n');
  } else if (type === 'thread') {
    const tweets = draft.thread || [draft.text];
    prompt = [
      `AGENT CARD POST — thread`,
      ``,
      `Post the following thread on X:`,
      ``,
      tweets.map((t, i) => `Tweet ${i + 1}: ${t}`).join('\n\n'),
      ``,
      `Steps:`,
      `1. Navigate to x.com/compose/post`,
      `2. Type tweet 1`,
      `3. Click + to add tweet, type tweet 2, repeat`,
      `4. Click Post All`,
      `5. Report back: "✅ Posted" or "❌ Failed: [reason]"`,
    ].join('\n');
  } else {
    // original standalone post
    prompt = [
      `AGENT CARD POST — original tweet`,
      ``,
      `Post the following tweet on X:`,
      ``,
      draft.text,
      ``,
      `Steps:`,
      `1. Navigate to x.com/compose/post`,
      `2. Type the tweet text exactly as above`,
      `3. Click Post`,
      `4. Confirm tweet is visible on the timeline`,
      `5. Report back: "✅ Posted [tweet URL]" or "❌ Failed: [reason]"`,
    ].join('\n');
  }

  // Fire a cron that runs immediately in the main session
  const runId = `agentcard-post-${Date.now()}`;
  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', runId,
    '--system-event', prompt,
    '--delete-after-run',
    '--session', 'main',
    '--at', '+1m',
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(result.stderr || 'cron add failed');
  }

  return runId;
}

// ─── main ────────────────────────────────────────────────────────────────────

console.log(`\n[agentcard-post-approved] ${new Date().toISOString()}\n`);

// Step 1: Pull latest
console.log('Pulling latest from origin...');
const pull = spawnSync('git', ['-C', '/Users/mantisclaw/agentcard-social', 'pull', '--rebase', 'origin', 'main'], { encoding: 'utf8' });
if (pull.status !== 0) console.warn('  Pull failed (continuing):', pull.stderr?.trim());
else console.log('  OK');

// Step 2: Read drafts
const drafts = readDrafts();
const approved = drafts.filter(d => d.status === 'approved');
console.log(`\nApproved drafts: ${approved.length}`);

if (approved.length === 0) {
  console.log('Nothing to post. Exiting.');
  process.exit(0);
}

const now = nowEST();
let postedThisRun = 0;

for (const draft of approved) {
  const urgency = draft.urgency || 'standard';
  console.log(`\n--- ${draft.id} (${draft.type}, urgency: ${urgency}) ---`);

  // Timing check for standard posts
  if (urgency !== 'breaking') {
    // Check 2-per-2h cap
    const recentCount = recentPostCount(drafts);
    if (recentCount >= 2) {
      console.log(`  Skipping: already posted ${recentCount} in last 2h`);
      continue;
    }

    // Check posting window (UTC-aware)
    if (!inPostingWindow(new Date())) {
      const sched = nextWindow();
      draft.scheduled_for = sched;
      console.log(`  Outside window. Scheduled for: ${sched}`);
      saveDrafts(drafts);
      continue;
    }
  }

  // Post
  console.log(`  Posting...`);
  try {
    const runId = postToX(draft);
    draft.status = 'posted';
    draft.posted_at = new Date().toISOString();
    draft.cron_run_id = runId;
    saveDrafts(drafts);

    appendMemory(`\n- [${new Date().toISOString()}] Posted: ${draft.id} (${draft.type}) — ${(draft.text || '').substring(0, 80)}...\n`);
    gitCommitPush(`Post ${draft.id}`);

    postedThisRun++;
    console.log(`  ✅ Posted (cron: ${runId})`);

    // Rate limit: max 2 per run
    if (postedThisRun >= 2) {
      console.log('\nReached 2-post cap for this run. Stopping.');
      break;
    }

  } catch (err) {
    draft.status = 'post_failed';
    draft.error = err.message;
    saveDrafts(drafts);
    console.error(`  ❌ Failed: ${err.message}`);
  }
}

console.log(`\n[done] Posted: ${postedThisRun}`);
