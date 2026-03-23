import { NextRequest, NextResponse } from 'next/server'
import { getDrafts, Draft } from '@/lib/github'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter')

    const { drafts } = await getDrafts()

    let filtered = filter === 'all'
      ? drafts
      : drafts.filter((d: Draft) => d.status === 'pending')

    // Sort: breaking first, then newest first
    filtered = filtered.sort((a: Draft, b: Draft) => {
      if (a.urgency === 'breaking' && b.urgency !== 'breaking') return -1
      if (a.urgency !== 'breaking' && b.urgency === 'breaking') return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('GET /api/drafts error:', err)
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 })
  }
}
