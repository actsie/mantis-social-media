import { Octokit } from '@octokit/rest'

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
const [owner, repo] = (process.env.GITHUB_REPO || 'actsie/agentcard-social').split('/')

export interface Draft {
  id: string
  platform: string
  type: string
  status: 'pending' | 'approved' | 'rejected'
  urgency: 'breaking' | 'standard'
  text: string
  context: string
  source_url?: string
  source_post_url?: string
  created_at: string
  reviewed_at: string | null
  posted_at: string | null
  account: string
}

async function getFile(path: string): Promise<{ content: string; sha: string }> {
  const response = await octokit.repos.getContent({ owner, repo, path, headers: { 'If-None-Match': '' } })
  const data = response.data as { content: string; sha: string }
  const content = Buffer.from(data.content, 'base64').toString('utf8')
  return { content, sha: data.sha }
}

async function putFile(path: string, content: string, sha: string, message: string): Promise<void> {
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    sha,
  })
}

export async function getDrafts(): Promise<{ drafts: Draft[]; sha: string }> {
  const { content, sha } = await getFile('openclaw-workspace/drafts.json')
  const drafts = JSON.parse(content) as Draft[]
  return { drafts, sha }
}

export async function writeDrafts(drafts: Draft[], _sha: string): Promise<void> {
  // Always fetch fresh SHA immediately before write
  const { sha: freshSha } = await getFile('openclaw-workspace/drafts.json')
  try {
    await putFile(
      'openclaw-workspace/drafts.json',
      JSON.stringify(drafts, null, 2),
      freshSha,
      'Update drafts via approval UI'
    )
  } catch (err: unknown) {
    // 409 conflict — retry once with a new fresh SHA
    if ((err as { status?: number }).status === 409) {
      const { sha: retrySha } = await getFile('openclaw-workspace/drafts.json')
      await putFile(
        'openclaw-workspace/drafts.json',
        JSON.stringify(drafts, null, 2),
        retrySha,
        'Update drafts via approval UI (retry)'
      )
    } else {
      throw err
    }
  }
}

export async function appendFeedback(entry: string): Promise<void> {
  const { content, sha } = await getFile('openclaw-workspace/feedback-patterns.md')

  // Insert entry before the Rules section to preserve structure
  const rulesIndex = content.indexOf('\n## Rules')
  const newContent = rulesIndex !== -1
    ? content.slice(0, rulesIndex) + '\n' + entry + content.slice(rulesIndex)
    : content + '\n' + entry

  try {
    await putFile(
      'openclaw-workspace/feedback-patterns.md',
      newContent,
      sha,
      'Append feedback from approval UI'
    )
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 409) {
      const { content: retryContent, sha: retrySha } = await getFile('openclaw-workspace/feedback-patterns.md')
      const retryRulesIndex = retryContent.indexOf('\n## Rules')
      const retryNewContent = retryRulesIndex !== -1
        ? retryContent.slice(0, retryRulesIndex) + '\n' + entry + retryContent.slice(retryRulesIndex)
        : retryContent + '\n' + entry
      await putFile(
        'openclaw-workspace/feedback-patterns.md',
        retryNewContent,
        retrySha,
        'Append feedback from approval UI (retry)'
      )
    } else {
      throw err
    }
  }
}
