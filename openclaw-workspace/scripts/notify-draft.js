#!/usr/bin/env node
/**
 * notify-draft.js
 * Call after writing a new draft to drafts.json.
 *
 * Usage:
 *   node notify-draft.js <draft-id>
 *
 * Reads the draft from drafts.json, then sends:
 *   - Discord webhook (agentcard-drafts channel)
 *   - Discord via openclaw message (agentcard-drafts channel)
 *   - Slack (if SLACK_WEBHOOK_AGENTCARD is set)
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const WORKSPACE = '/Users/mantisclaw/agentcard-social/openclaw-workspace';
const DRAFTS    = path.join(WORKSPACE, 'drafts.json');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_AGENTCARD || '';
const SLACK_WEBHOOK   = process.env.SLACK_WEBHOOK_AGENTCARD   || '';
<<<<<<< HEAD
const DISCORD_CHAT    = '1485501084742062191';  // agentcard-drafts
=======
const DISCORD_CHANNEL = '1485501084742062191'; // agentcard-drafts
>>>>>>> 8ae19e88d8eb69c566846e1f18fa7940f11ae5ce

// ─── helpers ────────────────────────────────────────────────────────────────

function post(urlStr, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendDiscord(text) {
  const result = spawnSync('openclaw', [
    'message', 'send',
    '--channel', 'discord',
<<<<<<< HEAD
    '--to', DISCORD_CHAT,
=======
    '--target', `channel:${DISCORD_CHANNEL}`,
>>>>>>> 8ae19e88d8eb69c566846e1f18fa7940f11ae5ce
    '--message', text,
    '--best-effort',
  ], { encoding: 'utf8' });
  return result.status === 0;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const draftId = process.argv[2];
  if (!draftId) {
    console.error('Usage: node notify-draft.js <draft-id>');
    process.exit(1);
  }

  let drafts;
  try {
    drafts = JSON.parse(fs.readFileSync(DRAFTS, 'utf8'));
  } catch (e) {
    console.error('Could not read drafts.json:', e.message);
    process.exit(1);
  }

  const draft = drafts.find(d => d.id === draftId);
  if (!draft) {
    console.error(`Draft not found: ${draftId}`);
    process.exit(1);
  }

  const urgency    = draft.urgency || 'standard';
  const label      = urgency === 'breaking' ? '[BREAKING]' : '[DRAFT]';
  const type       = draft.type || 'original';
  const context    = draft.context || '';
  const platform   = draft.platform || 'twitter';
  const approvalUrl = 'http://localhost:8901/tweets';
  const footer     = `Approve: ${approvalUrl}\nReply with: approve / edit: [new text] / reject: [reason]`;

  // Build message body based on type
  let msgBody;
  if (type === 'reply') {
    const sourceText = draft.source_post_text ? draft.source_post_text.substring(0, 100) + (draft.source_post_text.length > 100 ? '...' : '') : '';
    const sourceUrl  = draft.source_post_url || '';
    msgBody = `🔔 ${label} New reply ready for approval\n\nReplying to: ${sourceText}\n${sourceUrl}\n\nDraft:\n${draft.text || ''}\n\n${footer}`;
  } else if (type === 'thread') {
    const tweets = draft.thread || [draft.text || ''];
    const threadText = tweets.map((t, i) => `${i + 1}/ ${t}`).join('\n\n');
    msgBody = `🔔 ${label} New thread ready for approval\n\nDraft:\n${threadText}${context ? '\n\nContext: ' + context : ''}\n\n${footer}`;
  } else {
    // original
    msgBody = `🔔 ${label} New post ready for approval\n\nDraft:\n${draft.text || ''}${context ? '\n\nContext: ' + context : ''}\n\n${footer}`;
  }

  // ── Discord ──
  if (DISCORD_WEBHOOK) {
    try {
      const discordBody = { content: msgBody, username: 'MantisCAW' };
      const res = await post(DISCORD_WEBHOOK, discordBody);
      console.log(`Discord: ${res.status}`);
    } catch (e) {
      console.error('Discord failed:', e.message);
    }
  } else {
    console.log('Discord: skipped (no webhook)');
  }

<<<<<<< HEAD
  // ── Discord (openclaw message) ──
  const dcOk = sendDiscord(msgBody);
  console.log(`Discord: ${dcOk ? 'sent' : 'failed'}`);
=======
  // ── Discord (openclaw) ──
  const dcOk = sendDiscord(msgBody);
  console.log(`Discord (openclaw): ${dcOk ? 'sent' : 'failed'}`);
>>>>>>> 8ae19e88d8eb69c566846e1f18fa7940f11ae5ce

  // ── Slack ──
  if (SLACK_WEBHOOK) {
    try {
      const slackBody = {
        text: `${label} New draft ready for approval`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `*${label} New draft ready*\n*Type:* ${type} (${platform})\n*Context:* ${context}\n*Approve:* <${approvalUrl}|Open dashboard>` } },
        ],
      };
      const res = await post(SLACK_WEBHOOK, slackBody);
      console.log(`Slack: ${res.status}`);
    } catch (e) {
      console.error('Slack failed:', e.message);
    }
  } else {
    console.log('Slack: skipped (webhook not set)');
  }

  console.log(`Done. Draft: ${draftId}`);
}

main().catch(e => { console.error(e); process.exit(1); });
xit(1); });
); });
