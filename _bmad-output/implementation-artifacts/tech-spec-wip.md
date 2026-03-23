---
title: 'Draft Approval Web App — React + Vercel + GitHub API'
slug: 'draft-approval-web-app'
created: '2026-03-23'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack: ['Next.js 14', 'Tailwind CSS', 'GitHub API', 'Vercel']
files_to_modify: []
code_patterns: ['App Router', 'API routes', 'cookie auth', 'Octokit GitHub API']
test_patterns: []
---

# Tech-Spec: Draft Approval Web App — React + Vercel + GitHub API

**Created:** 2026-03-23

## Overview

### Problem Statement

The tweet approval dashboard runs locally at `localhost:8901` on MantisCAW — inaccessible to Ben and other team members. There's no way to review, approve, reject, or edit AI-generated drafts without being on MantisCAW's machine. Drafts pile up unapproved and the account goes silent.

### Solution

A Next.js web app deployed on Vercel that reads and writes `drafts.json` directly via the GitHub API. Team members visit a URL, enter a password, and can approve/reject/edit drafts from any browser. Every action logs to `feedback-patterns.md` so MantisCAW learns over time.

### Scope

**In Scope:**
- `web/` subdirectory in `actsie/agentcard-social` repo
- Next.js 14 App Router app deployed on Vercel
- Password auth (environment variable, cookie session)
- Read pending drafts from `drafts.json` via GitHub API
- Approve, reject, edit draft text → write back to `drafts.json` via GitHub API
- Log all decisions + edit diffs to `feedback-patterns.md` via GitHub API
- Show draft text, platform, urgency, account, source URL, pain category
- Filter view: pending only (default), all drafts

**Out of Scope:**
- Posting drafts directly (post-approved.js handles that on MantisCAW)
- User accounts / per-user auth
- Real-time updates (manual refresh is fine for now)
- Mobile-optimized UI (desktop first)
- Email/SMS notifications (Discord handles this)

## Context for Development

### Codebase Patterns

No existing frontend. Clean slate in `web/` subdirectory.

`drafts.json` schema:
```json
{
  "id": "YYYYMMDD-[type]-[platform]-[slug]",
  "platform": "twitter|reddit",
  "type": "original|reply",
  "status": "pending|approved|rejected",
  "urgency": "breaking|standard",
  "text": "...",
  "context": "...",
  "source_url": "https://...",
  "source_post_url": "https://...",
  "created_at": "ISO timestamp",
  "reviewed_at": null,
  "posted_at": null,
  "account": "brand|personal"
}
```

`feedback-patterns.md` append format (match existing structure):
```markdown
**Decision:** approved|rejected|edited — [draft id]
**Date:** ISO timestamp
**Platform:** twitter|reddit
**Original:** [original text if edited]
**Final:** [final text]
**Diff:** [what changed, one line summary]
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `openclaw-workspace/drafts.json` | Read/write target via GitHub API |
| `openclaw-workspace/feedback-patterns.md` | Append decisions after every action |
| `openclaw-workspace/drafts-schema.md` | Full schema reference |

### Technical Decisions

**Framework:** Next.js 14 App Router — API routes + React UI in one repo, deploys to Vercel with zero config.

**Subdirectory:** `web/` — keeps scripts and frontend cleanly separated. Vercel root directory set to `web/`.

**Auth:** Single shared password stored as `APP_PASSWORD` env var. On login, set a `session` cookie (signed with `APP_SECRET`). Middleware checks cookie on every request. No user accounts.

**iron-session App Router pattern — use exactly this:**
```typescript
// In API route handlers (NOT in middleware):
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

const session = await getIronSession(cookies(), {
  password: process.env.APP_SECRET!,
  cookieName: 'session'
})
```
Middleware runs on Edge Runtime — it must only check the cookie value, never import `@octokit/rest` (uses Node APIs, incompatible with Edge).

**GitHub API:** Use `@octokit/rest`. All reads/writes go through API routes (never expose token to client).
- Read: `GET /repos/actsie/agentcard-social/contents/openclaw-workspace/drafts.json`
- Write: `PUT /repos/actsie/agentcard-social/contents/openclaw-workspace/drafts.json` (requires current file SHA)

**SHA conflict handling (critical):** On every write, always fetch fresh SHA immediately before the PUT — never cache it. On 409 response, re-fetch the file and retry the write once. Apply this pattern to both `writeDrafts()` and `appendFeedback()`.

**Sort order:** Drafts sorted by urgency first (breaking → standard), then by created_at descending (newest first).

**Edit UX:** Clicking the Edit button replaces the static draft text with an inline `<textarea>`. The Approve and Reject buttons are replaced by Save+Approve and Cancel buttons. Clicking Cancel restores original text. Clicking Save+Approve submits the edited text + approve action.

**Loading states:** All action buttons (Approve, Reject, Save+Approve) must show a spinner and be disabled during the in-flight API request. Prevents double-submit.

**State management:** No Redux/Zustand — simple `useState` + fetch. App is simple enough.

**Styling:** Tailwind CSS — fast to write, no separate CSS files.

**Environment variables (set in Vercel dashboard):**
- `GITHUB_TOKEN` — PAT with `repo` scope (actsie's token)
- `GITHUB_REPO` — `actsie/agentcard-social`
- `APP_PASSWORD` — shared team password
- `APP_SECRET` — random string for cookie signing (generate with `openssl rand -base64 32`)

## Implementation Plan

### Tasks

**1. Scaffold Next.js app**
- `web/package.json` — deps: next, react, react-dom, @octokit/rest, tailwindcss, cookie, iron-session
- `web/next.config.js`
- `web/tailwind.config.js`
- `web/app/layout.tsx` — basic HTML shell, Tailwind
- `web/middleware.ts` — redirect to /login if no valid session cookie

**2. Auth**
- `web/app/login/page.tsx` — password form
- `web/app/api/auth/login/route.ts` — POST: check password, set signed cookie, redirect to /
- `web/app/api/auth/logout/route.ts` — POST: clear cookie

**3. GitHub API helpers**
- `web/lib/github.ts` — two functions:
  - `getDrafts()` — fetch + decode drafts.json, return parsed array + SHA
  - `writeDrafts(drafts, sha)` — PUT updated drafts.json back
  - `appendFeedback(entry)` — fetch feedback-patterns.md, append entry, PUT back

**4. API routes**
- `web/app/api/drafts/route.ts` — GET: return pending drafts (or all if ?filter=all)
- `web/app/api/drafts/[id]/route.ts` — PATCH: approve | reject | edit
  - approve: set status=approved, reviewed_at=now, log to feedback-patterns.md
  - reject: set status=rejected, reviewed_at=now, log to feedback-patterns.md
  - edit+approve: update text, set status=approved, reviewed_at=now, log diff to feedback-patterns.md

**5. UI**
- `web/app/page.tsx` — main page, fetches drafts, renders list
- `web/components/DraftCard.tsx` — single draft card with:
  - Draft text (editable textarea on click)
  - Platform badge, urgency badge, account badge
  - Source URL link
  - Context/pain category
  - Created at timestamp
  - Approve / Reject / Edit buttons
- `web/components/FilterBar.tsx` — pending | all toggle

**6. Vercel config**
- Set root directory to `web/` in Vercel dashboard
- Add all 4 env vars in Vercel dashboard

### Acceptance Criteria

**Given** a team member visits the app URL:
- **When** no session cookie → **Then** redirected to /login
- **When** correct password entered → **Then** session cookie set, redirected to /
- **When** wrong password → **Then** error shown, no cookie set

**Given** logged in:
- **When** page loads → **Then** pending drafts shown, breaking urgency first, then newest first
- **When** filter = all → **Then** all drafts shown regardless of status
- **When** approve clicked → **Then** button disabled + spinner shown during request, then status=approved, reviewed_at set, feedback logged, card removed from pending view
- **When** reject clicked → **Then** button disabled + spinner shown during request, then status=rejected, reviewed_at set, feedback logged, card removed from pending view
- **When** edit clicked → **Then** inline textarea appears, Save+Approve and Cancel buttons replace Approve/Reject
- **When** cancel clicked → **Then** original text restored, buttons revert
- **When** Save+Approve clicked → **Then** updated text saved, diff logged to feedback-patterns.md, card removed from pending view
- **When** no pending drafts → **Then** "No pending drafts" message shown

**Given** GitHub API:
- **When** drafts.json written → **Then** SHA fetched fresh immediately before write, never cached
- **When** 409 conflict on write → **Then** re-fetch file + SHA, retry once, show error to user if retry fails
- **When** concurrent edits (two users) → **Then** second write retries once then fails gracefully with error message

## Additional Context

### Dependencies

- GitHub PAT from actsie's account with `repo` scope
- Vercel project root directory set to `web/`
- 4 environment variables set in Vercel dashboard before first deploy

### Testing Strategy

1. Deploy to Vercel, visit URL, confirm redirect to /login
2. Enter wrong password — confirm blocked
3. Enter correct password — confirm drafts load
4. Approve a draft — confirm drafts.json updated on GitHub, feedback-patterns.md appended
5. Reject a draft — same checks
6. Edit text then approve — confirm diff logged correctly
7. Check that post-approved.js on MantisCAW still picks up approved drafts correctly (reads same drafts.json)

### Notes

- post-approved.js on MantisCAW reads drafts.json from local filesystem. After this app writes back to GitHub, MantisCAW needs to `git pull` before post-approved.js runs. The cron already does `git pull` at start — confirm timing is correct.
- feedback-patterns.md append must preserve existing structure (Rejection Patterns / Edit Patterns / Rules sections)
- Cookie signing: use `iron-session` for simplicity — handles signing + encryption
- SHA conflict handling: on PATCH, always fetch fresh SHA before writing, never cache it
