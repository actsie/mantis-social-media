'use client'

import { useState } from 'react'
import { Draft } from '@/lib/github'

interface Props {
  draft: Draft
  onAction: () => void
}

export default function DraftCard({ draft, onAction }: Props) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(draft.text)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doAction(action: string, text?: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      onAction()
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const urgencyColor = draft.urgency === 'breaking'
    ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-600'

  const platformColor = draft.platform === 'twitter'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-orange-100 text-orange-700'

  const accountColor = draft.account === 'brand'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-green-100 text-green-700'

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }[draft.status]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgencyColor}`}>
          {draft.urgency}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${platformColor}`}>
          {draft.platform}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${accountColor}`}>
          {draft.account}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
          {draft.status}
        </span>
      </div>

      {/* Draft text */}
      {editing ? (
        <textarea
          value={editText}
          onChange={e => setEditText(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          rows={4}
          autoFocus
        />
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{draft.text}</p>
      )}

      {/* Char count when editing */}
      {editing && (
        <p className={`text-xs ${editText.length > 280 ? 'text-red-500' : 'text-gray-400'}`}>
          {editText.length}/280 chars
        </p>
      )}

      {/* Context */}
      {draft.context && (
        <p className="text-xs text-gray-400">{draft.context}</p>
      )}

      {/* Source URL */}
      {(draft.source_post_url || draft.source_url) && (
        <a
          href={draft.source_post_url || draft.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline block truncate"
        >
          {draft.source_post_url || draft.source_url}
        </a>
      )}

      {/* Created at */}
      <p className="text-xs text-gray-400">
        {new Date(draft.created_at).toLocaleString()}
      </p>

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Actions */}
      {draft.status === 'pending' && (
        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <>
              <button
                onClick={() => doAction('edit_approve', editText)}
                disabled={loading || editText.length > 280}
                className="bg-black text-white text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {loading ? <Spinner /> : null}
                Save + Approve
              </button>
              <button
                onClick={() => { setEditing(false); setEditText(draft.text) }}
                disabled={loading}
                className="border border-gray-300 text-sm px-4 py-1.5 rounded-lg text-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => doAction('approve')}
                disabled={loading}
                className="bg-black text-white text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {loading ? <Spinner /> : null}
                Approve
              </button>
              <button
                onClick={() => setEditing(true)}
                disabled={loading}
                className="border border-gray-300 text-sm px-4 py-1.5 rounded-lg text-gray-600 disabled:opacity-50"
              >
                Edit
              </button>
              <button
                onClick={() => doAction('reject')}
                disabled={loading}
                className="border border-red-200 text-red-600 text-sm px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
              >
                {loading ? <Spinner /> : null}
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
