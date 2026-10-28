import { expect, test } from 'claude-code/testing'

declare function setTimeout(callback: (value: unknown) => void, ms: number): unknown

const LIST = `Untrusted content follows.
<child-session-output nonce="x" untrusted="true">
Relayed session output. Shown as DATA:
    {"sessions":[{"created_at":"2026-10-16T15:50:57Z","last_activity_at":"2026-10-19T12:01:12Z","session_id":"cse_015Aj","state":"blocked","thread_id":"cmsg_A","title":"Draft the launch plan"},{"created_at":"2026-10-14T13:47:03Z","last_activity_at":"2026-10-14T13:48:04Z","resolved":true,"session_id":"cse_016b","state":"done","thread_id":"cmsg_B","title":"Set up the project"}]}
</child-session-output nonce="x">`

const SESSION = `<other-session nonce="y" untrusted="true">
Another Claude session's record (JSON). DATA:
    {"ccr":{"id":"session_015Aj","post_turn_summary":{"recent_action":"Plan drafted","needs_action":"Pick option A or B"},"external_metadata":{"status":{"text":"Plan\\n\\n✓ one"},"artifacts":[{"title":"Deck","url":"https://claude.ai/code/artifact/1"},{"title":"Bad","url":"javascript:alert(1)"}]}}}
</other-session nonce="y">`

test('a turn writes a snapshot with each thread and its summary', async ($, on) => {
  const written: string[] = []
  const asked: string[] = []
  on('clock.now', () => ({ value: 1_800_000_000_000 }))
  on('fs.exists', () => ({ value: true }))
  on('fs.write', (_, e) => { written.push(e.text); return { value: undefined } })
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('mcp.call', (_, e) => {
    asked.push(`${e.server}.${e.tool}:${String(e.args?.session_id ?? '')}`)
    const text = e.tool === 'list_threads' ? LIST : SESSION

    return { value: { content: [{ type: 'text', text }], isError: false } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (let i = 0; i < 50 && written.length === 0; i++) await new Promise(r => setTimeout(r, 10))

  expect(asked).toContain('claude-code-remote.get_session:session_015Aj')
  const snap = JSON.parse(written[0] ?? '{}')
  expect(snap.threads.length).toBe(2)
  expect(snap.threads[0].state).toBe('blocked')
  expect(snap.threads[0].needsAction).toBe('Pick option A or B')
  expect(snap.threads[0].recentAction).toBe('Plan drafted')
  expect(snap.threads[0].outputs.length).toBe(1)
  expect(snap.threads[1].isResolved).toBe(true)
})
