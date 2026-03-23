#!/usr/bin/env node
/**
 * draft-action.js
 * Usage:
 *   node draft-action.js approve [draft-id?]
 *   node draft-action.js edit "new text" [draft-id?]
 *   node draft-action.js reject "reason" [draft-id?]
 *
 * If draft-id is omitted, targets the most recent pending draft.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE      = '/Users/mantisclaw/agentcard-social';
const WORKSPACE = path.join(BASE, 'openclaw-workspace');
const DRAFTS    = path.join(WORKSPACE, 'drafts.json');
const DECISIONS = path.join(WORKSPACE, 'decisions.json');
const FEEDBACK  = path.join(WORKSPACE, 'feedback-patterns.md');

function today() { return new Date().toISOString().slice(0, 10); }
const MEMORY = path.join(WORKSPACE, `memory/${today()}.md`);

// ─── helpers ────────────────────────────────────────────────────────────────

function readJSON(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}
function writeJSON(p, d) {
  fs.writeFileSync(p, JSON.stringify(d, null, 2));
}

function gitPull() {
  spawnSync('git', ['-C', BASE, 'pull', '--rebase', 'origin', 'main'], { encoding: 'utf8' });
}

function gitPush(msg) {
  spawnSync('git', ['-C', BASE, 'add', '-A'], { encoding: 'utf8' });
  const r = spawnSync('git', ['-C', BASE, 'commit', '-m', msg], { encoding: 'utf8' });
  if (r.status !== 0 && r.stdout.includes('nothing to commit')) return;
  spawnSync('git', ['-C', BASE, 'pull', '--rebase', 'origin', 'main'], { encoding: 'utf8' });
  spawnSync('git', ['-C', BASE, 'push', 'origin', 'main'], { encoding: 'utf8' });
}

function nextWindow() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = now.getHours();
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  if (isWeekday && h < 9) return 'today 9:00am EST';
  if (isWeekday && h >= 9 && h < 10) return 'now (in 9am window)';
  if (isWeekday && h >= 10 && h < 13) return 'today 1:00pm EST';
  if (isWeekday && h >= 13 && h < 14) return 'now (in 1pm window)';
  // Find next weekday
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[next.getDay()]} 9:00am EST`;
}

function rebuildFeedback(decisions) {
  const rejected = decisions.filter(d => d.action === 'rejected');
  const edited   = decisions.filter(d => d.action === 'approved' && d.was_edited);
  const cats = {};
  for (const d of rejected) { cats[d.rejection_reason || 'other'] = (cats[d.rejection_reason || 'other'] || 0) + 1; }

  const lines = [
    '# Feedback Patterns',
    '',
    '> Auto-generated from approval decisions. Read every session before drafting.',
    '',
    `Updated: ${new Date().toISOString().slice(0, 16)}  `,
    `Total decisions: ${decisions.length} | Rejections: ${rejected.length} | Edits on approval: ${edited.length}`,
    '',
    '---',
    '',
    '## Rejection Patterns',
    '',
  ];

  if (rejected.length) {
    for (const [cat, count] of Object.entries(cats).sort((a,b) => b[1]-a[1])) {
      lines.push(`- **${cat}** — ${count}x${count >= 3 ? ' ← **hard rule**' : ''}`);
    }
    lines.push('', '### Recent rejection reasons', '');
    for (const d of rejected.slice(-5).reverse()) {
      lines.push(`- "${d.rejection_reason || ''}" \`[${d.id}]\``);
    }
  } else {
    lines.push('No rejections yet.');
  }

  lines.push('', '---', '', '## Edit Patterns', '');
  if (edited.length) {
    lines.push(`${edited.length} approved with edits:\n`);
    for (const d of edited.slice(-5).reverse()) {
      lines.push(`**Before:** ${d.original_text}`);
      lines.push(`**After:**  ${d.final_text}`, '');
    }
  } else {
    lines.push('No edits yet.');
  }

  lines.push('', '---', '', '## Rules', '',
    '1. Any category with 3+ rejections = hard rule.',
    '2. Study edit diffs — they show what needs to change.',
    '3. When in doubt: shorter and more direct.',
  );

  fs.writeFileSync(FEEDBACK, lines.join('\n'));
}

function scheduledTime(draft) {
  return draft.urgency === 'breaking' ? 'immediately (breaking urgency)' : nextWindow();
}

// ─── main ────────────────────────────────────────────────────────────────────

const [,, action, arg1, arg2] = process.argv;
if (!action) { console.error('Usage: draft-action.js <approve|edit|reject> [text/reason] [draft-id?]'); process.exit(1); }

// Pull first
gitPull();

const drafts   = readJSON(DRAFTS, []);
const decisions = readJSON(DECISIONS, []);

// Find target draft
let targetId = (action === 'approve') ? arg1 : arg2;
let draft;
if (targetId) {
  draft = drafts.find(d => d.id === targetId);
} else {
  // Most recent pending (prefer breaking, then standard)
  const pending = drafts.filter(d => d.status === 'pending');
  draft = pending.find(d => d.urgency === 'breaking') || pending[pending.length - 1];
}

if (!draft) {
  console.log('No matching draft found.');
  process.exit(1);
}

const now = new Date().toISOString();

if (action === 'approve') {
  draft.status = 'approved';
  draft.reviewed_at = now;
  writeJSON(DRAFTS, drafts);
  gitPush(`Approve draft: ${draft.id}`);
  console.log(`APPROVED: ${draft.id}`);
  console.log(`Text: ${draft.text}`);
  console.log(`Scheduled: ${scheduledTime(draft)}`);

} else if (action === 'edit') {
  const newText = arg1;
  if (!newText) { console.error('No new text provided.'); process.exit(1); }
  decisions.push({
    id: draft.id,
    action: 'approved',
    original_text: draft.text,
    final_text: newText,
    rejection_reason: null,
    was_edited: true,
    timestamp: now,
  });
  draft.text = newText;
  draft.status = 'approved';
  draft.reviewed_at = now;
  writeJSON(DRAFTS, drafts);
  writeJSON(DECISIONS, decisions);
  rebuildFeedback(decisions);
  gitPush(`Edit+approve draft: ${draft.id}`);
  console.log(`EDITED & APPROVED: ${draft.id}`);
  console.log(`New text: ${newText}`);
  console.log(`Scheduled: ${scheduledTime(draft)}`);

} else if (action === 'reject') {
  const reason = arg1 || 'no reason given';
  decisions.push({
    id: draft.id,
    action: 'rejected',
    original_text: draft.text,
    final_text: null,
    rejection_reason: reason,
    was_edited: false,
    timestamp: now,
  });
  draft.status = 'rejected';
  draft.reviewed_at = now;
  writeJSON(DRAFTS, drafts);
  writeJSON(DECISIONS, decisions);
  rebuildFeedback(decisions);
  gitPush(`Reject draft: ${draft.id}`);
  console.log(`REJECTED: ${draft.id}`);
  console.log(`Reason: ${reason}`);

} else {
  console.error(`Unknown action: ${action}`);
  process.exit(1);
}
