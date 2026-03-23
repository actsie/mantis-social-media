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
// Organized by category for better coverage
const SEARCH_QUERIES = [
  // === SKILL.md file patterns (exact matches) ===
  'filename:SKILL.md path:.claude',
  'filename:SKILL.md path:skills',
  'filename:SKILL.md path:claude',
  'filename:skill.md',  // lowercase
  'filename:skills.md', // plural
  
  // === Topic tags ===
  'topic:claude-skill',
  'topic:claude-code',
  'topic:claude-skills',
  'topic:anthropic',
  'topic:ai-assistant',
  'topic:agent-skill',
  'topic:mcp',  // Model Context Protocol
  
  // === Description-based searches ===
  'claude skill in:description',
  'claude-code skill in:description',
  'anthropic assistant in:description',
  
  // === Awesome lists (crawl these for individual skills) ===
  'awesome-claude-skills in:name',
  'awesome-claude-code in:name',
  'claude-skills-list in:name',
  
  // === Known skill creator orgs ===
  'org:ComposioHQ claude',
  'org:anthropics claude',
];

// Trusted orgs to prioritize


console.log('\n🔍 Pawgrammer Skill Finder — Daily Pipeline\n');
console.log(`Max skills to process: ${MAX_SKILLS_PER_RUN}\n`);

// Utility: Pre-validate SKILL.md exists before queuing
// Returns the working URL if found, null otherwise
function validateSkillMdExists(org, repo) {
  const urlsToTry = [
    `${GITHUB_API}/${org}/${repo}/main/SKILL.md`,
    `${GITHUB_API}/${org}/${repo}/master/SKILL.md`,
    `${GITHUB_API}/${org}/${repo}/main/.claude/skills/SKILL.md`,
    `${GITHUB_API}/${org}/${repo}/master/.claude/skills/SKILL.md`,
    `${GITHUB_API}/${org}/${repo}/main/skills/SKILL.md`,
    `${GITHUB_API}/${org}/${repo}/master/skills/SKILL.md`,
  ];
  
  for (const url of urlsToTry) {
    const result = spawnSync('curl', [
      '-s', '-L', '-o', '/dev/null', '-w', '%{http_code}',
      '-H', 'Accept: application/vnd.github+json',
      ...GITHUB_AUTH_HEADERS,
      url
    ], { encoding: 'utf8', timeout: 8000 });
    
    if (result.status === 0 && result.stdout.trim() === '200') {
      return url;  // Return the working URL
    }
  }
  
  return null;
}

// Utility: Validate README.md as skill fallback
// Returns { valid: boolean, readmeUrl: string|null, reason: string } if README looks like a skill
function validateReadmeAsSkill(org, repo) {
  const readmeUrls = [
    `${GITHUB_API}/${org}/${repo}/main/README.md`,
    `${GITHUB_API}/${org}/${repo}/master/README.md`,
    `${GITHUB_API}/${org}/${repo}/main/readme.md`,
    `${GITHUB_API}/${org}/${repo}/master/readme.md`,
  ];
  
  let readmeContent = null;
  let readmeUrl = null;
  
  // Fetch README
  for (const url of readmeUrls) {
    const result = spawnSync('curl', [
      '-s', '-L',
      '-H', 'Accept: application/vnd.github+json',
      ...GITHUB_AUTH_HEADERS,
      url
    ], { encoding: 'utf8', timeout: 8000 });
    
    if (result.status === 0 && result.stdout.length > 200) {
      readmeContent = result.stdout;
      readmeUrl = url;
      break;
    }
  }
  
  if (!readmeContent) {
    return { valid: false, readmeUrl: null, reason: 'No README found' };
  }
  
  // Check for skill-related keywords
  const skillKeywords = [
    'claude', 'skill', 'agent', 'prompt', 'automation', 'mcp',
    'model context', 'anthropic', 'ai assistant', 'cursor',
    'windsurf', 'cline', 'roo code', 'claude code'
  ];
  
  const readmeLower = readmeContent.toLowerCase();
  const matches = skillKeywords.filter(kw => readmeLower.includes(kw));
  
  if (matches.length >= 2) {
    return { 
      valid: true, 
      readmeUrl: readmeUrl, 
      reason: `README mentions: ${matches.slice(0, 4).join(', ')}`
    };
  }
  
  return { valid: false, readmeUrl: null, reason: 'README lacks skill keywords' };
}

// Utility: Crawl awesome-lists to extract individual skill repos
function crawlAwesomeList(org, repo) {
  const extracted = [];
  const readmeUrl = `${GITHUB_API}/${org}/${repo}/main/README.md`;
  
  console.log(`    📋 Crawling awesome-list: ${org}/${repo}`);
  
  const result = spawnSync('curl', [
    '-s', '-L',
    '-H', 'Accept: application/vnd.github+json',
    ...GITHUB_AUTH_HEADERS,
    readmeUrl
  ], { encoding: 'utf8', timeout: 15000 });
  
  if (result.status !== 0 || result.stdout.length < 500) {
    console.log(`    ⚠ Failed to fetch README\n`);
    return extracted;
  }
  
  const content = result.stdout;
  
  // Extract GitHub repo links from markdown: [name](https://github.com/org/repo)
  const githubLinkRegex = /\[([^\]]+)\]\(https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\)/g;
  let match;
  
  while ((match = githubLinkRegex.exec(content)) !== null) {
    const [, name, org, repo] = match;
    const slug = repo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Skip if it looks like the list itself or non-skill repos
    if (repo.includes('awesome') || repo.includes('list') || repo.includes('collection')) {
      continue;
    }
    
    extracted.push({
      name: slug,
      repo: `${org}/${repo}`,
      repoUrl: `https://github.com/${org}/${repo}`,
      org: org,
      source: 'awesome-list',
      listRepo: `${org}/${repo}`
    });
  }
  
  console.log(`    ✓ Extracted ${extracted.length} potential skills from list\n`);
  return extracted;
}

// Utility: Search GitHub for new skill candidates
async function searchGitHubForSkills(installed) {
  const candidates = [];
  const seen = new Set(installed);
  
  console.log('  Searching GitHub for Claude skills...\n');
  
  for (const query of SEARCH_QUERIES) {
    console.log(`  Query: ${query}`);
    
    // Check if this is an awesome-list query - handle differently
    if (query.includes('awesome') || query.includes('-list')) {
      // Search for repos (not code) for list queries
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=5`;
      const result = spawnSync('curl', [
        '-s', '-L',
        '-H', 'Accept: application/vnd.github+json',
        ...GITHUB_AUTH_HEADERS,
        searchUrl
      ], { encoding: 'utf8', timeout: 15000 });
      
      if (result.status === 0) {
        try {
          const data = JSON.parse(result.stdout);
          const items = data.items || [];
          
          for (const item of items) {
            const [org, repoName] = item.full_name.split('/');
            const extracted = crawlAwesomeList(org, repoName);
            
            for (const skill of extracted) {
              if (!seen.has(skill.name) && !candidates.some(c => c.name === skill.name)) {
                // Validate the extracted skill
                const readmeCheck = validateReadmeAsSkill(skill.org, skill.repo.split('/')[1]);
                if (readmeCheck.valid) {
                  candidates.push({
                    ...skill,
                    trust: 'Medium',
                    category: 'development',
                    stars: 0,
                    reason: `From awesome-list: ${skill.listRepo}`,
                    skillMdUrl: readmeCheck.readmeUrl,
                    sourceType: 'readme'
                  });
                  seen.add(skill.name);
                }
              }
            }
          }
        } catch (e) {
          console.log(`  ⚠ Parse failed for: ${query}\n`);
        }
      }
      continue;
    }
    
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
        
        // PRE-VALIDATE: Check if SKILL.md actually exists before adding to queue
        console.log(`    Validating ${slug}...`);
        const skillMdUrl = validateSkillMdExists(org, repoName);
        
        let sourceType = 'skill.md';
        let contentUrl = skillMdUrl;
        
        if (!skillMdUrl) {
          // Fallback: Check README.md for skill-like content
          const readmeCheck = validateReadmeAsSkill(org, repoName);
          
          if (readmeCheck.valid) {
            console.log(`    ⚠ No SKILL.md, but README looks like a skill: ${readmeCheck.reason}`);
            sourceType = 'readme';
            contentUrl = readmeCheck.readmeUrl;
          } else {
            console.log(`    ⚠ No SKILL.md found, ${readmeCheck.reason} — skipping\n`);
            continue;
          }
        } else {
          console.log(`    ✓ SKILL.md confirmed at: ${skillMdUrl}\n`);
        }
        
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
          reason: sourceType === 'readme' 
            ? `README-based skill: ${query}` 
            : `Found via: ${query}`,
          skillMdUrl: contentUrl,  // Store the working URL (SKILL.md or README.md)
          sourceType: sourceType   // Track whether this came from SKILL.md or README
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

// Utility: Security check for skill content
function securityCheck(content, skillName) {
  const dangerousPatterns = [
    { pattern: /\beval\s*\(/gi, name: 'eval() call' },
    { pattern: /\bexec\s*\(/gi, name: 'exec() call' },
    { pattern: /\bFunction\s*\(/gi, name: 'Function() constructor' },
    { pattern: /\bchild_process\b/gi, name: 'child_process import' },
    { pattern: /\bspawn\s*\(/gi, name: 'spawn() call' },
    { pattern: /\brequire\s*\(\s*['"]fs['"]\s*\)/gi, name: 'fs module import' },
    { pattern: /API_KEY\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi, name: 'hardcoded API key' },
    { pattern: /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi, name: 'hardcoded api_key' },
    { pattern: /secret\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi, name: 'hardcoded secret' },
    { pattern: /https?:\/\/(?!raw\.githubusercontent\.com|github\.com|api\.github\.com)[^\s'"]+/gi, name: 'request to unknown domain' },
  ];
  
  const issues = [];
  
  for (const { pattern, name } of dangerousPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      issues.push(`${name} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    }
  }
  
  if (issues.length > 0) {
    console.log(`  ⚠ Security check failed: ${issues.join(', ')}`);
    return false;
  }
  
  console.log(`  ✓ Security check passed`);
  return true;
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
    
    // Fetch SKILL.md using the pre-validated URL
    console.log(`\n  📥 Fetching SKILL.md...`);
    let skillContent = null;
    
    // Use the stored skillMdUrl if available, otherwise try fallback patterns
    const urlsToTry = skill.skillMdUrl 
      ? [skill.skillMdUrl]
      : [
          `${GITHUB_API}/${org}/${repo}/master/${slug}/SKILL.md`,
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
    
    // Sanitize MDX for compatibility
    console.log(`  🧹 Sanitizing MDX...`);
    const sanitizeResult = runCmd(`bash ~/.openclaw/workspace/skills/sanitize-mdx.sh "${outputPath}"`);
    if (sanitizeResult.status !== 0) {
      console.log(`  ⚠ Sanitization warning: ${sanitizeResult.stderr}\n`);
    }
    
    // Security check before committing
    console.log(`  🔒 Running security check...`);
    
    // Relaxed security for README-sourced skills (they're documentation-heavy)
    const isReadmeSource = skill.sourceType === 'readme';
    if (isReadmeSource) {
      console.log(`  ℹ️  README-sourced skill — using relaxed security check`);
      // For README sources, just check for obvious dangerous patterns (eval, exec, hardcoded keys)
      const criticalPatterns = [
        /\beval\s*\(/gi,
        /\bexec\s*\(/gi,
        /API_KEY\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi,
        /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi,
      ];
      const criticalIssues = [];
      for (const { pattern, name } of criticalPatterns.map(p => ({ pattern: p, name: 'critical' }))) {
        if (pattern.test(output)) {
          criticalIssues.push('critical pattern');
        }
      }
      if (criticalIssues.length > 0) {
        console.log(`  ⚠ Critical security issue found, skipping\n`);
        fs.unlinkSync(outputPath);
        continue;
      }
      console.log(`  ✓ Relaxed security check passed\n`);
    } else {
      if (!securityCheck(output, skillName)) {
        console.log(`  ⚠ Security check failed, removing file and skipping\n`);
        fs.unlinkSync(outputPath);
        continue;
      }
    }
    
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
    
    // Send Discord notification using OpenClaw message tool
    console.log(`  🔔 Sending Discord notification...`);
    const discordMsg = `New skill published: ${skillName} — https://skills.pawgrammer.com/skills/${slug}`;
    const discordResult = runCmd(`openclaw message send --channel discord --target 1485568635572457654 --message "${discordMsg.replace(/"/g, '\\"')}"`);
    
    if (discordResult.status === 0) {
      console.log(`  ✓ Discord notification sent\n`);
    } else {
      console.log(`  ⚠ Discord notification failed: ${discordResult.stderr?.slice(0, 100) || 'unknown error'}\n`);
    }
    
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
