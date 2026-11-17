import { z } from 'zod'

export const fragment = z.looseObject({ type: z.string(), content: z.string().optional() })
export const message = z.looseObject({
  message_id: z.number().int(), parent_id: z.number().int().nullable(),
  role: z.enum(['USER', 'ASSISTANT']), status: z.string(),
  inserted_at: z.number(), fragments: z.array(fragment),
})
export const conversation = z.looseObject({
  key: z.string(), title: z.string().nullable(), messages: z.array(message),
  current_message_id: z.number().nullable().optional(),
})
export type Conversation = z.infer<typeof conversation>

export function unwrap(value: unknown): unknown {
  const response = z.object({ code: z.number(), msg: z.string(), data: z.object({
    biz_code: z.number(), biz_msg: z.string(), biz_data: z.unknown(),
  }).nullable().optional() }).parse(value)
  if (response.code !== 0 || response.data?.biz_code !== 0) {
    throw new Error(response.data?.biz_msg || response.msg || 'DeepSeek 拒绝了请求，请确认分享链接有效。')
  }
  return response.data.biz_data
}

export function shareId(input: string): string {
  const url = new URL(input)
  const match = /^\/share\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname)
  if (url.origin !== 'https://chat.deepseek.com' || !match) throw new Error('请输入 https://chat.deepseek.com/share/… 链接。')
  return match[1]
}

export function exportFormat(source: Conversation) {
  return {
    id: source.key, title: source.title,
    current_message_id: source.current_message_id,
    inserted_at: new Date((source.messages[0]?.inserted_at ?? 0) * 1000).toISOString(),
    messages: source.messages.map(m => ({
      id: m.message_id, parent_id: m.parent_id, role: m.role, status: m.status,
      inserted_at: new Date(m.inserted_at * 1000).toISOString(),
      fragments: m.fragments.map(f => {
        if (f.type === 'SEARCH' || f.type === 'TOOL_SEARCH') {
          const search = z.looseObject({ queries: z.array(z.union([z.string(), z.object({ query: z.string() })])).default([]), results: z.array(z.looseObject({ published_at: z.union([z.number(), z.string()]).nullable().optional() })) }).parse(f)
          return { ...search, type: 'TOOL_SEARCH', queries: search.queries.map(q => typeof q === 'string' ? q : q.query), results: search.results.map(r => ({ ...r, published_at: typeof r.published_at === 'number' ? new Date(r.published_at * 1000).toISOString() : r.published_at })) }
        }
        if (f.type === 'TOOL_OPEN') {
          const open = z.looseObject({ result: z.object({ url: z.string(), title: z.string().nullable().optional() }).nullable().optional() }).parse(f)
          return { ...f, url: open.result?.url ?? null, title: open.result?.title ?? null }
        }
        if (f.type === 'FILE') {
          const files = z.object({ files: z.array(z.looseObject({ id: z.string(), file_name: z.string(), is_image: z.boolean().optional() })) }).parse(f)
          return { ...f, files: files.files.map(file => ({ ...file, is_image: file.is_image ?? false, export_path: null })) }
        }
        return f
      }),
    })),
  }
}

