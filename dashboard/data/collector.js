#!/usr/bin/env node

/**
 * Data Collector for Mantis Claw Dashboard
 * 
 * Gathers normalized data from workspace files, cron logs, and system state.
 * Outputs JSON for dashboard consumption.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace'

function collectDailySummary() {
  const today = new Date().toISOString().split('T')[0]
  const todayPST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  
  // Count heartbeats from memory files
  const memoryDir = path.join(WORKSPACE, 'memory')
  let heartbeats = 0
  try {
    const todayFile = path.join(memoryDir, `${today}.md`)
    if (fs.existsSync(todayFile)) {
      const content = fs.readFileSync(todayFile, 'utf8')
      heartbeats = (content.match(/HEARTBEAT/g) || []).length
    }
  } catch (e) {
    // memory dir may not exist
  }
  
  // Count cron runs and failures from logs
  let cronRuns = 0
  let failures = 0
  const cronLogPath = path.join(WORKSPACE, 'cron.log')
  if (fs.existsSync(cronLogPath)) {
    const content = fs.readFileSync(cronLogPath, 'utf8')
    const todayLines = content.split('\n').filter(line => line.startsWith(today))
    cronRuns = todayLines.length
    failures = todayLines.filter(line => line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')).length
  }
  
  // Count files changed today
  const filesChanged = collectFileChanges().filter(f => f.modifiedAt.startsWith(today)).length
  
  // Count drafts pending
  const drafts = collectDrafts()
  const postsDrafted = drafts.length
  const approvalsPending = drafts.filter(d => d.status === 'pending').length
  
  // Count active agents
  const agents = collectAgents()
  const agentsActive = agents.filter(a => a.status === 'active').length
  
  // === NEW: Platform Stats ===
  const platformStats = collectPlatformStats(today)
  
  // === NEW: Today's Activity ===
  const todayActivity = collectTodayActivity(today)
  
  // === NEW: System Health ===
  const systemHealth = collectSystemHealth()
  
  return {
    date: today,
    heartbeats,
    cronRuns,
    filesChanged,
    postsDrafted,
    approvalsPending,
    agentsActive,
    failures,
    platformStats,
    todayActivity,
    systemHealth,
    lastReviewResult: undefined,
  }
}

function collectPlatformStats(today) {
  // Instagram followers
  let igFollowers = { count: 0, delta: 0 }
  try {
    const igFollowerState = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'outreach/instagram/follower-state.json'), 'utf8'))
    igFollowers.count = igFollowerState.lastCount || 0
    // Find yesterday's count for delta
    const history = igFollowerState.history || []
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const yesterdayEntry = history.find(h => h.timestamp.startsWith(yesterdayStr))
    if (yesterdayEntry) {
      igFollowers.delta = igFollowers.count - yesterdayEntry.count
    }
  } catch (e) {}
  
  // X followers
  let xFollowers = { count: 0, delta: 0 }
  try {
    const xFollowerState = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'outreach/x/follower-state.json'), 'utf8'))
    xFollowers.count = xFollowerState.lastCount || 0
    const history = xFollowerState.history || []
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const yesterdayEntry = history.find(h => h.timestamp.startsWith(yesterdayStr))
    if (yesterdayEntry) {
      xFollowers.delta = xFollowers.count - yesterdayEntry.count
    }
  } catch (e) {}
  
  // Reddit karma
  let redditKarma = { total: 0, delta: 0 }
  try {
    const redditLog = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'outreach/reddit/engagement-log.json'), 'utf8'))
    const karmaChecks = redditLog.karma_checks || []
    if (karmaChecks.length > 0) {
      const latest = karmaChecks[karmaChecks.length - 1]
      redditKarma.total = latest.total_karma || 0
      if (karmaChecks.length > 1) {
        const prev = karmaChecks[karmaChecks.length - 2]
        redditKarma.delta = redditKarma.total - (prev.total_karma || 0)
      }
    }
  } catch (e) {}
  
  return { igFollowers, xFollowers, redditKarma }
}

function collectTodayActivity(today) {
  let sessionsRun = 0
  let commentsPosted = 0
  let postsSent = 0
  
  // Instagram sessions today
  try {
    const igLog = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'outreach/instagram/engagement-log.json'), 'utf8'))
    const todaySessions = (igLog.sessions || []).filter(s => s.timestamp && s.timestamp.startsWith(today))
    sessionsRun += todaySessions.length
    commentsPosted += todaySessions.filter(s => s.type === 'comment' || s.type === 'comment-attempted-ui-issue').length
  } catch (e) {}
  
  // X sessions today
  try {
    const xLog = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'outreach/x/engagement-log.json'), 'utf8'))
    const todaySessions = (xLog.sessions || []).filter(s => s.timestamp && s.timestamp.startsWith(today))
    sessionsRun += todaySessions.length
    commentsPosted += todaySessions.filter(s => s.type === 'indie-hacker' && s.replyText).length
    postsSent += todaySessions.filter(s => s.type === 'original-post').length
  } catch (e) {}
  
  // Reddit sessions today
  try {
    const redditLog = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'outreach/reddit/engagement-log.json'), 'utf8'))
    const todaySessions = (redditLog.sessions || []).filter(s => s.timestamp && s.timestamp.startsWith(today))
    sessionsRun += todaySessions.length
    commentsPosted += todaySessions.filter(s => s.type === 'comment' || !s.type).length
    postsSent += todaySessions.filter(s => s.type === 'post').length
  } catch (e) {}
  
  return { sessionsRun, commentsPosted, postsSent }
}

function collectSystemHealth() {
  let cronsActive = 0
  let failuresToday = 0
  let pendingApproval = 0
  
  // Active crons
  try {
    const output = execSync('openclaw cron list --json 2>&1', { encoding: 'utf8' })
    const json = JSON.parse(output)
    const jobList = Array.isArray(json) ? json : (json.jobs || [])
    cronsActive = jobList.filter(j => j.enabled !== false).length
    const today = new Date().toISOString().split('T')[0]
    failuresToday = jobList.filter(j => {
      const lastRun = j.state?.lastRunAtMs
      if (!lastRun) return false
      const lastRunDate = new Date(lastRun).toISOString().split('T')[0]
      return lastRunDate === today && j.state?.lastRunStatus === 'error'
    }).length
  } catch (e) {}
  
  // Pending approvals (X only - read from approval queue)
  try {
    const queuePath = path.join(WORKSPACE, 'outreach/x/approval-queue.json')
    if (fs.existsSync(queuePath)) {
      const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'))
      pendingApproval = (queue.pending || []).length
    }
  } catch (e) {
    pendingApproval = 0  // File doesn't exist yet
  }
  
  return { cronsActive, failuresToday, pendingApproval }
}

function collectCronJobs() {
  try {
    const output = execSync('openclaw cron list --json 2>&1', { encoding: 'utf8' })
    const json = JSON.parse(output)
    const jobList = Array.isArray(json) ? json : (json.jobs || [])
    
    return jobList.map(j => ({
      id: j.id || 'unknown',
      shortId: j.id?.substring(0, 8) || 'unknown',
      name: j.name || 'Unknown',
      schedule: j.schedule?.expr || j.schedule?.cron || '-',
      nextRun: j.nextRun || '-',
      lastRun: j.lastRun || '-',
      status: j.enabled === false ? 'disabled' : 'enabled',
      enabled: j.enabled !== false,
    }))
  } catch (e) {
    console.error('Failed to fetch cron jobs:', e.message)
    return []
  }
}

function collectFileChanges() {
  const changes = []
  
  function scanDir(dir, relativePath = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        if (entry.name === 'node_modules') continue
        if (entry.name === 'dashboard') continue
        
        const fullPath = path.join(dir, entry.name)
        const relPath = path.join(relativePath, entry.name)
        
        if (entry.isDirectory()) {
          scanDir(fullPath, relPath)
        } else {
          const stat = fs.statSync(fullPath)
          const modifiedAt = stat.mtime.toISOString()
          const hoursAgo = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60)
          
          if (hoursAgo < 24) {
            changes.push({
              path: relPath,
              modifiedAt,
              type: 'modify',
              source: 'unknown',
            })
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
  
  scanDir(WORKSPACE)
  return changes.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
}

function collectDrafts() {
  const drafts = []
  
  // Check all platform draft directories
  const platforms = ['x', 'instagram', 'reddit']
  
  for (const platform of platforms) {
    const draftsDir = path.join(WORKSPACE, 'outreach', platform, 'drafts')
    if (fs.existsSync(draftsDir)) {
      const files = fs.readdirSync(draftsDir)
      for (const file of files) {
        if (file.endsWith('-draft.txt') || file.endsWith('-humanized.txt')) {
          const content = fs.readFileSync(path.join(draftsDir, file), 'utf8')
          drafts.push({
            id: file.replace(/-draft.txt|-humanized.txt/, ''),
            content,
            platform,
            status: 'pending',
            createdAt: new Date().toISOString(),
          })
        }
      }
    }
  }
  
  return drafts
}

function collectMemory() {
  const memory = {
    main: null,
    daily: [],
    identity: null,
    soul: null,
  }
  
  const memoryPath = path.join(WORKSPACE, 'MEMORY.md')
  if (fs.existsSync(memoryPath)) {
    memory.main = fs.readFileSync(memoryPath, 'utf8')
  }
  
  const memoryDir = path.join(WORKSPACE, 'memory')
  if (fs.existsSync(memoryDir)) {
    const files = fs.readdirSync(memoryDir).sort().reverse().slice(0, 7)
    for (const file of files) {
      if (file.endsWith('.md')) {
        memory.daily.push({
          file,
          content: fs.readFileSync(path.join(memoryDir, file), 'utf8'),
        })
      }
    }
  }
  
  const identityPath = path.join(WORKSPACE, 'IDENTITY.md')
  if (fs.existsSync(identityPath)) {
    memory.identity = fs.readFileSync(identityPath, 'utf8')
  }
  
  const soulPath = path.join(WORKSPACE, 'SOUL.md')
  if (fs.existsSync(soulPath)) {
    memory.soul = fs.readFileSync(soulPath, 'utf8')
  }
  
  return memory
}

function collectAgents() {
  const agents = []
  
  try {
    const output = execSync('openclaw sessions list --limit 20 2>&1', { encoding: 'utf8' })
    
    try {
      const json = JSON.parse(output)
      const sessions = Array.isArray(json) ? json : (json.sessions || [])
      
      for (const s of sessions) {
        agents.push({
          id: s.id?.substring(0, 8) || 'unknown',
          name: s.label || s.name || 'Unnamed',
          status: s.status || 'unknown',
          task: s.task || s.lastMessage?.substring(0, 50) || undefined,
          recentActivity: [],
          linkedMission: undefined,
        })
      }
    } catch (e) {
      // Parse table output if not JSON
    }
  } catch (e) {
    console.error('Failed to fetch agents:', e.message)
  }
  
  return agents
}

function collectLearnings() {
  try {
    const { getLearnings, getFeedback, getStats, loadStore } = require('./feedback-store')
    const store = loadStore()
    
    return {
      recent: getLearnings(null, 50), // Include all types
      all: store.learnings || [],
      feedback: getFeedback(null, 20),
      stats: getStats(),
    }
  } catch (e) {
    return { recent: [], all: [], feedback: [], stats: { total: 0, approved: 0, rejected: 0 } }
  }
}

function collectDocs() {
  const docsPath = path.join(WORKSPACE, 'dashboard', 'docs.json')
  try {
    if (fs.existsSync(docsPath)) {
      return JSON.parse(fs.readFileSync(docsPath, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to read docs:', e.message)
  }
  return { docs: [] }
}

function collectSprints() {
  const sprintPath = path.join(WORKSPACE, 'dashboard/sprints.json')
  try {
    if (fs.existsSync(sprintPath)) {
      return JSON.parse(fs.readFileSync(sprintPath, 'utf8'))
    }
  } catch (e) {
    // ignore
  }
  return []
}

function collectMissions() {
  // Read missions from missions.json or derive from sprints
  const missionsPath = path.join(WORKSPACE, 'dashboard/missions.json')
  try {
    if (fs.existsSync(missionsPath)) {
      return JSON.parse(fs.readFileSync(missionsPath, 'utf8'))
    }
  } catch (e) {
    // ignore
  }
  
  // Derive missions from sprint tasks
  const sprints = collectSprints()
  const missions = []
  for (const sprint of sprints) {
    if (sprint.tasks) {
      for (const task of sprint.tasks) {
        missions.push({
          id: task.id,
          title: task.title,
          status: task.status === 'done' ? 'completed' : task.status === 'in_progress' ? 'active' : task.status === 'blocked' ? 'blocked' : 'active',
          agent: task.assignee || null,
          priority: task.priority || 'medium',
          sprint: sprint.name,
          updatedAt: task.completedAt || new Date().toISOString(),
        })
      }
    }
  }
  return missions
}

function collectFileDiffs() {
  const diffs = []
  
  try {
    const statusOutput = execSync('git status --porcelain 2>&1', { 
      encoding: 'utf8',
      cwd: WORKSPACE,
      stdio: ['pipe', 'pipe', 'ignore']
    })
    
    const modifiedFiles = statusOutput
      .split('\n')
      .filter(line => line.startsWith(' M') || line.startsWith('M ') || line.startsWith('??'))
      .map(line => line.substring(3).trim())
      .filter(f => f && !f.includes('node_modules'))
    
    for (const file of modifiedFiles.slice(0, 10)) {
      try {
        const diffOutput = execSync(`git diff ${file} 2>&1`, {
          encoding: 'utf8',
          cwd: WORKSPACE,
          stdio: ['pipe', 'pipe', 'ignore']
        })
        
        const lines = diffOutput.split('\n')
        const added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length
        const deleted = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length
        
        if (added > 0 || deleted > 0) {
          diffs.push({
            path: file,
            added,
            deleted,
            preview: lines.slice(0, 20).join('\n'),
          })
        }
      } catch (e) {
        // File might not be tracked
      }
    }
  } catch (e) {
    // Not a git repo or git not available
  }
  
  return diffs
}

function collectApprovalQueue() {
  const queuePath = path.join(WORKSPACE, 'outreach/x/approval-queue.json')
  try {
    if (fs.existsSync(queuePath)) {
      return JSON.parse(fs.readFileSync(queuePath, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to read approval queue:', e.message)
  }
  return { entries: [] }
}

function collectAll() {
  return {
    collectedAt: new Date().toISOString(),
    dailySummary: collectDailySummary(),
    cronJobs: collectCronJobs(),
    fileChanges: collectFileChanges(),
    drafts: collectDrafts(),
    approvalQueue: collectApprovalQueue(),
    memory: collectMemory(),
    agents: collectAgents(),
    learnings: collectLearnings(),
    sprints: collectSprints(),
    fileDiffs: collectFileDiffs(),
    missions: collectMissions(),
    changelog: collectChangelog(),
    docs: collectDocs(),
  }
}

function collectChangelog() {
  const changelogPath = path.join(WORKSPACE, 'dashboard', 'changelog.json')
  try {
    if (fs.existsSync(changelogPath)) {
      return JSON.parse(fs.readFileSync(changelogPath, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to read changelog:', e.message)
  }
  return { entries: [] }
}

if (require.main === module) {
  const data = collectAll()
  console.log(JSON.stringify(data, null, 2))
}

module.exports = { collectAll }
