# Dashboard Data Schema

Normalized object types for consistent data across all tabs.

---

## Event

Base type for time-stamped occurrences.

```typescript
interface Event {
  id: string
  type: 'heartbeat' | 'cron_run' | 'post_draft' | 'file_change' | 'agent_update' | 'alert'
  timestamp: string // ISO 8601
  source: string
  data: Record<string, any>
}
```

---

## Mission

Active work tracking.

```typescript
interface Mission {
  id: string
  title: string
  status: 'active' | 'blocked' | 'completed' | 'paused'
  agent?: string // agent id
  priority: 'high' | 'medium' | 'low'
  output?: string
  blocker?: string
  nextStep?: string
  relatedFiles: string[]
  createdAt: string
  updatedAt: string
}
```

---

## Draft

Content awaiting approval.

```typescript
interface Draft {
  id: string
  content: string
  platform: 'x' | 'instagram' | 'reddit'
  status: 'pending' | 'approved' | 'rejected' | 'posted'
  createdAt: string
  reviewedAt?: string
  feedback?: {
    rejected: boolean
    reason: string
    category: 'tone' | 'accuracy' | 'timing' | 'other'
  }
}
```

---

## CronJob

Scheduled automation.

```typescript
interface CronJob {
  id: string
  name: string
  schedule: string // cron expression
  nextRun: string
  lastRun?: string
  status: 'enabled' | 'disabled' | 'failed'
  result?: {
    success: boolean
    output?: string
    error?: string
    duration?: number
  }
}
```

---

## FileChange

Workspace file modification.

```typescript
interface FileChange {
  path: string
  modifiedAt: string
  type: 'create' | 'modify' | 'delete'
  source: 'cron' | 'agent' | 'manual' | 'system'
  diff?: string
}
```

---

## Learning

Captured feedback for improvement. Three types:

**content** — Draft feedback from approve/reject flow
**system** — Automation decisions, phase changes, rule updates
**experiment** — Things tried, outcome, verdict (keep/archive/retry)

```typescript
interface Learning {
  id: string
  type: 'content' | 'system' | 'experiment'
  
  // For content type
  source?: 'rejection' | 'correction' | 'miss' | 'review'
  note?: string // rejection reason
  category?: 'tone' | 'timing' | 'accuracy' | 'strategy' | 'other'
  linkedId?: string // draft id
  
  // For system/experiment types
  title?: string
  description?: string
  outcome?: 'success' | 'failure' | 'mixed'
  verdict?: 'keep' | 'archive' | 'retry' | 'shelved'
  platform?: 'instagram' | 'x' | 'reddit' | 'dashboard' | 'general'
  
  // Common
  createdAt: string
  applied?: boolean // whether this was used to improve something
  promotedToDoc?: string // doc id if promoted
}
```

---

## Sprint

Sprint planning and tracking.

```typescript
interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'active' | 'completed' | 'planned'
  goals: string[]
  tasks: Task[]
}

interface Task {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'blocked' | 'done'
  priority: 'high' | 'medium' | 'low'
  assignee?: string // agent id
  estimate?: number // hours
  actual?: number // hours
  notes?: string
  completedAt?: string
}
```

---

## FileDiff

Preview of file changes.

```typescript
interface FileDiff {
  path: string
  oldContent: string
  newContent: string
  added: string[] // lines added
  removed: string[] // lines removed
  stats: {
    additions: number
    deletions: number
  }
}
```

---

## Agent

Agent/sub-agent info.

```typescript
interface Agent {
  id: string
  name: string
  status: 'active' | 'idle' | 'stopped'
  task?: string
  prePrompt?: string
  recentActivity: Event[]
  linkedMission?: string
}
```

---

## DailySummary

Aggregated view for Overview tab.

```typescript
interface DailySummary {
  date: string
  heartbeats: number
  cronRuns: number
  filesChanged: number
  postsDrafted: number
  approvalsPending: number
  agentsActive: number
  failures: number
  lastReviewResult?: string
}
```
