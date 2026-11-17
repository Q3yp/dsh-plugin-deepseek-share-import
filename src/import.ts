import { randomUUID } from 'node:crypto'
import { brandNumber, brandString } from '@deepseek-ai/dsh-brand'
import { Session, SESSION_FORMAT_VERSION, type SessionId, type SessionLogOffset, type SessionHeader } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { SessionProjectionCache } from '@deepseek-ai/dsh-session-projection-cache'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import { convertConversation } from '@deepseek-ai/dsh-deepseek-chat-import/src/conversation.ts'
import { exportSessionFile } from '@deepseek-ai/dsh-deepseek-chat-import/src/format.ts'
import { exportFormat, type Conversation } from './source.ts'

export async function importConversation(source: Conversation, workspace: Workspace, persistence: SessionPersistence, cache: SessionProjectionCache | undefined, signal: AbortSignal) {
  signal.throwIfAborted()
  const conversion = convertConversation(exportSessionFile.parse(exportFormat(source)), {
    createId: randomUUID, maxTitleBytes: 80,
  })
  const id = brandString<SessionId>(randomUUID())
  const header: SessionHeader = { version: SESSION_FORMAT_VERSION, id, createdAt: conversion.createdAt, cwd: workspace.path, isSeeded: false }
  Session.create(id, conversion.events, header)
  const handle = await persistence.create(header, { signal })
  try {
    await handle.append(conversion.events, { signal })
    await handle.flush({ signal })
  } finally { await handle.close() }
  cache?.coldSnapshot(header, brandNumber<SessionLogOffset>(0), conversion.events)
  await workspace.attachSession(id)
  return { sessionId: id, title: conversion.title }
}
