#!/usr/bin/env node

/**
 * Nightly Self-Review Cron
 * 
 * Runs every night at 11:30pm PST to:
 * - Review rejected drafts from the day
 * - Review corrections and misses
 * - Summarize the day's activity
 * - Write learnings to MEMORY.md
 * - Update docs/conclusions
 * - Flag recurring problems
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const WORKSPACE = '/Users/mantisclaw/.openclaw/workspace'
const DASHBOARD = path.join(WORKSPACE, 'dashboard')

// Load feedback store
const { getFeedback, getLearnings, saveStore, loadStore } = require('./data/feedback-store')

function main() {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  
  console.log(`🦀 Nightly Review — ${today}`)
  console.log('')
  
  // Get today's feedback
  const feedback = getFeedback(null, 100)
  const todayFeedback = feedback.filter(f => f.timestamp.startsWith(today))
  const rejectedToday = todayFeedback.filter(f => !f.approved)
  
  console.log(`Today's activity:`)
  console.log(`  - Total feedback: ${todayFeedback.length}`)
  console.log(`  - Approved: ${todayFeedback.filter(f => f.approved).length}`)
  console.log(`  - Rejected: ${rejectedToday.length}`)
  console.log('')
  
  // Analyze rejection patterns
  const patterns = {}
  for (const f of rejectedToday) {
    const reason = f.reason.toLowerCase()
    
    // Categorize
    if (reason.includes('tone') || reason.includes('voice')) patterns.tone = (patterns.tone || 0) + 1
    if (reason.includes('time') || reason.includes('schedule')) patterns.timing = (patterns.timing || 0) + 1
    if (reason.includes('wrong') || reason.includes('incorrect')) patterns.accuracy = (patterns.accuracy || 0) + 1
    if (reason.includes('approach') || reason.includes('strategy')) patterns.strategy = (patterns.strategy || 0) + 1
    patterns.other = (patterns.other || 0) + 1
  }
  
  if (Object.keys(patterns).length > 0) {
    console.log('Rejection patterns:')
    for (const [category, count] of Object.entries(patterns)) {
      console.log(`  - ${category}: ${count}`)
    }
    console.log('')
  }
  
  // Generate daily summary
  const summary = {
    date: today,
    feedback: todayFeedback.length,
    approved: todayFeedback.filter(f => f.approved).length,
    rejected: rejectedToday.length,
    patterns,
    topRejectionReasons: rejectedToday.slice(0, 5).map(f => f.reason),
  }
  
  // Save summary
  const summariesDir = path.join(DASHBOARD, 'summaries')
  if (!fs.existsSync(summariesDir)) {
    fs.mkdirSync(summariesDir, { recursive: true })
  }
  
  const summaryPath = path.join(summariesDir, `${today}.json`)
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  console.log(`Summary saved to: ${summaryPath}`)
  
  // Append to daily memory if there were rejections
  if (rejectedToday.length > 0) {
    const memoryDir = path.join(WORKSPACE, 'memory')
    const memoryFile = path.join(memoryDir, `${today}.md`)
    
    let content = ''
    if (fs.existsSync(memoryFile)) {
      content = fs.readFileSync(memoryFile, 'utf8')
    }
    
    const reviewSection = `
## Nightly Review (${new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles' })})

**Feedback today:** ${todayFeedback.length} total, ${rejectedToday.length} rejected

**Patterns detected:**
${Object.entries(patterns).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'None'}

**Top rejection reasons:**
${rejectedToday.slice(0, 5).map(f => `- ${f.reason}`).join('\n') || 'None'}

**Action items:**
${rejectedToday.length > 3 ? '- Review tone guide — multiple rejections for tone issues' : '- No major issues detected'}
`
    
    content += reviewSection
    fs.writeFileSync(memoryFile, content)
    console.log(`Review appended to: ${memoryFile}`)
  }
  
  // Check for recurring problems (content-type learnings only)
  const allLearnings = getLearnings(null, 50)
  const recurringIssues = {}
  
  // Only count content-type learnings (system/experiment don't have categories)
  const contentLearnings = allLearnings.filter(l => l.type === 'content' || !l.type)
  
  for (const l of contentLearnings) {
    const key = l.category || 'uncategorized'
    recurringIssues[key] = (recurringIssues[key] || 0) + 1
  }
  
  const flagged = Object.entries(recurringIssues).filter(([_, count]) => count >= 3)
  if (flagged.length > 0) {
    console.log('')
    console.log('⚠️  Recurring issues (3+ occurrences):')
    for (const [issue, count] of flagged) {
      console.log(`  - ${issue}: ${count} times`)
    }
  }
  
  console.log('')
  console.log('✅ Nightly review complete')
}

main()
