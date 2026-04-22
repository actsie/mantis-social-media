#!/usr/bin/env node
/**
 * reddit-complaint-health-check.cjs
 * Fires at :30 every hour. Checks if leads are flowing from the hourly cron
 * to the dashboard. Posts Discord alert if something is wrong.
 *
 * Health check logic:
 * 1. Fetch GET /api/leads — if any lead.createdAt in last hour → OK, exit
 * 2. No new leads in last hour → check /tmp/reddit-complaint-leads-YYYYMMDD.json
 * 3. Diagnose: file missing / poller failed / cron not fired / API error
 * 4. Post diagnosis to Discord channel 1485556397293703279
 */

const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const DASHBOARD_API = 'https://mantisclaw-dashboard.royaldependent9022.workers.dev';
const DISCORD_CHANNEL = '1485556397293703279';

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayPST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function httpsGet(path) {
  return new Promise((resolve) => {
    const url = new URL(DASHBOARD_API + path);
    const options = {
      hostname: url.hostname, port: 443, path: url.pathname, method: 'GET',
      headers: { 'Accept': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ ok: true, data: JSON.parse(data) }); }
        catch (e) { resolve({ ok: false, error: 'Invalid JSON', raw: data.slice(0, 200) }); }
      });
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.end();
  });
}

function sendDiscord(message) {
  try {
    execSync('openclaw', [
      'message', 'send',
      '--channel', 'discord',
      '--target', DISCORD_CHANNEL,
      '--message', message
    ], { encoding: 'utf8', timeout: 10000 });
    return true;
  } catch (e) {
    console.error(`Discord send failed: ${e.message}`);
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const today = todayPST().replace(/-/g, '');
  const leadsFile = `/tmp/reddit-complaint-leads-${today}.json`;

  console.log(`\n🔍 Reddit Complaint Health Check — ${today}\n`);

  // Step 1: Check dashboard leads
  const leadsRes = await httpsGet('/api/leads');
  if (!leadsRes.ok) {
    console.log(`API error: ${leadsRes.error}`);
    sendDiscord(`⚠️ **Reddit Leads Health — ERROR**\nDashboard API unreachable: ${leadsRes.error}`);
    return;
  }

  const rawLeads = leadsRes.data.leads || leadsRes.data || [];
  const leads = Array.isArray(rawLeads) ? rawLeads : [];
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentLeads = leads.filter(l => l.createdAt && new Date(l.createdAt).getTime() > oneHourAgo);

  console.log(`Dashboard leads total: ${leads.length}`);
  console.log(`New leads in last hour: ${recentLeads.length}`);

  if (recentLeads.length > 0) {
    console.log(`✅ OK — ${recentLeads.length} new lead(s) in the last hour`);
    return; // Nothing to alert on
  }

  // Step 2: No recent leads — diagnose
  console.log(`\n⚠️ No leads in the last hour. Diagnosing...\n`);

  let diagnosis = '';
  let alertLevel = '⚠️';

  if (!fs.existsSync(leadsFile)) {
    diagnosis = `**File missing:** \`${leadsFile}\`\nLikely cause: cron subagent hasn't fired yet, or file was named differently`;
    alertLevel = '⚠️';
    console.log(`Diagnosis: leads file missing`);
  } else {
    try {
      const stat = fs.statSync(leadsFile);
      const fileAgeMs = Date.now() - stat.mtimeMs;
      const fileAgeMin = Math.round(fileAgeMs / 60000);
      const data = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
      const fileLeads = Array.isArray(data) ? data.length : (data.leads ? data.leads.length : 0);

      if (fileAgeMs > 2 * 60 * 60 * 1000) {
        // File older than 2 hours
        diagnosis = `**Poller stalled:** file exists (${fileLeads} leads) but last modified ${fileAgeMin} min ago. Poller may have died.`;
        alertLevel = '🔴';
        console.log(`Diagnosis: poller stalled, file ${fileAgeMin} min old`);
      } else if (fileLeads === 0) {
        diagnosis = `**Empty file:** \`${leadsFile}\` exists but has 0 leads. No HOT/WARM complaints found this hour.`;
        alertLevel = 'ℹ️';
        console.log(`Diagnosis: empty leads file`);
      } else {
        diagnosis = `**API mismatch:** file has ${fileLeads} leads (modified ${fileAgeMin} min ago) but dashboard shows 0 new leads in the last hour. Poller may have failed to POST.`;
        alertLevel = '🔴';
        console.log(`Diagnosis: poller failed to POST`);
      }
    } catch (e) {
      diagnosis = `**File error:** could not read \`${leadsFile}\`: ${e.message}`;
      alertLevel = '🔴';
      console.log(`Diagnosis: file read error — ${e.message}`);
    }
  }

  // Step 3: Also check activity log
  const actRes = await httpsGet('/api/activity');
  let activityNote = '';
  if (actRes.ok && actRes.data.activity && actRes.data.activity.length > 0) {
    const recentActivity = actRes.data.activity
      .filter(a => new Date(a.ts).getTime() > oneHourAgo)
      .map(a => a.msg);
    if (recentActivity.length > 0) {
      activityNote = `\n\nRecent activity (last hour):\n${recentActivity.map(m => '• ' + m).join('\n')}`;
    }
  }

  // Step 4: Post to Discord
  const now = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date());

  const message = [
    `${alertLevel} **Reddit Leads Health — ${now} PST**`,
    ``,
    diagnosis,
    activityNote,
    ``,
    `Dashboard: <https://mantisclaw-dashboard.royaldependent9022.workers.dev>`
  ].filter(s => s).join('\n');

  console.log(`\n${message}\n`);
  sendDiscord(message);
}

main().catch(e => {
  console.error(`Health check error: ${e.message}`);
  sendDiscord(`🔴 **Reddit Leads Health — ERROR**\nScript crashed: ${e.message}`);
});