#!/usr/bin/env node
/**
 * pawgrammer-skill-publisher — Commits new skills to claude-skills repo and sends confirmation emails
 * Runs after pawgrammer-skill-requester generates skills
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const http = require('http');

// ─── Config ────────────────────────────────────────────────────────────────

const SKILLS_DIR = path.join(process.env.HOME, 'claude-skills', 'content', 'skills');
const REQUESTER_LOG = path.join(process.env.HOME, '.openclaw', 'workspace', 'skill-requester-emails.json');
const PUBLISHER_LOG = path.join(process.env.HOME, '.openclaw', 'workspace', 'skill-publisher-log.json');
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const FROM_EMAIL = 'skills-pawgrammer-request@agentmail.to';

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadPublisherLog() {
  try {
    return JSON.parse(fs.readFileSync(PUBLISHER_LOG, 'utf8'));
  } catch {
    return { published: [], emailsSent: [] };
  }
}

function savePublisherLog(log) {
  fs.mkdirSync(path.dirname(PUBLISHER_LOG), { recursive: true });
  fs.writeFileSync(PUBLISHER_LOG, JSON.stringify(log, null, 2));
}

function loadRequesterLog() {
  try {
    return JSON.parse(fs.readFileSync(REQUESTER_LOG, 'utf8'));
  } catch {
    return { emails: [] };
  }
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function sendEmail(to, subject, body) {
  return new Promise((resolve, reject) => {
    if (!AGENTMAIL_API_KEY) {
      console.error('AGENTMAIL_API_KEY not set');
      reject(new Error('API key missing'));
      return;
    }

    const data = JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      text: body
    });

    const options = {
      hostname: 'api.agentmail.to',
      port: 80,
      path: '/v1/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`  Email sent to ${to}`);
          resolve({ success: true, response: responseData });
        } else {
          console.error(`  Email failed: ${res.statusCode} ${responseData}`);
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`  Email error: ${e.message}`);
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

function gitPush(skillName, slug) {
  console.log(`  Committing ${skillName} to claude-skills repo...`);

  const base = path.join(process.env.HOME, 'claude-skills');

  // Check if there are changes
  const status = spawnSync('git', ['-C', base, 'status', '--porcelain'], { encoding: 'utf8' });
  if (!status.stdout.includes(`${slug}.md`)) {
    console.log(`  No changes for ${slug}.md`);
    return false;
  }

  spawnSync('git', ['-C', base, 'add', '-A'], { encoding: 'utf8' });

  const commitResult = spawnSync('git', ['-C', base, 'commit', '-m', `Add skill: ${skillName}`], { encoding: 'utf8' });
  if (commitResult.status !== 0) {
    console.error(`  Commit failed: ${commitResult.stderr}`);
    return false;
  }

  const pullResult = spawnSync('git', ['-C', base, 'pull', '--rebase', 'origin', 'main'], { encoding: 'utf8' });
  if (pullResult.status !== 0) {
    console.error(`  Pull failed: ${pullResult.stderr}`);
    return false;
  }

  const pushResult = spawnSync('git', ['-C', base, 'push', 'origin', 'main'], { encoding: 'utf8' });
  if (pushResult.status !== 0) {
    console.error(`  Push failed: ${pushResult.stderr}`);
    return false;
  }

  console.log(`  ✓ Pushed to origin/main`);
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const publisherLog = loadPublisherLog();
  const requesterLog = loadRequesterLog();

  console.log('[skill-publisher] Starting publish run...\n');

  // Find emails that haven't been published yet
  const pendingEmails = requesterLog.emails.filter(e => {
    if (e.status !== 'generated') return false;
    if (publisherLog.emailsSent.includes(e.email)) return false;
    return true;
  });

  if (pendingEmails.length === 0) {
    console.log('No pending skill requests to publish.');
    return;
  }

  console.log(`Found ${pendingEmails.length} pending skill(s) to publish:\n`);

  for (const entry of pendingEmails) {
    console.log(`Processing: ${entry.skill}`);
    console.log(`  Requester: ${entry.email}`);
    console.log(`  Message ID: ${entry.messageId}`);

    const slug = slugify(entry.skill);
    const skillPath = path.join(SKILLS_DIR, `${slug}.md`);

    // Check if skill file exists
    if (!fs.existsSync(skillPath)) {
      console.log(`  ⚠ Skill file not found: ${skillPath}`);
      entry.status = 'error_file_not_found';
      continue;
    }

    // Git push
    const pushed = gitPush(entry.skill, slug);
    if (!pushed) {
      console.log(`  ⚠ Git push failed or no changes`);
      entry.status = 'error_git_push';
      continue;
    }

    // Send confirmation email
    const subject = `Your skill request is live on Pawgrammer 🎉`;
    const body = `Hey!

Great news — your skill request has been approved and is now live on Pawgrammer.

🔗 View your skill: skills.pawgrammer.com/skills/${slug}

Here's what was built:
• Skill: ${entry.skill}
• Description: ${entry.description || 'N/A'}

Thanks for contributing to the Pawgrammer skills directory. Your skill is now available for everyone to use!

— Pawgrammer Team
skills.pawgrammer.com
`;

    try {
      await sendEmail(entry.email, subject, body);
      publisherLog.emailsSent.push(entry.email);
      entry.status = 'published';
      entry.publishedAt = new Date().toISOString();
      console.log(`  ✓ Published and emailed\n`);
    } catch (e) {
      console.error(`  ⚠ Email failed: ${e.message}\n`);
      entry.status = 'error_email';
    }
  }

  // Save logs
  savePublisherLog(publisherLog);

  // Update requester log with new statuses
  fs.writeFileSync(REQUESTER_LOG, JSON.stringify(requesterLog, null, 2));

  console.log('--- Summary ---');
  console.log(`Published: ${publisherLog.emailsSent.length}`);
  console.log(`Errors: ${pendingEmails.filter(e => e.status.startsWith('error')).length}`);
  console.log('\n[skill-publisher] Done');
}

main().catch(console.error);
