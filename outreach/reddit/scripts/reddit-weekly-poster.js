#!/usr/bin/env node
/**
 * reddit-weekly-poster.js
 * Creates a one-off session cron to draft and post an original Reddit post.
 * Run twice a week (Tuesday 10:00am + Friday 2:00pm PST) via master crons.
 * Each run picks a sub, finds a fresh angle, drafts title+body, humanizes, posts.
 * 
 * Updated Mar 14: Single-session flow with humanizer skill invocation
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const POST_GUIDE       = 'outreach/reddit/post-guide.md';
const POSTED_TOPICS    = 'outreach/reddit/posted-topics.json';
const ENGAGEMENT_LOG   = 'outreach/reddit/engagement-log.json';
const TODAY_SCHED      = 'outreach/reddit/today-schedule.json';

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

// Fire 30min to 5hrs from now — randomized so post time varies each week
function fireTimeSoon() {
  const now = new Date();
  const delayMs = (Math.floor(Math.random() * 270) + 30) * 60 * 1000; // 30-300 min
  const fireAt = new Date(now.getTime() + delayMs);
  const pst = new Date(fireAt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const pad = n => n.toString().padStart(2, '0');
  const hhmm = `${pad(pst.getHours())}:${pad(pst.getMinutes())}`;
  const date = todayPST();
  return `${date}T${hhmm}:00${getLAOffset()}`;
}

const today = todayPST();
const fireAt = fireTimeSoon();

// Parse fire time for display
const fireDisplay = fireAt.split('T')[1].substring(0, 5);

const msg = `REDDIT POST SESSION — ${today} — post as u/Alive_Kick7098.

This is an ORIGINAL POST session, not a comment session. Goal: publish one genuine discussion question with a personal body that invites community responses.

═══════════════════════════════════════════════════════════
STEP 1 — Read These Files:
═══════════════════════════════════════════════════════════
  ${POST_GUIDE}
  ${POSTED_TOPICS}
  ${ENGAGEMENT_LOG}

═══════════════════════════════════════════════════════════
STEP 2 — Pick a Subreddit:
═══════════════════════════════════════════════════════════
  Eligible subs (phase 2): r/Nails, r/beauty, r/femalehairadvice, r/SkincareAddicts, r/30PlusSkinCare, r/curlyhair, r/longhair, r/Nailtechs, r/hairstylist, r/EstheticianLife, r/smallbusiness
  
  Rules:
  - Do NOT pick a sub posted to in the last 7 days (check posted-topics.json)
  - Do NOT pick a sub where we already commented today (check engagement-log.json for today's date)
  - Prefer subs not posted to recently

═══════════════════════════════════════════════════════════
STEP 3 — Find a Fresh Angle:
═══════════════════════════════════════════════════════════
  Web search for recent articles, studies, or discussions related to the chosen sub's topic (nails, skincare, hair, beauty).
  Goal: find something that sparked genuine curiosity or a real question — something people in that sub would have opinions about.
  Do NOT link the article in the post. Use it only as inspiration for the question.

═══════════════════════════════════════════════════════════
STEP 4 — Draft the Post (Following post-guide.md):
═══════════════════════════════════════════════════════════
  Title rules:
  - One specific question
  - Capitalized like a normal sentence (not all caps, not all lowercase)
  - Casual, not academic
  - Max ~12 words
  - No question mark required but ok sometimes

  Body rules:
  - 2-5 sentences of personal context
  - Start with a verb or situation — NOT with "I"
  - Lowercase for most sentences, capitalize naturally mid-sentence for proper nouns only
  - Not every sentence needs a period — trailing off is fine
  - Give a specific personal situation that explains why you're asking
  - When you acknowledge "conventional wisdom", explain in personal terms why it doesn't feel satisfying — vague enough that people respond with experience not facts
  - End with an open process question that invites people to share their own experience
  - Rambly is good. One thought leading to the next.

  Save draft to: outreach/reddit/drafts/weekly-post-${today.replace(/-/g,'')}-draft.txt

═══════════════════════════════════════════════════════════
STEP 5 — HUMANIZE (INVOKE SKILL):
═══════════════════════════════════════════════════════════
  - Run: /humanizer [paste draft content]
  - Wait for humanizer skill output
  - Save humanized output to: outreach/reddit/drafts/weekly-post-${today.replace(/-/g,'')}-humanized.txt
  - ⚠️ DO NOT proceed to Step 6 until humanized file exists

═══════════════════════════════════════════════════════════
STEP 6 — Post via old.reddit.com:
═══════════════════════════════════════════════════════════
  1. Navigate to https://old.reddit.com/r/SUBREDDIT/submit
     IMPORTANT: Always use old.reddit.com — NOT www.reddit.com
  2. Read humanized title and body from weekly-post-${today.replace(/-/g,'')}-humanized.txt
  3. Fill in the title field: click it, use execCommand to inject title text
     JS: const t = document.querySelector('#title'); t.focus(); document.execCommand('insertText', false, 'TITLE HERE');
  4. Fill in the text body field:
     JS: const ta = document.querySelector('#text'); ta.focus(); document.execCommand('insertText', false, 'BODY HERE');
  5. Click the Submit button: document.querySelector('#newlink [type=submit]')?.click()
  6. Wait for redirect, confirm post URL in address bar

═══════════════════════════════════════════════════════════
STEP 7 — Upvote Your Own Post:
═══════════════════════════════════════════════════════════
  JS: document.querySelector('.arrow.up')?.click()

═══════════════════════════════════════════════════════════
STEP 8 — Append to posted-topics.json:
═══════════════════════════════════════════════════════════
  const fs = require('fs');
  const topicsPath = '${POSTED_TOPICS}';
  const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
  topics.posts.push({ timestamp: new Date().toISOString(), subreddit: 'SUBREDDIT', title: 'TITLE', body: 'BODY', postUrl: 'URL', articleInspiration: 'ARTICLE URL OR TITLE', humanized: true });
  fs.writeFileSync(topicsPath, JSON.stringify(topics, null, 2));

═══════════════════════════════════════════════════════════
STEP 9 — Append to engagement-log.json:
═══════════════════════════════════════════════════════════
  const logPath = '${ENGAGEMENT_LOG}';
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  log.sessions.push({ timestamp: new Date().toISOString(), subreddit: 'SUBREDDIT', postUrl: 'URL', postTitle: 'TITLE', comment: null, type: 'post', platform: 'reddit', account: 'Alive_Kick7098', humanized: true });
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

═══════════════════════════════════════════════════════════
STEP 10 — Send Telegram Recap:
═══════════════════════════════════════════════════════════
  Use message tool (channel="telegram", target="6241290513"):
  Include: subreddit, post title, first sentence of body.
  ALWAYS include target="6241290513" — do NOT omit it.

═══════════════════════════════════════════════════════════
STEP 11 — Cleanup:
═══════════════════════════════════════════════════════════
  - Delete draft files: weekly-post-${today.replace(/-/g,'')}-draft.txt, weekly-post-${today.replace(/-/g,'')}-humanized.txt

═══════════════════════════════════════════════════════════
SKIP CONDITION:
═══════════════════════════════════════════════════════════
  If you cannot find a suitable topic that hasn't been done recently, or if the chosen sub already has a very similar recent post (check r/SUBREDDIT/new before posting), skip and notify via Telegram with reason.`;

const name = `reddit-post-${today.replace(/-/g, '')}`;

// Send morning notification
const notify = spawnSync('openclaw', [
  'message', 'send',
  '--channel', 'telegram',
  '--to', '6241290513',
  '--message', `📝 Reddit post session scheduled for today (~${fireDisplay} PST). Will pick a sub + topic and post. Check tonight's summary for the URL.`
], { encoding: 'utf8' });
if (notify.status !== 0) console.warn('Warning: Telegram notify failed\n' + notify.stderr);

const result = spawnSync('openclaw', [
  'cron', 'add',
  '--name', name,
  '--at', fireAt,
  '--message', msg,
  '--delete-after-run',
  '--tz', 'America/Los_Angeles'
], { encoding: 'utf8' });

if (result.status === 0) {
  console.log(`✓ Reddit post session scheduled: ${name} at ${fireAt}`);
} else {
  console.error(`✗ Failed to schedule: ${name}\n${result.stderr}`);
  process.exit(1);
}

console.log('\n✅ Reddit weekly poster done.\n');
