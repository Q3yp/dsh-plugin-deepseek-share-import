import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-session-projection-cache'
import type {} from '@deepseek-ai/dsh-workspace'
import { z } from 'zod'
import { readShare } from './share.ts'
import { importConversation } from './import.ts'

export const name = 'deepseek-share-import'
export const inject = ['connection', 'sessionPersistence', 'workspaceRegistry']
const inputSchema = z.object({ workspaceId: z.string(), url: z.string() })

export function apply(ctx: Context) {
  const lifetime = new AbortController()
  const pending = new Set<Promise<Response>>()
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/deepseek-share-import', methods: ['GET', 'POST'], requestBody: 'buffered',
    fetch: request => {
      if (request.method === 'GET') return Promise.resolve(Response.json({
        workspaces: ctx.workspaceRegistry.list().map(w => ({ id: w.id, path: w.path })),
      }, { headers: { 'cache-control': 'no-store' } }))
      const operation = (async () => {
        try {
          const input = inputSchema.parse(await request.json())
          const workspace = ctx.workspaceRegistry.list().find(w => w.id === input.workspaceId)
          if (!workspace) throw new Error('请选择已注册的 DSH 工作区。')
          const signal = AbortSignal.any([lifetime.signal, request.signal])
          const source = await readShare(input.url, signal)
          const persistence = ctx.sessionPersistence
          const cache = ctx.get('sessionProjectionCache')
          const result = await importConversation(source, workspace, persistence, cache, signal)
          return Response.json({ ok: true, result })
        } catch (error) {
          return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 })
        }
      })()
      pending.add(operation)
      return operation.finally(() => { pending.delete(operation) })
    },
  }), 'deepseek-share-import: owner routes')
  ctx.effect(() => async () => {
    lifetime.abort()
    await Promise.allSettled(pending)
  }, 'deepseek-share-import: pending imports')
}
