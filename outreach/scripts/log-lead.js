#!/usr/bin/env node
/**
 * log-lead.js
 * Log a lead to KameleonDB from any outreach script.
 * 
 * Usage: node log-lead.js --platform IG --account "salon_name" --fit 4 --notes "website broken"
 */

const { execSync } = require('child_process');

const args = process.argv.slice(2);
const argMap = {};

args.forEach((arg, i) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
    argMap[key] = value;
  }
});

const leadData = {
  platform: argMap.platform || 'unknown',
  account_name: argMap.account || 'unknown',
  profile_link: argMap.link || '',
  segment: argMap.segment || 'unknown',
  fit_score: parseInt(argMap.fit) || 0,
  reason_for_fit: argMap.reason || '',
  reply_status: argMap.status || 'pending',
  notes: argMap.notes || ''
};

// Escape single quotes for shell
const jsonStr = JSON.stringify(leadData).replace(/'/g, "'\\''");

try {
  execSync(`cd /Users/mantisclaw/.openclaw/workspace && kameleondb -d "sqlite:///./kameleon-leads.db" data insert lead '${jsonStr}'`, {
    stdio: 'inherit'
  });
  console.log('✓ Lead logged to KameleonDB');
} catch (err) {
  console.error('✗ Failed to log lead:', err.message);
  process.exit(1);
}
