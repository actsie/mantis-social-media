#!/usr/bin/env node
/**
 * x-post-approver.js
 * Posts approved X drafts from approval queue.
 * Run every 15 minutes via cron.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const QUEUE_PATH = path.join(WORKSPACE, 'outreach/x/approval-queue.json');
const ENGAGEMENT_LOG = path.join(WORKSPACE, 'outreach/x/engagement-log.json');
const TELEGRAM_TARGET = '6241290513';

console.log('\n🔍 X Post Approver — checking for approved drafts\n');

// Read queue
if (!fs.existsSync(QUEUE_PATH)) {
  console.log('No approval queue found. Exiting.');
  process.exit(0);
}

let queue;
try {
  queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
} catch (e) {
  console.error('Failed to read queue:', e.message);
  process.exit(1);
}

// Find approved entries
const approved = queue.entries.filter(e => e.status === 'approved' && !e.posted_at);

if (approved.length === 0) {
  console.log('No approved entries to post. Exiting.');
  process.exit(0);
}

console.log(`Found ${approved.length} approved entry(ies) to post\n`);

// Process each approved entry
for (const entry of approved) {
  console.log(`Processing: ${entry.id}`);
  console.log(`  Type: ${entry.type}`);
  console.log(`  Content: ${entry.content.substring(0, 80)}...`);
  
  // Use content directly from queue entry (don't read file)
  const content = entry.content;
  
  // Create session message for posting
  let sessionMsg;
  
  if (entry.type === 'reply') {
    // Reply flow
    sessionMsg = `X POST APPROVER — Reply to ${entry.parent.author}

BROWSER: Use profile="openclaw". Logged into @stacydonna0x.

1. Navigate to: ${entry.parent.url}

2. Click Reply button

3. Type this exact text:
${content}

4. Click Reply/Post button (NOT Ctrl+Enter)

5. Like the original post

6. Wait for confirmation that reply posted

7. Log to engagement-log.json:
   const fs = require('fs');
   const logPath = 'outreach/x/engagement-log.json';
   const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
   log.sessions.push({
     timestamp: new Date().toISOString(),
     type: 'indie-hacker',
     targetHandle: '${entry.parent.author}',
     postUrl: '${entry.parent.url}',
     postText: '${entry.parent.text.substring(0, 200)}',
     replyText: '${content.replace(/'/g, "\\'")}',
     liked: true,
     platform: 'x',
     account: 'stacydonna0x',
     engagement: { likesOnOurReply: 0, repliesToOurReply: 0, originalPosterEngaged: false },
     humanized: true,
     fromApprovalQueue: true,
     approvalEntryId: '${entry.id}'
   });
   fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

8. Send Telegram to ${TELEGRAM_TARGET}:
   ✅ X reply published
   To: ${entry.parent.author}
   Content: "${content.substring(0, 100)}..."
   `;
  } else if (entry.type === 'original_post') {
    // Original post flow
    sessionMsg = `X POST APPROVER — Original Post (Mode ${entry.mode}: ${entry.modeName})

BROWSER: Use profile="openclaw". Logged into @stacydonna0x.

1. Navigate to: https://x.com/compose/tweet

2. Type this exact text:
${content}

3. Click Post button (NOT Ctrl+Enter)

4. Wait for confirmation that post published

5. Get the post URL from the URL bar or snapshot

6. Log to original-posts-log.json:
   const fs = require('fs');
   const logPath = 'outreach/x/original-posts-log.json';
   const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
   log.posts.push({
     timestamp: new Date().toISOString(),
     date: '${new Date().toISOString().split('T')[0]}',
     mode: ${entry.mode},
     modeName: '${entry.modeName}',
     tweetText: '${content.replace(/'/g, "\\'")}',
     tweetUrl: 'URL_FROM_BROWSER',
     postType: 'standard',
     quotedTweetUrl: null,
     platform: 'x',
     account: 'stacydonna0x',
     humanized: true,
     fromApprovalQueue: true,
     approvalEntryId: '${entry.id}'
   });
   fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

7. Send Telegram to ${TELEGRAM_TARGET}:
   ✅ X original post published
   Mode: ${entry.mode} (${entry.modeName})
   Content: "${content.substring(0, 100)}..."
   `;
  }
  
  // Create one-shot cron to post (schedule 10 seconds in future to ensure execution)
  const sessionName = `x-post-${entry.id.replace(/[^a-z0-9]/g, '-')}`;
  const runAt = new Date(Date.now() + 10000).toISOString(); // 10 seconds from now
  const result = spawnSync('openclaw', [
    'cron', 'add',
    '--name', sessionName,
    '--at', runAt,
    '--message', sessionMsg,
    '--announce',
    '--delete-after-run',
    '--tz', 'America/Los_Angeles'
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  
  if (result.status === 0) {
    console.log(`  ✓ Session created: ${sessionName}`);
    
    // Update queue entry
    entry.status = 'posted';
    entry.posted_at = new Date().toISOString();
  } else {
    console.error(`  ✗ Failed to create session: ${result.stderr}`);
  }
}

// Write back updated queue
try {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
  console.log('\n✓ Queue updated');
} catch (e) {
  console.error('Failed to write queue:', e.message);
}

// Build and send Telegram summary
const nowPST = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: true });
const queueEntries = queue.entries || [];
const pendingCount = queueEntries.filter(e => e.status === 'pending').length;
const postedCount = queueEntries.filter(e => e.status === 'posted' && e.posted_at && new Date(e.posted_at).getTime() > Date.now() - 900000).length; // posted in last 15 min

let summaryMsg = `🐦 *X Approver — ${nowPST}*\n\n`;
summaryMsg += `*Queue checked:* ${queueEntries.length} entries\n\n`;

if (approved.length > 0) {
  summaryMsg += `*Posted this run:*\n`;
  for (const entry of approved) {
    if (entry.type === 'reply') {
      summaryMsg += `• Reply to @${entry.parent.author || 'unknown'}\n`;
      summaryMsg += `  Draft: "${entry.content.substring(0, 80)}${entry.content.length > 80 ? '...' : ''}"\n`;
      summaryMsg += `  Posted at: ${nowPST}\n\n`;
    } else if (entry.type === 'original_post') {
      summaryMsg += `• Original Post (Mode ${entry.mode})\n`;
      summaryMsg += `  Draft: "${entry.content.substring(0, 80)}${entry.content.length > 80 ? '...' : ''}"\n`;
      summaryMsg += `  Posted at: ${nowPST}\n\n`;
    }
  }
} else {
  summaryMsg += `*Posted this run:* Nothing posted\n`;
  summaryMsg += `• ${pendingCount} pending, ${queueEntries.filter(e => e.status === 'posted').length} already posted\n\n`;
}

if (pendingCount > 0) {
  summaryMsg += `*Pending approvals:*\n`;
  const pending = queueEntries.filter(e => e.status === 'pending').slice(0, 5); // Show first 5
  for (const p of pending) {
    if (p.parent && p.parent.author) {
      summaryMsg += `• @${p.parent.author}: ${p.parent.url || 'N/A'}\n`;
    } else if (p.type === 'original_post') {
      summaryMsg += `• Original Post (Mode ${p.mode})\n`;
    }
    summaryMsg += `  Draft: "${p.content.substring(0, 60)}${p.content.length > 60 ? '...' : ''}"\n`;
    const createdTime = p.created_at ? new Date(p.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';
    summaryMsg += `  Created: ${createdTime}\n\n`;
  }
  if (pendingCount > 5) {
    summaryMsg += `  ...and ${pendingCount - 5} more pending\n`;
  }
}

// Send summary via Telegram
const summaryResult = spawnSync('openclaw', [
  'message', 'send',
  '--channel', 'telegram',
  '--target', TELEGRAM_TARGET,
  '--message', summaryMsg
], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

if (summaryResult.status === 0) {
  console.log('✓ Telegram summary sent');
} else {
  console.error('✗ Failed to send Telegram:', summaryResult.stderr);
}

console.log('\n✅ X Post Approver done\n');
