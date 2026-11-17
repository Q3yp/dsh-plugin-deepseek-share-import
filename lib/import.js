// src/import.ts
import { randomUUID } from "node:crypto";
import { brandNumber, brandString as brandString2 } from "@deepseek-ai/dsh-brand";
import { Session, SESSION_FORMAT_VERSION } from "@deepseek-ai/dsh-session";

// node_modules/@deepseek-ai/dsh-deepseek-chat-import/src/conversation.ts
import { createHash } from "node:crypto";
import { brandString } from "@deepseek-ai/dsh-brand";
import { MessageId, ToolCallId } from "@deepseek-ai/dsh-llm";
import { SessionSeq } from "@deepseek-ai/dsh-session";
import { normalizeSessionTitle } from "@deepseek-ai/dsh-session-title";
import { formatFetchOutput, formatSearchOutput, fetchMetaFromValue, searchMetaFromValue } from "@deepseek-ai/dsh-tool-web";

// node_modules/@deepseek-ai/dsh-deepseek-chat-import/src/format.ts
import { z } from "zod";
var exportManifest = z.object({ export_format_version: z.number() });
var exportTime = z.string().transform((value, ctx) => {
  const time = parseExportTime(value);
  if (time === void 0) {
    ctx.addIssue({ code: "custom", message: "invalid timestamp" });
    return z.NEVER;
  }
  return time;
});
var exportSessionIndex = z.array(z.object({
  id: z.string().min(1),
  inserted_at: exportTime,
  updated_at: exportTime
}));
var fragmentEnvelope = z.looseObject({ type: z.string() });
var exportMessage = z.object({
  id: z.number().int().nonnegative(),
  parent_id: z.number().int().nonnegative().nullable(),
  role: z.enum(["USER", "ASSISTANT"]),
  status: z.string(),
  inserted_at: z.string(),
  fragments: z.array(fragmentEnvelope)
});
var exportSessionFile = z.object({
  id: z.string().min(1),
  title: z.string().nullable(),
  current_message_id: z.number().int().nonnegative().nullable().optional(),
  inserted_at: z.string(),
  messages: z.array(exportMessage)
});
var optionalText = z.string().nullable().optional();
var optionalStage = z.number().int().nullable().optional();
var searchResult = z.object({
  url: z.string(),
  title: optionalText,
  snippet: optionalText,
  published_at: optionalText
});
var readLinkResult = z.object({
  url: optionalText,
  title: optionalText
});
var fileEntry = z.object({
  id: z.string(),
  file_name: z.string(),
  /** Declared byte size, shown on the synthetic file card; an archive without it reports 0 bytes. */
  file_size: z.number().int().nonnegative().optional().default(0),
  is_image: z.boolean(),
  export_path: z.string().nullable()
});
var knownFragment = z.discriminatedUnion("type", [
  z.object({ type: z.literal("REQUEST"), content: z.string() }),
  z.object({ type: z.literal("RESPONSE"), content: z.string() }),
  z.object({ type: z.literal("THINK"), content: z.string(), elapsed_secs: z.number().nonnegative().nullable().optional() }),
  z.object({ type: z.literal("TEMPLATE_RESPONSE"), content: z.string() }),
  z.object({
    type: z.literal("TOOL_SEARCH"),
    queries: z.array(z.string()),
    results: z.array(searchResult),
    status: z.string().optional(),
    stage_id: optionalStage
  }),
  z.object({
    type: z.literal("TOOL_OPEN"),
    status: z.string(),
    url: z.string().nullable(),
    title: optionalText,
    stage_id: optionalStage
  }),
  z.object({ type: z.literal("TOOL_FIND"), status: z.string(), pattern: z.string().optional(), stage_id: optionalStage }),
  z.object({ type: z.literal("READ_LINK"), results: z.array(readLinkResult) }),
  z.object({ type: z.literal("TOOL_IMAGE_SEARCH"), status: z.string(), results: z.array(z.unknown()), stage_id: optionalStage }),
  z.object({ type: z.literal("PARTIAL_FILE_READ"), ratio: z.number() }),
  z.object({ type: z.literal("TIP"), content: z.string() }),
  z.object({ type: z.literal("FILE"), files: z.array(fileEntry) })
]);
var KNOWN_FRAGMENT_TYPES = new Set(knownFragment.options.map((option) => option.shape.type.value));
function parseKnownFragment(fragment2) {
  return KNOWN_FRAGMENT_TYPES.has(fragment2.type) ? knownFragment.parse(fragment2) : void 0;
}
function parseExportTime(value) {
  const time = Date.parse(value);
  return Number.isSafeInteger(time) && time >= 0 ? time : void 0;
}

// node_modules/@deepseek-ai/dsh-deepseek-chat-import/src/conversation.ts
var IMPORTED_MODEL_SOURCE = { provider: "deepseek-chat-export", model: "deepseek-chat-export" };
var FETCH_OUTPUT_CHARS = 4e3;
var SYNTHETIC_FILE_ID_PREFIX = "deepseek-chat-export:";
var UNFINISHED_STATUS_CODES = /* @__PURE__ */ new Map([
  ["FAILED", "DEEPSEEK_EXPORT_FAILED"],
  ["TIMEOUT", "DEEPSEEK_EXPORT_TIMEOUT"],
  ["CONTEXT_LENGTH_EXCEEDED", "DEEPSEEK_EXPORT_CONTEXT_LENGTH_EXCEEDED"],
  ["INCOMPLETE", "DEEPSEEK_EXPORT_INCOMPLETE"],
  ["WIP", "DEEPSEEK_EXPORT_WIP"]
]);
var ExportConversationError = class extends Error {
  name = "ExportConversationError";
};
function selectBranch(file) {
  const byId = /* @__PURE__ */ new Map();
  let newest;
  for (const message2 of file.messages) {
    if (byId.has(message2.id)) throw new ExportConversationError(`duplicate message id ${message2.id}`);
    byId.set(message2.id, message2);
    if (newest === void 0 || message2.id > newest.id) newest = message2;
  }
  if (newest === void 0) throw new ExportConversationError("conversation has no messages");
  const current = file.current_message_id;
  const selected = current === null || current === void 0 ? void 0 : byId.get(current);
  const chain = [];
  for (let message2 = selected ?? newest; ; ) {
    if (chain.length === byId.size) throw new ExportConversationError(`message ${message2.id} is part of a parent cycle`);
    chain.push(message2);
    if (message2.parent_id === null) return chain.reverse();
    const parent = byId.get(message2.parent_id);
    if (parent === void 0) throw new ExportConversationError(`message parent ${message2.parent_id} does not exist`);
    message2 = parent;
  }
}
function messageTime(message2) {
  const time = parseExportTime(message2.inserted_at);
  if (time === void 0) throw new ExportConversationError(`message ${message2.id} has an invalid inserted_at`);
  return time;
}
function convertConversation(file, options) {
  const chain = selectBranch(file);
  const log = new LogBuilder(options);
  const normalized = file.title === null ? "" : normalizeSessionTitle(file.title, options.maxTitleBytes);
  const title = normalized.length === 0 ? null : normalized;
  let turn = 0;
  let withdrawn = 0;
  for (let index = 0; index < chain.length; index++) {
    const user = chain[index];
    if (user.role !== "USER") continue;
    const next = chain[index + 1];
    const reply = next?.role === "ASSISTANT" ? next : void 0;
    if (reply !== void 0) index++;
    if (reply?.status === "CONTENT_FILTER") {
      withdrawn++;
      continue;
    }
    turn++;
    log.turn(turn, user, reply);
    if (turn === 1 && title !== null) {
      log.add({ type: "session/title", data: { title, messageSeqs: [], source: { kind: "user" } } });
    }
  }
  if (turn === 0) {
    throw new ExportConversationError(withdrawn === 0 ? "conversation has no user message" : "every question of the conversation was withdrawn by content filtering");
  }
  return { title, createdAt: log.events[0].time, events: log.events };
}
var LogBuilder = class {
  constructor(options) {
    this.options = options;
  }
  options;
  events = [];
  time = 0;
  add(event) {
    const seq = SessionSeq(this.events.length);
    this.events.push({ ...event, seq, time: this.time });
    return seq;
  }
  turn(turn, user, reply) {
    this.at(messageTime(user));
    this.add({ type: "turn/start", data: { turn } });
    let step = 1;
    this.add({ type: "step/start", data: { turn, step } });
    if (turn === 1) {
      const head = { id: MessageId(this.id()), role: "system", content: [], source: { kind: "system-prompt" } };
      this.add({ type: "system/message", data: { turn, step, message: head }, surfaceOp: "append" });
    }
    this.add({ type: "user/message", data: this.userMessage(user), surfaceOp: "append" });
    if (reply === void 0) {
      this.closeTurn(turn, step, failure("DEEPSEEK_EXPORT_NO_REPLY", "The export contains no reply to this message."));
      return;
    }
    this.at(messageTime(reply));
    const { steps, template } = this.replySteps(reply);
    const excluded = excludedReply(reply, template, steps.length);
    if (excluded !== void 0) {
      this.closeTurn(turn, step, { kind: "error", error: excluded });
      return;
    }
    for (const [position, { content, calls, elapsedMs }] of steps.entries()) {
      if (position > 0) {
        step++;
        this.add({ type: "step/start", data: { turn, step } });
      }
      this.time += elapsedMs;
      this.add({ type: "assistant/message", data: { turn, step, message: assistantMessage(this.id(), [...content, ...calls.map((call) => call.block)]), stream: [] }, surfaceOp: "append" });
      const callSeqs = calls.map(({ block }) => this.add({
        type: "tool/call",
        data: { turn, step, callId: block.id, name: block.name, arguments: block.arguments }
      }));
      for (const [callIndex, call] of calls.entries()) {
        this.add({
          type: "tool/result",
          data: { turn, step, message: toolResult(this.id(), call), ...call.meta === void 0 ? {} : { meta: call.meta } },
          surfaceOp: "append",
          // oxlint-disable-next-line typescript/no-non-null-assertion -- one call seq per call
          sourceEventSeqs: [callSeqs[callIndex]]
        });
      }
      if (position < steps.length - 1) this.add({ type: "step/end", data: { turn, step } });
    }
    this.closeTurn(turn, step, { kind: "completed" });
  }
  closeTurn(turn, step, reason) {
    this.add({ type: "step/end", data: { turn, step } });
    this.add({ type: "turn/end", data: { turn, reason } });
  }
  at(time) {
    this.time = Math.max(this.time, time);
  }
  id() {
    return this.options.createId();
  }
  userMessage(message2) {
    const attachments = [];
    const lines = [];
    for (const fragment2 of fragmentsOf(message2)) {
      if (fragment2.type === "REQUEST") {
        lines.push(fragment2.content);
      } else if (fragment2.type === "FILE") {
        for (const file of fragment2.files) {
          const image = file.is_image ? this.options.images?.get(file.id) : void 0;
          attachments.push(image === void 0 ? { type: "file", attachment: syntheticFileRef(file) } : { type: "image", attachment: image });
        }
      }
    }
    const text = lines.join("\n");
    const content = text.trim().length > 0 ? [...attachments, { type: "text", text }] : attachments.length > 0 ? attachments : [{ type: "text", text: "" }];
    return { id: MessageId(this.id()), role: "user", content, source: { kind: "user" } };
  }
  /**
   * Split one reply into steps. A tool fragment that carries a `stage_id`
   * starts a new step when it differs from the stage of the open step;
   * a step opened by text adopts the first stage it sees. Text after a tool
   * call starts a new step. Also reports the first server template.
   */
  replySteps(reply) {
    const steps = [];
    let template;
    let current = emptyStep();
    const pushStep = () => {
      if (current.content.length === 0 && current.calls.length === 0) return;
      steps.push(current);
      current = emptyStep();
    };
    const appendContent = (block) => {
      if (current.calls.length > 0) pushStep();
      current.content.push(block);
    };
    const appendCall = (call, stage) => {
      if (stage !== null) {
        if (current.stage !== null && stage !== current.stage) pushStep();
        current.stage = stage;
      }
      current.calls.push(call);
    };
    for (const fragment2 of fragmentsOf(reply)) {
      switch (fragment2.type) {
        case "THINK":
          if (fragment2.content.length > 0) appendContent({ type: "reasoning", text: fragment2.content });
          current.elapsedMs += Math.round((fragment2.elapsed_secs ?? 0) * 1e3);
          break;
        case "RESPONSE":
          if (fragment2.content.length > 0) appendContent({ type: "text", text: fragment2.content });
          break;
        case "TOOL_SEARCH": {
          if (fragment2.status === "WIP") break;
          const call = searchCall(this.id(), fragment2);
          if (call !== void 0) appendCall(call, fragment2.stage_id ?? null);
          break;
        }
        case "TOOL_OPEN": {
          const url = nonEmpty(fragment2.url);
          if (fragment2.status === "WIP" || url === void 0) break;
          appendCall(openCall(this.id(), fragment2, url), fragment2.stage_id ?? null);
          break;
        }
        case "READ_LINK": {
          const text = linkLines(fragment2.results);
          if (text !== void 0) appendContent({ type: "text", text });
          break;
        }
        case "TEMPLATE_RESPONSE":
          template ??= fragment2.content;
          break;
        // The website shows none of these as reply text: a page find, an image
        // search, a partial-read notice, and a tip leave no trace in the
        // imported reply, and the reasoning already carries what the model
        // took from them.
        case "TOOL_FIND":
        case "TOOL_IMAGE_SEARCH":
        case "PARTIAL_FILE_READ":
        case "TIP":
        case "REQUEST":
        case "FILE":
          break;
      }
    }
    pushStep();
    return { steps, template };
  }
};
function fragmentsOf(message2) {
  const fragments = [];
  for (const [index, envelope] of message2.fragments.entries()) {
    let fragment2;
    try {
      fragment2 = parseKnownFragment(envelope);
    } catch (error) {
      throw new ExportConversationError(`message ${message2.id} fragment ${index} (${envelope.type}) is malformed`, { cause: error });
    }
    if (fragment2 !== void 0) fragments.push(fragment2);
  }
  return fragments;
}
function excludedReply(reply, template, stepCount) {
  if (template !== void 0) return { code: "DEEPSEEK_EXPORT_TEMPLATE_RESPONSE", message: template };
  if (reply.status !== "FINISHED") {
    return {
      code: UNFINISHED_STATUS_CODES.get(reply.status) ?? "DEEPSEEK_EXPORT_UNFINISHED_REPLY",
      message: `The original reply ended with status ${JSON.stringify(reply.status)} and is excluded from the model context.`
    };
  }
  return stepCount === 0 ? { code: "DEEPSEEK_EXPORT_EMPTY_REPLY", message: "The original reply has no importable content." } : void 0;
}
function failure(code, message2) {
  return { kind: "error", error: { code, message: message2 } };
}
function syntheticFileRef(file) {
  const digest = createHash("sha256").update(`${SYNTHETIC_FILE_ID_PREFIX}${file.id}`).digest("hex");
  return { attachmentId: brandString(`sha256:${digest}`), name: fileDisplayName(file.file_name), bytes: file.file_size };
}
function fileDisplayName(name) {
  const leaf = name.slice(Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1);
  const clean = leaf.replace(/[\u0000-\u001f\u007f]/gu, "").trim();
  return clean.length === 0 ? "file" : clean;
}
function emptyStep() {
  return { content: [], calls: [], elapsedMs: 0, stage: null };
}
function linkLines(results) {
  const lines = [];
  for (const result of results) {
    const url = nonEmpty(result.url);
    const title = nonEmpty(result.title);
    if (url !== void 0) lines.push(`[${title ?? url}](${url})`);
    else if (title !== void 0) lines.push(title);
  }
  return lines.length === 0 ? void 0 : lines.join("\n");
}
function assistantMessage(id, content) {
  return { id: MessageId(id), role: "assistant", content, source: { kind: "model", ...IMPORTED_MODEL_SOURCE } };
}
function toolResult(id, call) {
  return {
    id: MessageId(id),
    role: "tool",
    content: call.result,
    isError: call.isError,
    source: { kind: "tool", callId: call.block.id },
    toolCallId: call.block.id
  };
}
function searchCall(id, fragment2) {
  const queries = fragment2.queries.filter((query) => query.trim().length > 0);
  const block = { type: "tool-call", id: ToolCallId(id), name: "web_search", arguments: JSON.stringify({ queries }) };
  if (fragment2.status === "FAILED") {
    return { block, result: [{ type: "text", text: "Error: the export records this search as failed." }], isError: true };
  }
  if (queries.length === 0) return void 0;
  const result = {
    sources: fragment2.results.map((source) => {
      const title = nonEmpty(source.title);
      const snippet = nonEmpty(source.snippet);
      const publishedAt = nonEmpty(source.published_at);
      return {
        url: source.url,
        ...title === void 0 ? {} : { title },
        ...snippet === void 0 ? {} : { snippet },
        ...publishedAt === void 0 ? {} : { publishedAt }
      };
    }),
    truncated: false
  };
  return {
    block,
    result: [{ type: "text", text: formatSearchOutput(result) }],
    isError: false,
    meta: searchMetaFromValue(result)
  };
}
function openCall(id, fragment2, url) {
  const block = { type: "tool-call", id: ToolCallId(id), name: "web_fetch", arguments: JSON.stringify({ url }) };
  if (fragment2.status !== "FINISHED") {
    return { block, result: [{ type: "text", text: "Error: the page could not be opened." }], isError: true };
  }
  const title = nonEmpty(fragment2.title);
  const notice = "The page content is not included in the DeepSeek chat export.";
  const value = {
    url,
    statusCode: 200,
    truncated: false,
    body: { kind: "text", content: title === void 0 ? notice : `${title}

${notice}` }
  };
  return {
    block,
    result: [{ type: "text", text: formatFetchOutput(value, FETCH_OUTPUT_CHARS) }],
    isError: false,
    meta: fetchMetaFromValue(value, FETCH_OUTPUT_CHARS)
  };
}
function nonEmpty(value) {
  return value === null || value === void 0 || value.trim().length === 0 ? void 0 : value;
}

// src/source.ts
import { z as z2 } from "zod";
var fragment = z2.looseObject({ type: z2.string(), content: z2.string().optional() });
var message = z2.looseObject({
  message_id: z2.number().int(),
  parent_id: z2.number().int().nullable(),
  role: z2.enum(["USER", "ASSISTANT"]),
  status: z2.string(),
  inserted_at: z2.number(),
  fragments: z2.array(fragment)
});
var conversation = z2.looseObject({
  key: z2.string(),
  title: z2.string().nullable(),
  messages: z2.array(message),
  current_message_id: z2.number().nullable().optional()
});
function exportFormat(source) {
  return {
    id: source.key,
    title: source.title,
    current_message_id: source.current_message_id,
    inserted_at: new Date((source.messages[0]?.inserted_at ?? 0) * 1e3).toISOString(),
    messages: source.messages.map((m) => ({
      id: m.message_id,
      parent_id: m.parent_id,
      role: m.role,
      status: m.status,
      inserted_at: new Date(m.inserted_at * 1e3).toISOString(),
      fragments: m.fragments.map((f) => {
        if (f.type === "SEARCH" || f.type === "TOOL_SEARCH") {
          const search = z2.looseObject({ queries: z2.array(z2.union([z2.string(), z2.object({ query: z2.string() })])).default([]), results: z2.array(z2.looseObject({ published_at: z2.union([z2.number(), z2.string()]).nullable().optional() })) }).parse(f);
          return { ...search, type: "TOOL_SEARCH", queries: search.queries.map((q) => typeof q === "string" ? q : q.query), results: search.results.map((r) => ({ ...r, published_at: typeof r.published_at === "number" ? new Date(r.published_at * 1e3).toISOString() : r.published_at })) };
        }
        if (f.type === "TOOL_OPEN") {
          const open = z2.looseObject({ result: z2.object({ url: z2.string(), title: z2.string().nullable().optional() }).nullable().optional() }).parse(f);
          return { ...f, url: open.result?.url ?? null, title: open.result?.title ?? null };
        }
        if (f.type === "FILE") {
          const files = z2.object({ files: z2.array(z2.looseObject({ id: z2.string(), file_name: z2.string(), is_image: z2.boolean().optional() })) }).parse(f);
          return { ...f, files: files.files.map((file) => ({ ...file, is_image: file.is_image ?? false, export_path: null })) };
        }
        return f;
      })
    }))
  };
}

// src/import.ts
async function importConversation(source, workspace, persistence, cache, signal) {
  signal.throwIfAborted();
  const conversion = convertConversation(exportSessionFile.parse(exportFormat(source)), {
    createId: randomUUID,
    maxTitleBytes: 80
  });
  const id = brandString2(randomUUID());
  const header = { version: SESSION_FORMAT_VERSION, id, createdAt: conversion.createdAt, cwd: workspace.path, isSeeded: false };
  Session.create(id, conversion.events, header);
  const handle = await persistence.create(header, { signal });
  try {
    await handle.append(conversion.events, { signal });
    await handle.flush({ signal });
  } finally {
    await handle.close();
  }
  cache?.coldSnapshot(header, brandNumber(0), conversion.events);
  await workspace.attachSession(id);
  return { sessionId: id, title: conversion.title };
}
export {
  importConversation
};
//# sourceMappingURL=import.js.map
