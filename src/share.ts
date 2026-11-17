import { chromium } from 'playwright'
import { z } from 'zod'
import { conversation, shareId, unwrap, type Conversation } from './source.ts'

export async function readShare(url: string, signal: AbortSignal): Promise<Conversation> {
  const id = shareId(url)
  signal.throwIfAborted()
  const browser = await chromium.launch({ headless: true })
  const cancel = () => { void browser.close() }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    const page = await browser.newPage()
    await page.goto('https://chat.deepseek.com', { waitUntil: 'domcontentloaded' })
    const response = await page.evaluate(async id => {
      const response = await fetch(`https://chat.deepseek.com/api/v0/share/content?share_id=${encodeURIComponent(id)}`, { credentials: 'omit' })
      return { status: response.status, body: await response.text() }
    }, id)
    signal.throwIfAborted()
    if (response.status !== 200) throw new Error(`DeepSeek HTTP ${response.status}，请确认分享链接有效，限流时稍后重试。`)
    let value: unknown
    try { value = JSON.parse(response.body) } catch {
      throw new Error('DeepSeek 返回了非 JSON 页面，暂时无法读取此分享链接。')
    }
    const source = z.looseObject({ title: z.string().nullable(), messages: conversation.shape.messages }).parse(unwrap(value))
    const title = source.title === 'Shared Conversation' ? source.messages.find(m => m.role === 'USER')?.fragments.find(f => f.type === 'REQUEST')?.content ?? source.title : source.title
    return conversation.parse({ ...source, title, key: `share:${id}` })
  } finally {
    signal.removeEventListener('abort', cancel)
    await browser.close()
  }
}
