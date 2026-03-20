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

function inPostingWindow(d) {
  if (!isWeekday(d)) return false;
  const h = d.getHours(), m = d.getMinutes();
  // 9:00–10:00 EST or 13:00–14:00 EST
  return (h === 9) || (h === 13);
}

function nextWindow() {
  const now = nowEST();
  const h = now.getHours();
  // If before 9am today (weekday) → next window is 9am today
  // If between 10am and 1pm today → next window is 1pm today
  // If after 2pm today (weekday) → next window is 9am next weekday
  // Weekends → next weekday 9am
  const trySlots = [];
  const base = new Date(now);
  base.setMinutes(0, 0, 0);

  // Today 9am
  const today9 = new Date(base); today9.setHours(9);
  // Today 1pm
  const today13 = new Date(base); today13.setHours(13);

  if (now < today9 && isWeekday(now)) trySlots.push(today9);
  if (now < today13 && isWeekday(now)) trySlots.push(today13);

  if (trySlots.length) return trySlots[0].toISOString();

  // Find next weekday
  let next = new Date(base);
  next.setDate(next.getDate() + 1);
  while (!isWeekday(next)) next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}

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
    '--run-now',
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

    // Check posting window
    if (!inPostingWindow(now)) {
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
