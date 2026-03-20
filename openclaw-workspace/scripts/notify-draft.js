#!/usr/bin/env node
/**
 * notify-draft.js
 * Call after writing a new draft to drafts.json.
 *
 * Usage:
 *   node notify-draft.js <draft-id>
 *
 * Reads the draft from drafts.json, then sends:
 *   - Discord webhook
 *   - Telegram (via openclaw message)
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
const TELEGRAM_CHAT   = '6241290513';

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

function sendTelegram(text) {
  const result = spawnSync('openclaw', [
    'message', 'send',
    '--channel', 'telegram',
    '--to', TELEGRAM_CHAT,
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

  const urgency  = draft.urgency || 'standard';
  const label    = urgency === 'breaking' ? '[BREAKING]' : '[DRAFT]';
  const type     = draft.type || 'original';
  const context  = draft.context || '(no context)';
  const platform = draft.platform || 'twitter';
  const approvalUrl = 'http://localhost:8901/tweets';

  // ── Discord ──
  if (DISCORD_WEBHOOK) {
    try {
      const discordBody = {
        content: `${label} New draft ready for approval\n**Type:** ${type} (${platform})\n**Context:** ${context}\n**Approve:** ${approvalUrl}`,
        username: 'MantisCAW',
      };
      const res = await post(DISCORD_WEBHOOK, discordBody);
      console.log(`Discord: ${res.status}`);
    } catch (e) {
      console.error('Discord failed:', e.message);
    }
  } else {
    console.log('Discord: skipped (no webhook)');
  }

  // ── Telegram ──
  const tgText = `${label} Agent Card draft ready\nType: ${type} | ${platform}\nContext: ${context}\nApprove: ${approvalUrl}`;
  const tgOk = sendTelegram(tgText);
  console.log(`Telegram: ${tgOk ? 'sent' : 'failed'}`);

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
