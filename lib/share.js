// src/share.ts
import { chromium } from "playwright";
import { z as z2 } from "zod";

// src/source.ts
import { z } from "zod";
var fragment = z.looseObject({ type: z.string(), content: z.string().optional() });
var message = z.looseObject({
  message_id: z.number().int(),
  parent_id: z.number().int().nullable(),
  role: z.enum(["USER", "ASSISTANT"]),
  status: z.string(),
  inserted_at: z.number(),
  fragments: z.array(fragment)
});
var conversation = z.looseObject({
  key: z.string(),
  title: z.string().nullable(),
  messages: z.array(message),
  current_message_id: z.number().nullable().optional()
});
function unwrap(value) {
  const response = z.object({ code: z.number(), msg: z.string(), data: z.object({
    biz_code: z.number(),
    biz_msg: z.string(),
    biz_data: z.unknown()
  }).nullable().optional() }).parse(value);
  if (response.code !== 0 || response.data?.biz_code !== 0) {
    throw new Error(response.data?.biz_msg || response.msg || "DeepSeek \u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF0C\u8BF7\u786E\u8BA4\u5206\u4EAB\u94FE\u63A5\u6709\u6548\u3002");
  }
  return response.data.biz_data;
}
function shareId(input) {
  const url = new URL(input);
  const match = /^\/share\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname);
  if (url.origin !== "https://chat.deepseek.com" || !match) throw new Error("\u8BF7\u8F93\u5165 https://chat.deepseek.com/share/\u2026 \u94FE\u63A5\u3002");
  return match[1];
}

// src/share.ts
async function readShare(url, signal) {
  const id = shareId(url);
  signal.throwIfAborted();
  const browser = await chromium.launch({ headless: true });
  const cancel = () => {
    void browser.close();
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    const page = await browser.newPage();
    await page.goto("https://chat.deepseek.com", { waitUntil: "domcontentloaded" });
    const response = await page.evaluate(async (id2) => {
      const response2 = await fetch(`https://chat.deepseek.com/api/v0/share/content?share_id=${encodeURIComponent(id2)}`, { credentials: "omit" });
      return { status: response2.status, body: await response2.text() };
    }, id);
    signal.throwIfAborted();
    if (response.status !== 200) throw new Error(`DeepSeek HTTP ${response.status}\uFF0C\u8BF7\u786E\u8BA4\u5206\u4EAB\u94FE\u63A5\u6709\u6548\uFF0C\u9650\u6D41\u65F6\u7A0D\u540E\u91CD\u8BD5\u3002`);
    let value;
    try {
      value = JSON.parse(response.body);
    } catch {
      throw new Error("DeepSeek \u8FD4\u56DE\u4E86\u975E JSON \u9875\u9762\uFF0C\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u6B64\u5206\u4EAB\u94FE\u63A5\u3002");
    }
    const source = z2.looseObject({ title: z2.string().nullable(), messages: conversation.shape.messages }).parse(unwrap(value));
    const title = source.title === "Shared Conversation" ? source.messages.find((m) => m.role === "USER")?.fragments.find((f) => f.type === "REQUEST")?.content ?? source.title : source.title;
    return conversation.parse({ ...source, title, key: `share:${id}` });
  } finally {
    signal.removeEventListener("abort", cancel);
    await browser.close();
  }
}
export {
  readShare
};
//# sourceMappingURL=share.js.map
