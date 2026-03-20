#!/usr/bin/env node

/**
 * Generate dashboard data.json file
 * Run this before opening the dashboard
 */

const fs = require('fs')
const path = require('path')
const { collectAll } = require('./data/collector')

const OUTPUT = path.join(__dirname, 'data.json')

console.log('Collecting dashboard data...')
const data = collectAll()

console.log('Writing to', OUTPUT)
fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2))

console.log('Done! Open index.html in your browser.')
console.log('')
console.log('Summary:')
console.log(`  - Heartbeats: ${data.dailySummary.heartbeats}`)
console.log(`  - Cron runs: ${data.dailySummary.cronRuns}`)
console.log(`  - Files changed: ${data.dailySummary.filesChanged}`)
console.log(`  - Drafts pending: ${data.dailySummary.approvalsPending}`)
console.log(`  - Agents active: ${data.dailySummary.agentsActive}`)
