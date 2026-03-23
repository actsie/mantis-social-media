import { NextRequest, NextResponse } from 'next/server'
import { getDrafts, writeDrafts, appendFeedback, Draft } from '@/lib/github'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action, text } = await request.json()
    const now = new Date().toISOString()

    const { drafts, sha } = await getDrafts()
    const draftIndex = drafts.findIndex((d: Draft) => d.id === params.id)

    if (draftIndex === -1) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const draft = drafts[draftIndex]
    const originalText = draft.text

    if (action === 'approve') {
      draft.status = 'approved'
      draft.reviewed_at = now
      drafts[draftIndex] = draft
      await writeDrafts(drafts, sha)
      await appendFeedback(buildFeedbackEntry('approved', draft, originalText, originalText))

    } else if (action === 'reject') {
      draft.status = 'rejected'
      draft.reviewed_at = now
      drafts[draftIndex] = draft
      await writeDrafts(drafts, sha)
      await appendFeedback(buildFeedbackEntry('rejected', draft, originalText, originalText))

    } else if (action === 'edit_approve') {
      if (!text || typeof text !== 'string') {
        return NextResponse.json({ error: 'text required for edit_approve' }, { status: 400 })
      }
      draft.text = text.trim()
      draft.status = 'approved'
      draft.reviewed_at = now
      drafts[draftIndex] = draft
      await writeDrafts(drafts, sha)
      await appendFeedback(buildFeedbackEntry('edited', draft, originalText, text.trim()))

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/drafts/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
  }
}

function buildFeedbackEntry(
  decision: string,
  draft: Draft,
  original: string,
  final: string
): string {
  const diff = original !== final
    ? summarizeDiff(original, final)
    : 'no changes'

  return `
**Decision:** ${decision} — ${draft.id}
**Date:** ${draft.reviewed_at}
**Platform:** ${draft.platform}
**Original:** ${original}
**Final:** ${final}
**Diff:** ${diff}
`
}

function summarizeDiff(before: string, after: string): string {
  if (before === after) return 'no changes'
  const beforeWords = before.split(/\s+/)
  const afterWords = after.split(/\s+/)
  const removed = beforeWords.filter(w => !afterWords.includes(w)).slice(0, 5).join(', ')
  const added = afterWords.filter(w => !beforeWords.includes(w)).slice(0, 5).join(', ')
  const parts = []
  if (removed) parts.push(`removed: "${removed}"`)
  if (added) parts.push(`added: "${added}"`)
  return parts.length ? parts.join('; ') : 'text modified'
}
