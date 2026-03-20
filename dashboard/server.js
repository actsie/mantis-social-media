#!/usr/bin/env node

/**
 * Simple static server for dashboard
 * Also regenerates data.json on each request
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const { collectAll } = require('./data/collector')

const PORT = 8765
const DASHBOARD_DIR = __dirname
const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace'

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
}

const CHANGELOG_PATH = path.join(DASHBOARD_DIR, 'changelog.json')

function logChangelog(entry) {
  let changelog = { entries: [], today_summary: null }
  try {
    if (fs.existsSync(CHANGELOG_PATH)) {
      changelog = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to read changelog:', e.message)
  }
  
  const now = new Date()
  const nowPHT = new Date(now.getTime() + (8 * 60 * 60 * 1000)) // UTC+8
  const nowPT = new Date(now.getTime() - (7 * 60 * 60 * 1000)) // UTC-7 (PDT)
  
  const newEntry = {
    ...entry,
    id: entry.id || `entry-${Date.now()}`,
    date: entry.date || now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
  }
  
  changelog.entries.unshift(newEntry)
  
  // Auto-generate today summary (resets at midnight PHT)
  const todayPHT = nowPHT.toISOString().split('T')[0]
  const todayPT = nowPT.toISOString().split('T')[0]
  
  function toPHTDate(ts) {
    if (!ts) return null
    const d = typeof ts === 'string' ? new Date(ts) : ts
    if (isNaN(d.getTime())) return null
    return new Date(d.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0]
  }
  
  // Filter entries by PHT "today" (resets at midnight PHT)
  const todaysEntries = changelog.entries.filter(e => {
    const phtDate = toPHTDate(e.timestamp) || toPHTDate(e.date)
    return phtDate === todayPHT
  })
  
  const counts = { new: 0, changed: 0, fixed: 0, archived: 0 }
  todaysEntries.forEach(e => {
    if (counts[e.type] !== undefined) counts[e.type]++
  })
  
  const total = todaysEntries.length
  const latest = todaysEntries.length > 0 ? todaysEntries[0].title : null
  const entryIds = todaysEntries.map(e => e.id).filter(Boolean)
  
  changelog.today_summary = {
    date_pht: todayPHT,
    date_pt: todayPT,
    counts,
    total,
    latest,
    entries_today: entryIds,
    generated_at: now.toISOString(),
  }
  
  try {
    fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(changelog, null, 2))
    console.log(`Changelog: ${entry.type} - ${entry.title} (Today PHT: ${total} changes)`)
  } catch (e) {
    console.error('Failed to write changelog:', e.message)
  }
}

const server = http.createServer((req, res) => {
  // Handle feedback POST endpoint
  if (req.url.startsWith('/feedback') && req.method === 'POST') {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const draftId = url.searchParams.get('draftId')
    const platform = url.searchParams.get('platform')
    const approved = url.searchParams.get('approved') === 'true'
    const reason = url.searchParams.get('reason') || ''
    
    console.log(`Feedback: ${draftId} (${platform}) - ${approved ? 'APPROVED' : 'REJECTED'}${reason ? ' - ' + reason : ''}`)
    
    // X approval queue handling
    if (platform === 'x') {
      const queuePath = path.join(__dirname, '..', 'outreach', 'x', 'approval-queue.json')
      try {
        const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'))
        const entry = queue.entries.find(e => e.id === draftId)
        if (entry) {
          if (approved) {
            entry.status = 'approved'
            entry.approved_at = new Date().toISOString()
            console.log(`  ✓ Approval queue updated: ${draftId} → approved`)
          } else {
            entry.status = 'rejected'
            entry.rejected_at = new Date().toISOString()
            entry.rejection_reason = reason
            console.log(`  ✓ Approval queue updated: ${draftId} → rejected`)
          }
          fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2))
        }
      } catch (e) {
        console.error(`  ✗ Failed to update approval queue: ${e.message}`)
      }
    }
    
    const { recordFeedback } = require('./data/feedback-store')
    recordFeedback(draftId, platform, approved, reason, '')
    
    // Auto-log to changelog
    logChangelog({
      type: approved ? 'changed' : 'fixed',
      title: `${approved ? 'Approved' : 'Rejected'} ${platform.toUpperCase()} draft`,
      description: approved 
        ? `Draft "${draftId}" approved for posting` 
        : `Draft "${draftId}" rejected: ${reason}`,
      file: `outreach/${platform}/drafts/`
    })
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
    return
  }
  
  // Handle edit-draft endpoint
  if (req.url === '/edit-draft' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      try {
        const { draftId, platform, editedContent } = JSON.parse(body)
        
        console.log(`Edit draft: ${draftId} (${platform})`)
        
        // Read approval queue
        const queuePath = path.join(__dirname, 'outreach', 'x', 'approval-queue.json')
        const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'))
        const entry = queue.entries.find(e => e.id === draftId)
        
        if (!entry) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Draft not found' }))
          return
        }
        
        // Capture diff
        const originalContent = entry.content
        const diffSummary = originalContent.length > editedContent.length ? 'shortened' : 'expanded'
        
        // Update entry
        entry.original_content = originalContent
        entry.content = editedContent
        entry.status = 'approved'
        entry.edited = true
        entry.edited_at = new Date().toISOString()
        entry.approved_at = new Date().toISOString()
        
        // Write back to queue
        fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2))
        console.log(`  ✓ Approval queue updated: ${draftId} → edited & approved`)
        
        // Log learning to feedback-store
        const { recordEdit } = require('./data/feedback-store')
        recordEdit(draftId, platform, originalContent, editedContent)
        
        // Log to changelog
        logChangelog({
          type: 'changed',
          title: 'X draft edited before approval',
          description: `Original: "${originalContent.slice(0, 80)}${originalContent.length > 80 ? '...' : ''}" → Edited: "${editedContent.slice(0, 80)}${editedContent.length > 80 ? '...' : ''}"`,
          file: `outreach/${platform}/approval-queue.json`
        })
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, diffSummary }))
      } catch (e) {
        console.error('Edit draft error:', e.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }
  
  // Handle GET /api/summaries/latest
  if (req.url === '/api/summaries/latest' && req.method === 'GET') {
    const summariesDir = path.join(WORKSPACE, 'dashboard', 'data', 'summaries')
    const platforms = ['x', 'instagram', 'reddit', 'engagement']
    const result = {}
    
    for (const platform of platforms) {
      const platformDir = path.join(summariesDir, platform)
      try {
        if (fs.existsSync(platformDir)) {
          const files = fs.readdirSync(platformDir)
            .filter(f => f.endsWith('.json'))
            .sort()
          if (files.length > 0) {
            const latestFile = files[files.length - 1]
            const filePath = path.join(platformDir, latestFile)
            result[platform] = JSON.parse(fs.readFileSync(filePath, 'utf8'))
          } else {
            result[platform] = null
          }
        } else {
          result[platform] = null
        }
      } catch (e) {
        console.error(`Failed to read ${platform} summary:`, e.message)
        result[platform] = null
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }
  
  // Handle cron control endpoints
  if (req.url.startsWith('/cron/') && req.method === 'POST') {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const parts = req.url.split('/')
    const cronId = parts[2]
    const action = parts[3]
    
    console.log(`Cron ${action}: ${cronId}`)
    
    try {
      const { execSync } = require('child_process')
      let cmd
      
      if (action === 'run') {
        cmd = `openclaw cron run ${cronId}`
      } else if (action === 'enable') {
        cmd = `openclaw cron enable ${cronId}`
      } else if (action === 'disable') {
        cmd = `openclaw cron disable ${cronId}`
      }
      
      if (cmd) {
        execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      }
      
      // Auto-log to changelog
      logChangelog({
        type: action === 'run' ? 'changed' : 'changed',
        title: `Cron ${action}: ${cronId}`,
        description: `Cron job ${cronId} ${action}ed via dashboard`,
        file: `dashboard/server.js`
      })
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, action }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: e.message }))
    }
    return
  }
  
  // Handle changelog endpoint
  if (req.url.startsWith('/api/changelog') && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      try {
        const entry = JSON.parse(body)
        logChangelog(entry)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: e.message }))
      }
    })
    return
  }
  
  // Handle promote learning to doc (must come before general /api/learning route)
  if (req.url.startsWith('/api/learning/') && req.url.endsWith('/promote') && req.method === 'POST') {
    const learningId = req.url.split('/')[3]
    
    try {
      const { loadStore, saveStore } = require('./data/feedback-store')
      const store = loadStore()
      const learning = store.learnings.find(l => l.id === learningId)
      
      if (!learning) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Learning not found' }))
        return
      }
      
      // Create doc from learning
      const docsPath = path.join(DASHBOARD_DIR, 'docs.json')
      let docs = { docs: [] }
      try {
        if (fs.existsSync(docsPath)) {
          docs = JSON.parse(fs.readFileSync(docsPath, 'utf8'))
        }
      } catch (e) {}
      
      const doc = {
        id: `doc-${Date.now()}`,
        title: learning.title || 'System Learning',
        content: learning.description,
        type: learning.type,
        sourceLearning: learningId,
        platform: learning.platform,
        createdAt: new Date().toISOString(),
      }
      
      docs.docs.unshift(doc)
      fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2))
      
      // Mark learning as promoted
      learning.promotedToDoc = doc.id
      saveStore(store)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, doc }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: e.message }))
    }
    return
  }
  
  // Handle learning endpoint (system/experiment)
  if (req.url.startsWith('/api/learning') && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      try {
        const learning = JSON.parse(body)
        const { recordSystemLearning } = require('./data/feedback-store')
        const result = recordSystemLearning(
          learning.type,
          learning.title,
          learning.description,
          learning.outcome,
          learning.verdict,
          learning.platform
        )
        
        // Also log to changelog
        logChangelog({
          type: learning.type === 'system' ? 'changed' : 'new',
          title: `Learning: ${learning.title}`,
          description: learning.description,
          file: 'dashboard/learnings'
        })
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, learning: result }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: e.message }))
      }
    })
    return
  }
  
  // Strip query string from URL for file path
  const cleanUrl = req.url.split('?')[0];
  let filePath = path.join(DASHBOARD_DIR, cleanUrl === '/' ? 'index.html' : cleanUrl)
  
  // Handle data.json - regenerate on each request
  if (req.url === '/data.json') {
    console.log('Regenerating data.json...')
    const data = collectAll()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data, null, 2))
    return
  }
  
  const ext = path.extname(filePath)
  const contentType = mimeTypes[ext] || 'application/octet-stream'
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404)
        res.end('File not found: ' + req.url)
      } else {
        res.writeHead(500)
        res.end('Server error: ' + err.code)
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  // Get local IP
  const os = require('os')
  const interfaces = os.networkInterfaces()
  let localIp = 'localhost'
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address
        break
      }
    }
  }
  
  console.log(``)
  console.log(`🦀 Mantis Claw Dashboard running at:`)
  console.log(`   Local:   http://localhost:${PORT}`)
  console.log(`   Network: http://${localIp}:${PORT}`)
  console.log(``)
  console.log(`Data regenerates on each request.`)
  console.log(`Press Ctrl+C to stop.`)
  console.log(``)
})
