#!/usr/bin/env node
/**
 * pawgrammer-skill-requester — Discord bot for processing skill requests
 * Monitors channel 1429050423976919082, parses requests, generates skills via Claude Code
 */

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const http = require('http');

// ─── Config ────────────────────────────────────────────────────────────────

const CHANNEL_ID = '1429050423976919082';
const SKILLS_DIR = path.join(process.env.HOME, 'claude-skills', 'content', 'skills');
const SKILLS_REPO = path.join(process.env.HOME, 'claude-skills');
const TRACKER_FILE = path.join(process.env.HOME, '.openclaw', 'workspace', 'skill-requests-processed.json');
const REQUESTER_LOG = path.join(process.env.HOME, '.openclaw', 'workspace', 'skill-requester-emails.json');
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const FROM_EMAIL = 'skills-pawgrammer-request@agentmail.to';

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadTracker() {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch {
    return { processedMessageIds: [], processedAt: {} };
  }
}

function saveTracker(tracker) {
  fs.mkdirSync(path.dirname(TRACKER_FILE), { recursive: true });
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2));
}

function loadRequesterLog() {
  try {
    return JSON.parse(fs.readFileSync(REQUESTER_LOG, 'utf8'));
  } catch {
    return { emails: [] };
  }
}

function saveRequesterLog(log) {
  fs.mkdirSync(path.dirname(REQUESTER_LOG), { recursive: true });
  fs.writeFileSync(REQUESTER_LOG, JSON.stringify(log, null, 2));
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function parseRequest(content, embed) {
  const result = {
    skillName: null,
    description: null,
    useCase: null,
    email: null,
    rawContent: content || ''
  };

  // If embed is provided, parse fields from it (Pawgrammer-Skills-Reporter format)
  if (embed && embed.fields && embed.fields.length > 0) {
    for (const field of embed.fields) {
      const name = field.name || '';
      const value = field.value || '';

      if (name.includes('Email') || name.includes('📧')) {
        result.email = value.trim();
      } else if (name.includes('Skill Name') || name.includes('🔧')) {
        result.skillName = value.trim();
      } else if (name.includes('What should') || name.includes('📋') || name.includes('Description')) {
        result.description = value.trim();
      } else if (name.includes('Use Case') || name.includes('💡') || name.includes('Example')) {
        result.useCase = value.trim();
      }
    }
  }

  // Fallback to content parsing if embed didn't provide enough data
  if (!result.skillName && content) {
    const skillMatch = content.match(/(?:🎯 New Skill Request|Skill Name|Skill):\s*([^\n]+)/i);
    if (skillMatch) result.skillName = skillMatch[1].trim();
  }

  if (!result.description && content) {
    const descMatch = content.match(/Description:\s*([^\n]+)/i);
    if (descMatch) result.description = descMatch[1].trim();
  }

  if (!result.useCase && content) {
    const useCaseMatch = content.match(/Use Case:\s*([^\n]+)/i);
    if (useCaseMatch) result.useCase = useCaseMatch[1].trim();
  }

  if (!result.email && content) {
    const emailMatch = content.match(/Email:\s*([^\s\n]+)/i);
    if (emailMatch) result.email = emailMatch[1].trim();
  }

  return result;
}

function skillExists(skillName) {
  const slug = slugify(skillName);
  const skillPath = path.join(SKILLS_DIR, `${slug}.md`);
  return fs.existsSync(skillPath);
}

function generateSkill(request) {
  const slug = slugify(request.skillName);
  const skillPath = path.join(SKILLS_DIR, `${slug}.md`);

  const prompt = `Research ${request.skillName} and generate a complete skill .md file based on this request:

- Skill: ${request.skillName}
- What it should do: ${request.description}
- Use case: ${request.useCase || 'General use'}

Write to ${skillPath}

Follow the AgentSkills spec format:
- Clear description of what the skill does
- When to use it (triggers)
- Step-by-step instructions
- Any tools or APIs needed
- Examples if relevant

Make it production-ready.`;

  console.log(`  Spawning Claude Code for: ${request.skillName}`);

  const result = spawnSync('claude', [
    '--print',
    '--permission-mode', 'bypassPermissions',
    prompt
  ], {
    encoding: 'utf8',
    timeout: 120000, // 2 min timeout
    cwd: path.dirname(SKILLS_DIR)
  });

  if (result.status !== 0) {
    console.error(`  Claude Code failed: ${result.stderr}`);
    return null;
  }

  // Check if file was created
  if (fs.existsSync(skillPath)) {
    console.log(`  Generated: ${skillPath}`);
    return skillPath;
  }

  console.error(`  File not created at ${skillPath}`);
  return null;
}

function securityCheck(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf8');
  const dangerousPatterns = [/rm\s+-rf/i, /sudo\s+rm/i, /eval\s*\(/i, /exec\s*\(/i, /system\s*\(/i, /DROP\s+TABLE/i, /DELETE\s+FROM/i];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      console.error(`  Security check failed: dangerous pattern ${pattern}`);
      return false;
    }
  }
  console.log(`  Security check passed`);
  return true;
}

function sendEmail(to, subject, body) {
  return new Promise((resolve, reject) => {
    if (!AGENTMAIL_API_KEY) {
      console.error('  AGENTMAIL_API_KEY not set');
      reject(new Error('API key missing'));
      return;
    }

    const data = JSON.stringify({ from: FROM_EMAIL, to, subject, text: body });
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
          console.log(`  ✓ Email sent to ${to}`);
          resolve({ success: true });
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

  const status = spawnSync('git', ['-C', SKILLS_REPO, 'status', '--porcelain'], { encoding: 'utf8' });
  if (!status.stdout.includes(`${slug}.md`)) {
    console.log(`  No changes for ${slug}.md`);
    return false;
  }

  spawnSync('git', ['-C', SKILLS_REPO, 'add', `content/skills/${slug}.md`], { encoding: 'utf8' });

  const commitResult = spawnSync('git', ['-C', SKILLS_REPO, 'commit', '-m', `Add ${skillName} skill from user request`], { encoding: 'utf8' });
  if (commitResult.status !== 0) {
    console.error(`  Commit failed: ${commitResult.stderr}`);
    return false;
  }

  const pullResult = spawnSync('git', ['-C', SKILLS_REPO, 'pull', '--rebase', 'origin', 'main'], { encoding: 'utf8' });
  if (pullResult.status !== 0) {
    console.error(`  Pull failed: ${pullResult.stderr}`);
    return false;
  }

  const pushResult = spawnSync('git', ['-C', SKILLS_REPO, 'push', 'origin', 'main'], { encoding: 'utf8' });
  if (pushResult.status !== 0) {
    console.error(`  Push failed: ${pushResult.stderr}`);
    return false;
  }

  console.log(`  ✓ Pushed to origin/main`);
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    console.error('DISCORD_BOT_TOKEN not set in environment');
    process.exit(1);
  }

  const tracker = loadTracker();
  const requesterLog = loadRequesterLog();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once('ready', async () => {
    console.log(`[skill-requester] Connected as ${client.user.tag}`);

    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) { console.error(`Channel ${CHANNEL_ID} not found`); client.destroy(); return; }

      console.log(`Monitoring channel: ${CHANNEL_ID}`);
      const messages = await channel.messages.fetch({ limit: 100 });

      let newRequests = 0, skipped = 0, alreadyExists = 0;

      for (const [msgId, msg] of messages) {
        // Skip if already processed
        if (tracker.processedMessageIds.includes(msgId)) {
          skipped++;
          continue;
        }

        const content = msg.content.trim();
        
        // Check for embed with skill request marker (Pawgrammer-Skills-Reporter format)
        const embed = msg.embeds && msg.embeds.length > 0 ? msg.embeds[0] : null;
        const hasMarker = embed && embed.title && embed.title.includes('🎯 New Skill Request');
        
        if (!hasMarker) {
          skipped++;
          continue;
        }

        console.log(`\nProcessing request from ${msg.author.tag}:`);
        if (content) {
          console.log(`  Content: ${content.slice(0, 80)}...`);
        } else {
          console.log(`  Embed title: ${embed.title}`);
        }

        const request = parseRequest(content, embed);

        if (!request.skillName) {
          console.log(`  Skipping: could not parse skill name`);
          tracker.processedMessageIds.push(msgId);
          tracker.processedAt[msgId] = new Date().toISOString();
          continue;
        }

        // Check if skill already exists
        if (skillExists(request.skillName)) {
          console.log(`  Skill already exists: ${request.skillName}`);
          alreadyExists++;
          tracker.processedMessageIds.push(msgId);
          tracker.processedAt[msgId] = new Date().toISOString();
          continue;
        }

        // Generate skill
        const skillPath = generateSkill(request);

        if (!skillPath) {
          console.log(`  Generation failed for: ${request.skillName}`);
          continue;
        }

        // Security check
        if (!securityCheck(skillPath)) {
          console.log(`  Security check failed, removing: ${skillPath}`);
          fs.unlinkSync(skillPath);
          continue;
        }

        const slug = slugify(request.skillName);
        const skillUrl = `skills.pawgrammer.com/skills/${slug}`;

        // 1. Git commit and push immediately
        const pushed = gitPush(request.skillName, slug);
        if (!pushed) {
          console.log(`  ⚠ Git push failed - skill generated but not committed`);
        }

        // 2. Post confirmation to Discord channel
        try {
          const confirmMsg = `✅ ${request.skillName} skill is now live at ${skillUrl}`;
          await channel.send(confirmMsg);
          console.log(`  ✓ Posted confirmation to Discord`);
        } catch (e) {
          console.error(`  Discord post failed: ${e.message}`);
        }

        // 3. Send AgentMail confirmation email
        if (request.email) {
          const subject = 'Your skill request is live on Pawgrammer';
          const body = `Hey!\n\nYour ${request.skillName} skill is live at ${skillUrl}.\n\nThanks for contributing to Pawgrammer!\n\n— Pawgrammer Team\n`;

          try {
            await sendEmail(request.email, subject, body);
            requesterLog.emails.push({
              email: request.email,
              skill: request.skillName,
              messageId: msgId,
              requestedAt: new Date().toISOString(),
              status: 'published',
              publishedAt: new Date().toISOString()
            });
            console.log(`  ✓ Email sent to ${request.email}`);
          } catch (e) {
            console.error(`  Email failed: ${e.message}`);
            requesterLog.emails.push({
              email: request.email,
              skill: request.skillName,
              messageId: msgId,
              requestedAt: new Date().toISOString(),
              status: 'error_email'
            });
          }
          saveRequesterLog(requesterLog);
        }

        // Mark as processed
        tracker.processedMessageIds.push(msgId);
        tracker.processedAt[msgId] = new Date().toISOString();
        saveTracker(tracker);

        newRequests++;
        console.log(`  ✓ Processed: ${request.skillName}`);
      }

      saveTracker(tracker);

      console.log(`\n--- Summary ---`);
      console.log(`New requests processed: ${newRequests}`);
      console.log(`Already existed: ${alreadyExists}`);
      console.log(`Skipped (previously processed): ${skipped}`);

    } catch (error) {
      console.error('Error processing channel:', error);
    } finally {
      client.destroy();
      console.log('\n[skill-requester] Done');
    }
  });

  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  await client.login(token);
}

main().catch(console.error);
