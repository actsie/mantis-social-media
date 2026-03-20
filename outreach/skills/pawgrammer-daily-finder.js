#!/usr/bin/env node
/**
 * Pawgrammer Skill Finder — Daily Pipeline
 * Run at 4:00 AM daily.
 * Finds new skill candidates, generates .md files, and publishes them.
 * Processes one skill at a time. Stops after 10 skills per run.
 * Saves remaining candidates to queue for next run.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace';
const QUEUE_FILE = path.join(WORKSPACE, 'skill-queue.json');
const SKILLS_DIR = '/Users/mantisclaw/claude-skills/content/skills';
const GIT_ROOT = '/Users/mantisclaw/claude-skills';
const GITHUB_API = 'https://raw.githubusercontent.com';

const MAX_SKILLS_PER_RUN = 10;

// GitHub token for authenticated API requests (higher rate limits)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_AUTH_HEADERS = GITHUB_TOKEN
  ? ['-H', `Authorization: Bearer ${GITHUB_TOKEN}`]
  : [];

// GitHub search queries for finding Claude skills
const SEARCH_QUERIES = [
  'filename:SKILL.md',
  'topic:claude-skill',
  'topic:claude-code',
  'path:.claude/skills',
];

// Trusted orgs to prioritize


console.log('\n🔍 Pawgrammer Skill Finder — Daily Pipeline\n');
console.log(`Max skills to process: ${MAX_SKILLS_PER_RUN}\n`);

// Utility: Search GitHub for new skill candidates
async function searchGitHubForSkills(installed) {
  const candidates = [];
  const seen = new Set(installed);
  
  console.log('  Searching GitHub for Claude skills...\n');
  
  for (const query of SEARCH_QUERIES) {
    console.log(`  Query: ${query}`);
    
    // Use GitHub search via curl (authenticated for higher rate limits)
    const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=10`;
    const result = spawnSync('curl', [
      '-s', '-L',
      '-H', 'Accept: application/vnd.github+json',
      ...GITHUB_AUTH_HEADERS,
      searchUrl
    ], { encoding: 'utf8', timeout: 15000 });
    
    if (result.status !== 0) {
      console.log(`  ⚠ Search failed for: ${query}\n`);
      continue;
    }
    
    try {
      const data = JSON.parse(result.stdout);
      const items = data.items || [];
      
      for (const item of items) {
        const repo = item.repository;
        if (!repo || !repo.full_name) continue;
        
        const [org, repoName] = repo.full_name.split('/');
        const slug = repoName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        // Skip if already installed or seen
        if (seen.has(slug) || candidates.some(c => c.name === slug)) continue;
        
        // Determine trust level
        const trust = repo.stargazers_count > 1000 ? 'High' : 'Medium';
        
        // Determine category based on repo description/name
        let category = 'development';
        const desc = (repo.description || '').toLowerCase();
        const name = repoName.toLowerCase();
        
        if (desc.includes('ui') || desc.includes('design') || desc.includes('visual') || name.includes('canvas')) {
          category = 'design';
        } else if (desc.includes('data') || desc.includes('analytics') || desc.includes('ml') || desc.includes('ai')) {
          category = 'data';
        } else if (desc.includes('infra') || desc.includes('deploy') || desc.includes('cloud') || desc.includes('aws')) {
          category = 'devops';
        } else if (desc.includes('doc') || desc.includes('guide') || desc.includes('changelog')) {
          category = 'documentation';
        }
        
        candidates.push({
          name: slug,
          repo: repo.full_name,
          repoUrl: repo.html_url,
          org: org,
          trust: trust,
          category: category,
          stars: repo.stargazers_count || 0,
          reason: `Found via: ${query}`
        });
        
        seen.add(slug);
        
        // Limit to 20 candidates per search
        if (candidates.length >= 20) break;
      }
      
      console.log(`  ✓ Found ${items.length} results\n`);
      
    } catch (e) {
      console.log(`  ⚠ Parse failed for: ${query}\n`);
    }
    
    // Rate limiting - wait between searches
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`  Total candidates found: ${candidates.length}\n`);
  return candidates;
}

// Utility: Fetch URL content synchronously
function fetchUrlSync(url) {
  try {
    const result = spawnSync('curl', ['-s', '-L', url], { encoding: 'utf8', timeout: 10000 });
    if (result.status === 0 && result.stdout.length > 100) {
      return result.stdout;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Utility: Run shell command
function runCmd(cmd, cwd = null) {
  const result = spawnSync(cmd, { shell: true, cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

// Main pipeline
async function runPipeline() {
  // Step 1: Load existing queue
  let queue = { candidates: [], lastUpdated: new Date().toISOString(), processedCount: 0 };

  if (fs.existsSync(QUEUE_FILE)) {
    try {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      console.log(`✓ Loaded ${queue.candidates.length} candidates from queue\n`);
    } catch (e) {
      console.log('⚠ Could not load queue, starting fresh\n');
    }
  }

  // Step 2: Get installed skills
  function getInstalledSkills() {
    try {
      const files = fs.readdirSync(SKILLS_DIR);
      return files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
    } catch (e) {
      return [];
    }
  }

  const installed = getInstalledSkills();
  console.log(`✓ Found ${installed.length} installed skills\n`);

  // Step 3: Filter out installed skills from queue
  queue.candidates = queue.candidates.filter(c => !installed.includes(c.name));
  console.log(`Queue after filtering installed: ${queue.candidates.length} pending\n`);

  // Step 4: If queue is empty, fetch new candidates from existing file OR search GitHub
  if (queue.candidates.length === 0) {
    const candidatesFile = path.join(WORKSPACE, 'outreach/skill-finder-candidates.json');
    let newCandidates = [];
    
    // Try loading existing candidates file first
    if (fs.existsSync(candidatesFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(candidatesFile, 'utf8'));
        newCandidates = (data.candidates || []).filter(c => !installed.includes(c.name));
      } catch (e) {
        console.log('⚠ Could not load candidates file\n');
      }
    }
    
    // If still no candidates, search GitHub for new ones
    if (newCandidates.length === 0) {
      console.log('🔍 Queue empty, searching GitHub for new candidates...\n');
      newCandidates = await searchGitHubForSkills(installed);
    }
    
    if (newCandidates.length > 0) {
      queue.candidates = newCandidates;
      queue.lastUpdated = new Date().toISOString();
      console.log(`✓ Found ${newCandidates.length} new candidates\n`);
    }
  }

  if (queue.candidates.length === 0) {
    console.log('✅ No pending skills to process. Queue is empty.\n');
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    process.exit(0);
  }

  // Step 5: Process skills one at a time (up to MAX_SKILLS_PER_RUN)
  const toProcess = queue.candidates.slice(0, MAX_SKILLS_PER_RUN);
  const remaining = queue.candidates.slice(MAX_SKILLS_PER_RUN);

  console.log(`Processing ${toProcess.length} skills:\n`);

  let processedCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const skill = toProcess[i];
    const num = i + 1;
    const slug = skill.name;
    
    console.log('='.repeat(60));
    console.log(`[${num}/${toProcess.length}] ${skill.name}`);
    console.log(`  Repo: ${skill.repoUrl}`);
    console.log(`  Trust: ${skill.trust}`);
    console.log(`  Category: ${skill.category || 'development'}`);
    
    // Check if file already exists
    const outputPath = path.join(SKILLS_DIR, `${slug}.md`);
    if (fs.existsSync(outputPath)) {
      console.log(`  ⚠ File already exists, skipping\n`);
      continue;
    }
    
    // Extract org and repo from URL
    const urlParts = skill.repoUrl.replace('https://github.com/', '').split('/');
    const org = urlParts[0];
    const repo = urlParts[1];
    
    // Fetch SKILL.md
    console.log(`\n  📥 Fetching SKILL.md...`);
    let skillContent = null;
    
    // Try different URL patterns
    const urlsToTry = [
      `${GITHUB_API}/${org}/${repo}/master/${slug}/SKILL.md`,  // ComposioHQ structure
      `${GITHUB_API}/${org}/${repo}/main/SKILL.md`,
      `${GITHUB_API}/${org}/${repo}/master/SKILL.md`,
      `${GITHUB_API}/${org}/${repo}/main/${slug}/SKILL.md`,
    ];
    
    for (const url of urlsToTry) {
      const content = fetchUrlSync(url);
      if (content && content.length > 100 && content.includes('---')) {
        skillContent = content;
        console.log(`  ✓ Fetched from: ${url}`);
        break;
      }
    }
    
    if (!skillContent) {
      console.log(`  ⚠ Could not fetch SKILL.md, skipping\n`);
      continue;
    }
    
    // Parse SKILL.md to extract metadata
    const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
    let skillName = skill.name;
    let skillDescription = '';
    
    if (frontmatterMatch) {
      const fm = frontmatterMatch[1];
      const nameMatch = fm.match(/name:\s*(.+)/);
      const descMatch = fm.match(/description:\s*(.+)/);
      if (nameMatch) skillName = nameMatch[1].trim().replace(/["']/g, '');
      if (descMatch) skillDescription = descMatch[1].trim().replace(/["']/g, '');
    }
    
    // Extract body content (after frontmatter)
    const bodyContent = skillContent.replace(/^---\n[\s\S]*?\n---\n/, '');
    
    // Generate the .md file with our standard format
    const timestamp = new Date().toISOString();
    const category = skill.category || 'development';
    
    const output = `---
title: "${skillName}"
description: "${skillDescription || 'Skill from ' + org + '/' + repo}"
author: "${org}"
repoUrl: "${skill.repoUrl}"
categories: ["${category}"]
tags: ["${slug.replace(/-/g, ' ')}", "${org}", "skill"]
date: "${timestamp}"
---

${bodyContent}
`;
    
    // Write the file
    console.log(`  📝 Writing ${slug}.md...`);
    fs.writeFileSync(outputPath, output);
    console.log(`  ✓ File written\n`);
    
    // Git commit and push
    console.log(`  🔄 Committing and pushing...`);
    
    const addResult = runCmd(`git -C ${GIT_ROOT} add content/skills/${slug}.md`);
    if (addResult.status !== 0) {
      console.log(`  ⚠ Git add failed: ${addResult.stderr}\n`);
      continue;
    }
    
    const commitResult = runCmd(`git -C ${GIT_ROOT} commit -m "Add ${skillName} skill from ${org}"`);
    if (commitResult.status !== 0) {
      console.log(`  ⚠ Git commit failed: ${commitResult.stderr}\n`);
      continue;
    }
    
    const pullResult = runCmd(`git -C ${GIT_ROOT} pull --rebase origin main`);
    if (pullResult.status !== 0) {
      console.log(`  ⚠ Git pull failed: ${pullResult.stderr}\n`);
      continue;
    }
    
    const pushResult = runCmd(`git -C ${GIT_ROOT} push origin main`);
    if (pushResult.status !== 0) {
      console.log(`  ⚠ Git push failed: ${pushResult.stderr}\n`);
      continue;
    }
    
    console.log(`  ✓ Committed and pushed\n`);
    
    // Send Discord notification
    console.log(`  🔔 Sending Discord notification...`);
    const discordWebhook = 'https://discord.com/api/webhooks/1484083649342345288/vddvZ2_HrY3syCrS1wkRlWeVLSlnMTnkpq2FFVLqGch0jUxoOT8NiFbA1rxGJPqqwUfX';
    const discordPayload = JSON.stringify({
      content: `New skill published: ${skillName} — https://skills.pawgrammer.com/skills/${slug}`
    });
    
    runCmd(`curl -s -X POST "${discordWebhook}" -H "Content-Type: application/json" -d '${discordPayload}'`);
    console.log(`  ✓ Discord notification sent\n`);
    
    console.log(`  ✅ Complete: ${skill.name}\n`);
    processedCount++;
  }

  // Step 6: Save remaining queue
  queue.candidates = remaining;
  queue.lastUpdated = new Date().toISOString();
  queue.processedCount = (queue.processedCount || 0) + processedCount;

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

  console.log('='.repeat(60));
  console.log('\n✅ Pipeline complete.\n');
  console.log(`Processed: ${processedCount} skills`);
  console.log(`Remaining in queue: ${remaining.length} skills`);
  console.log(`Queue saved to: ${QUEUE_FILE}\n`);
}

// Run the pipeline
runPipeline().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});
