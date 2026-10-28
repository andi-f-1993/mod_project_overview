import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pulse } from '../types'

// Where every thread of a project can write and the overview page can read.
const PROJECT_DIR = '/mnt/project-files'
const SNAPSHOT = `${PROJECT_DIR}/.project-overview/snapshot.json`
const THREADS = 'hearthbot'
const SESSIONS = 'claude-code-remote'
const MIN_GAP_MS = 30_000
const pulse = atom({ plugin: 'project-overview', key: 'pulse' } as const, null, { shape: 'pulse-1' })

type Detail = {
  recentAction: string
  needsAction: string
  statusDetail: string
  checklist: string
  outputs: Array<{ title: string; url: string }>
}

type ThreadEntry = {
  threadId: string
  sessionId: string
  title: string
  state: string
  createdAt: string
  lastActivityAt: string
  isResolved: boolean
} & Detail

// Tool results come wrapped in an untrusted-data envelope: take the outermost
// JSON object and read only the fields the page shows.
export function parseJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return {}
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

export function toDetail(session: Record<string, unknown>): Detail {
  const ccr = obj(session.ccr)
  const meta = obj(ccr.external_metadata)
  const summary = { ...obj(meta.post_turn_summary), ...obj(ccr.post_turn_summary) }
  const artifacts = Array.isArray(meta.artifacts) ? meta.artifacts : []

  return {
    recentAction: str(summary.recent_action),
    needsAction: str(summary.needs_action),
    statusDetail: str(summary.status_detail),
    checklist: str(obj(meta.status).text),
    outputs: artifacts
      .map(a => ({ title: str(obj(a).title), url: str(obj(a).url) }))
      .filter(a => a.url.startsWith('https://')),
  }
}

async function callText($: EngineInterface, server: string, tool: string, args: Record<string, unknown>) {
  const result = await $.mcp.call(server, tool, args)
  if (result.isError) throw new Error(`${tool} failed`)

  return result.content.map(b => (b.type === 'text' ? b.text : '')).join('\n')
}

async function listThreads($: EngineInterface): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = []
  let cursor: string | undefined
  for (let page = 0; page < 10; page++) {
    const data = parseJson(await callText($, THREADS, 'list_threads', cursor ? { limit: 50, cursor } : { limit: 50 }))
    const rows = Array.isArray(data.sessions) ? data.sessions : []
    all.push(...rows.map(obj))
    cursor = str(data.next_cursor) || undefined
    if (!cursor) break
  }

  return all
}

async function snapshot($: EngineInterface): Promise<void> {
  if (!(await $.fs.exists(PROJECT_DIR))) return
  const now = await $.clock.now()
  const last = Number((await $.store.get('lastWrite')) ?? 0)
  if (now - last < MIN_GAP_MS) return
  await $.store.set('lastWrite', now)

  const cache = obj(await $.store.get('details')) as Record<string, { at: string } & Detail>
  const threads: ThreadEntry[] = []
  for (const row of await listThreads($)) {
    const cse = str(row.session_id)
    const sessionId = cse.replace(/^cse_/, 'session_')
    const lastActivityAt = str(row.last_activity_at)
    let detail: Detail | undefined = cache[sessionId]?.at === lastActivityAt ? cache[sessionId] : undefined
    if (detail === undefined) {
      detail = await callText($, SESSIONS, 'get_session', { session_id: sessionId })
        .then(text => toDetail(parseJson(text)))
        .catch(() => toDetail({}))
      cache[sessionId] = { at: lastActivityAt, ...detail }
    }
    threads.push({
      threadId: str(row.thread_id),
      sessionId,
      title: str(row.title) || 'Untitled thread',
      state: str(row.state) || 'unknown',
      createdAt: str(row.created_at),
      lastActivityAt,
      isResolved: row.resolved === true,
      ...detail,
    })
  }
  await $.store.set('details', cache)
  const live = threads.filter(t => !/^\[obsolete\]/i.test(t.title))
  const next: Pulse = {
    needYou: live.filter(t => t.state === 'blocked').map(t => t.title),
    toReview: live.filter(t => t.state === 'review_ready').length,
    running: live.filter(t => t.state === 'working').length,
    total: threads.length,
  }
  await update($, pulse, () => next)
  await $.fs.write(SNAPSHOT, JSON.stringify({ version: 1, writtenAt: new Date(now).toISOString(), threads }, null, 1))
}

function refresh($: EngineInterface): void {
  // Never hold up the turn: a failed snapshot simply waits for the next one.
  void snapshot($).catch(() => undefined)
}

export const register: Register = on => {
  // A one-line strip above the prompt: who needs you, at a glance.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, pulse)
    if (p === null || e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const need = p.needYou.length

    return (
      <Box>
        <Text color={need ? 'yellow' : 'green'}>● </Text>
        <Text bold={need > 0}>{need ? `${need} need${need === 1 ? 's' : ''} you: ${p.needYou.join(', ')}` : 'Nothing needs you'}</Text>
        <Text dimColor>{`  ·  ${p.toReview} to review · ${p.running} running · ${p.total} threads`}</Text>
      </Box>
    )
  })

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    refresh($)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) refresh($)

    return result
  })
}
