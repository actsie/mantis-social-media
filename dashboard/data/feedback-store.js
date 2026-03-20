#!/usr/bin/env node

/**
 * Feedback Store - Persists approval/rejection feedback
 * Stores learnings from rejected drafts for future improvement
 */

const fs = require('fs')
const path = require('path')

const STORE_PATH = path.join(__dirname, '../feedback-store.json')

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load feedback store:', e.message)
  }
  return { learnings: [], feedback: [] }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

/**
 * Record feedback for a draft (content learning)
 * @param {string} draftId - Draft identifier
 * @param {string} platform - x|instagram|reddit
 * @param {boolean} approved - Whether approved
 * @param {string} reason - Rejection reason (if rejected)
 * @param {string} content - Draft content
 */
function recordFeedback(draftId, platform, approved, reason, content) {
  const store = loadStore()
  
  const feedback = {
    id: `fb-${Date.now()}`,
    draftId,
    platform,
    approved,
    reason: reason || null,
    content,
    timestamp: new Date().toISOString(),
  }
  
  store.feedback.push(feedback)
  
  // If rejected, create a content learning
  if (!approved && reason) {
    const learning = {
      id: `learn-${Date.now()}`,
      type: 'content',
      source: 'rejection',
      note: reason,
      category: categorizeReason(reason),
      linkedId: draftId,
      platform,
      createdAt: new Date().toISOString(),
      applied: false,
    }
    store.learnings.push(learning)
  }
  
  saveStore(store)
  return feedback
}

/**
 * Record an edit learning (captures diff between original and edited content)
 * @param {string} draftId - Draft identifier
 * @param {string} platform - x|instagram|reddit
 * @param {string} original - Original content before edit
 * @param {string} edited - Edited content after user modification
 */
function recordEdit(draftId, platform, original, edited) {
  const store = loadStore()
  
  const diffSummary = original.length > edited.length ? 'shortened' : 'expanded'
  
  const learning = {
    id: `learn-${Date.now()}`,
    type: 'content',
    source: 'edit',
    draftId,
    platform,
    original,
    edited,
    diff_summary: `${diffSummary} — original ${original.length} chars, edited ${edited.length} chars`,
    note: 'User edited draft before approving',
    category: 'tone',
    createdAt: new Date().toISOString(),
    applied: false,
  }
  
  store.learnings.push(learning)
  saveStore(store)
  return learning
}

/**
 * Record a system or experiment learning
 * @param {string} type - 'system' | 'experiment'
 * @param {string} title - Short title
 * @param {string} description - What happened / what was tried
 * @param {string} outcome - 'success' | 'failure' | 'mixed' (for experiments)
 * @param {string} verdict - 'keep' | 'archive' | 'retry' | 'shelved' (for experiments)
 * @param {string} platform - 'instagram' | 'x' | 'reddit' | 'dashboard' | 'general'
 */
function recordSystemLearning(type, title, description, outcome, verdict, platform) {
  const store = loadStore()
  
  const learning = {
    id: `learn-${Date.now()}`,
    type,
    title,
    description,
    outcome: outcome || null,
    verdict: verdict || null,
    platform: platform || 'general',
    createdAt: new Date().toISOString(),
    applied: false,
    promotedToDoc: null,
  }
  
  store.learnings.push(learning)
  saveStore(store)
  return learning
}

/**
 * Categorize rejection reason
 */
function categorizeReason(reason) {
  const r = reason.toLowerCase()
  if (r.includes('tone') || r.includes('voice') || r.includes('sound')) return 'tone'
  if (r.includes('time') || r.includes('schedule') || r.includes('when')) return 'timing'
  if (r.includes('wrong') || r.includes('incorrect') || r.includes('fact')) return 'accuracy'
  if (r.includes('approach') || r.includes('strategy') || r.includes('angle')) return 'strategy'
  return 'other'
}

/**
 * Get recent learnings for a platform
 */
function getLearnings(platform, limit = 10) {
  const store = loadStore()
  return store.learnings
    .filter(l => !platform || l.linkedId?.startsWith(platform))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
}

/**
 * Get feedback history
 */
function getFeedback(platform, limit = 20) {
  const store = loadStore()
  return store.feedback
    .filter(f => !platform || f.platform === platform)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
}

/**
 * Get stats
 */
function getStats() {
  const store = loadStore()
  const total = store.feedback.length
  const approved = store.feedback.filter(f => f.approved).length
  const rejected = total - approved
  const rejectionRate = total > 0 ? (rejected / total * 100).toFixed(1) : 0
  
  // Category breakdown
  const byCategory = {}
  for (const l of store.learnings) {
    byCategory[l.category] = (byCategory[l.category] || 0) + 1
  }
  
  return {
    total,
    approved,
    rejected,
    rejectionRate: `${rejectionRate}%`,
    byCategory,
    learningsCount: store.learnings.length,
  }
}

// CLI interface
if (require.main === module) {
  const [,, action, ...args] = process.argv
  
  switch (action) {
    case 'record':
      const [draftId, platform, approved, ...reasonParts] = args
      const reason = reasonParts.join(' ')
      const result = recordFeedback(draftId, platform, approved === 'true', reason, '')
      console.log('Recorded:', result)
      break
    
    case 'learnings':
      const learnPlatform = args[0]
      console.log(JSON.stringify(getLearnings(learnPlatform), null, 2))
      break
    
    case 'stats':
      console.log(JSON.stringify(getStats(), null, 2))
      break
    
    default:
      console.log('Usage: feedback-store.js <record|learnings|stats> [args]')
  }
}

module.exports = { recordFeedback, recordEdit, recordSystemLearning, getLearnings, getFeedback, getStats, loadStore, saveStore }
