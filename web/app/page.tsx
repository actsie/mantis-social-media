'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DraftCard from '@/components/DraftCard'
import { Draft } from '@/lib/github'

export default function HomePage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  async function fetchDrafts() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/drafts?filter=${filter}`)
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to fetch drafts')
      const data = await res.json()
      setDrafts(data)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDrafts() }, [filter])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Agent Card Drafts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${drafts.length} ${filter === 'pending' ? 'pending' : 'total'}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDrafts}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('pending')}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium ${
            filter === 'pending'
              ? 'bg-black text-white'
              : 'border border-gray-300 text-gray-600'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium ${
            filter === 'all'
              ? 'bg-black text-white'
              : 'border border-gray-300 text-gray-600'
          }`}
        >
          All
        </button>
      </div>

      {/* Content */}
      {error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      {!loading && drafts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No {filter === 'pending' ? 'pending ' : ''}drafts</p>
          <p className="text-sm mt-1">Check back after the next cron run</p>
        </div>
      )}

      <div className="space-y-4">
        {drafts.map(draft => (
          <DraftCard
            key={draft.id}
            draft={draft}
            onAction={(id) => {
              if (filter === 'pending') {
                setDrafts(prev => prev.filter(d => d.id !== id))
              } else {
                fetchDrafts()
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}
