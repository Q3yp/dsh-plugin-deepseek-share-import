import { useEffect, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { HocShare, InjectFace, PropsRuntime, SlotMap } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'

export const inject = ['slots', 'sessions']
type Props = PropsRuntime<'sidebar.session.action'> & HocShare<SlotMap['sidebar.session.action']> & InjectFace<{ refresh: () => Promise<void> }>

async function request(body?: { url: string; workspaceId: string }, signal?: AbortSignal) {
  const transport = (window as Window & { __DSH_TRANSPORT__?: { fetch?: typeof fetch } }).__DSH_TRANSPORT__
  const send = transport?.fetch?.bind(transport) ?? window.fetch.bind(window)
  const response = await send('./api/deepseek-share-import', body === undefined ? { signal } : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal,
  })
  if (response.status === 403) throw new Error('仅 DSH 所有者可以导入对话。')
  const data = await response.json()
  if (!response.ok || data.ok === false) throw new Error(data.error || `导入请求失败：${response.status}`)
  return data
}

function Action({ children, refresh }: Props) {
  const [open, setOpen] = useState(false)
  return <>{children}<button type="button" title="从 DeepSeek 分享链接导入" aria-label="从 DeepSeek 分享链接导入" onClick={() => setOpen(true)} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 8 }}>↧</button>{open && <ImportDialog refresh={refresh} close={() => setOpen(false)} />}</>
}

function ImportDialog({ refresh, close }: { refresh: () => Promise<void>; close: () => void }) {
  const [workspaces, setWorkspaces] = useState<{ id: string; path: string }[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const controller = useRef(new AbortController())
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const current = new AbortController()
    controller.current = current
    dialog.current?.showModal()
    void request(undefined, current.signal).then((value: { workspaces: { id: string; path: string }[] }) => {
      setWorkspaces(value.workspaces)
      setWorkspaceId(value.workspaces[0]?.id ?? '')
    }).catch((error: unknown) => { if (!current.signal.aborted) setMessage(String(error)) })
    return () => { current.abort() }
  }, [])
  const run = async () => {
    setBusy(true)
    setMessage('正在读取分享对话并创建本地 Session…')
    try {
      const { result } = await request({ url, workspaceId }, controller.current.signal)
      setDone(true)
      setMessage(`已导入「${result.title ?? 'DeepSeek 对话'}」，可从侧栏打开继续聊天。`)
      await refresh().catch((error: unknown) => setMessage(previous => `${previous}\n刷新会话列表失败：${String(error)}`))
    } catch (error) {
      if (!controller.current.signal.aborted) setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      if (!controller.current.signal.aborted) setBusy(false)
    }
  }
  const button = { padding: '9px 14px', border: '1px solid #8886', borderRadius: 8, cursor: 'pointer', color: 'inherit', background: 'transparent' }
  return <dialog ref={dialog} onCancel={close} aria-labelledby="dsh-import-title" style={{ color: 'inherit', background: 'var(--color-bg, Canvas)', border: '1px solid #8885', borderRadius: 16, padding: 24, width: 480, maxWidth: 'calc(100vw - 40px)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 id="dsh-import-title" style={{ fontSize: 19, margin: 0 }}>导入 DeepSeek 分享对话</h2><button type="button" style={button} onClick={close} aria-label="关闭">×</button></header>
    <p style={{ opacity: .65, fontSize: 13 }}>粘贴公开分享链接，转成本地会话后接着聊。</p>
    <form onSubmit={e => { e.preventDefault(); void run() }}>
      <label style={{ display: 'grid', gap: 8 }}>公开分享链接<input type="url" required placeholder="https://chat.deepseek.com/share/…" value={url} disabled={busy || done} onChange={e => setUrl(e.target.value)} style={{ padding: 10, border: '1px solid #8886', borderRadius: 8, color: 'inherit', background: 'transparent' }} /></label>
      <label style={{ display: 'grid', gap: 8, margin: '20px 0' }}>目标工作区<select disabled={busy || done} value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} style={{ padding: 10, color: 'inherit', background: 'transparent', borderRadius: 8 }}>{workspaces.map(w => <option key={w.id} value={w.id}>{w.path}</option>)}</select></label>
      {workspaces.length === 0 && <p>请先在 DSH 中添加一个工作区。</p>}
      {done ? <button type="button" style={button} onClick={close}>完成</button> : <button style={button} disabled={busy || !workspaceId}>{busy ? '正在导入…' : '导入为本地会话'}</button>}
    </form>
    <p role="status" style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto', fontSize: 13 }}>{message}</p>
  </dialog>
}

export function apply(ctx: Context) {
  ctx.slots.inject('sidebar.session.action', () => ctx.slots.register({
    name: 'sidebar.session.action', id: 'deepseek-share-import', inject: () => ({ refresh: () => ctx.sessions.refresh() }),
  }, Action))
}
