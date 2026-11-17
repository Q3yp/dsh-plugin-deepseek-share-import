window.__ModuleLoader__.load({id:"dsh-plugin-deepseek-share-import",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "sessions"];
async function request(body, signal) {
  const transport = window.__DSH_TRANSPORT__;
  const send = transport?.fetch?.bind(transport) ?? window.fetch.bind(window);
  const response = await send("./api/deepseek-share-import", body === void 0 ? { signal } : {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  if (response.status === 403) throw new Error("\u4EC5 DSH \u6240\u6709\u8005\u53EF\u4EE5\u5BFC\u5165\u5BF9\u8BDD\u3002");
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || `\u5BFC\u5165\u8BF7\u6C42\u5931\u8D25\uFF1A${response.status}`);
  return data;
}
function Action({ children, refresh }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    children,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", title: "\u4ECE DeepSeek \u5206\u4EAB\u94FE\u63A5\u5BFC\u5165", "aria-label": "\u4ECE DeepSeek \u5206\u4EAB\u94FE\u63A5\u5BFC\u5165", onClick: () => setOpen(true), style: { background: "none", border: 0, color: "inherit", cursor: "pointer", padding: 8 }, children: "\u21A7" }),
    open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportDialog, { refresh, close: () => setOpen(false) })
  ] });
}
function ImportDialog({ refresh, close }) {
  const [workspaces, setWorkspaces] = (0, import_react.useState)([]);
  const [workspaceId, setWorkspaceId] = (0, import_react.useState)("");
  const [url, setUrl] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [message, setMessage] = (0, import_react.useState)("");
  const [done, setDone] = (0, import_react.useState)(false);
  const controller = (0, import_react.useRef)(new AbortController());
  const dialog = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const current = new AbortController();
    controller.current = current;
    dialog.current?.showModal();
    void request(void 0, current.signal).then((value) => {
      setWorkspaces(value.workspaces);
      setWorkspaceId(value.workspaces[0]?.id ?? "");
    }).catch((error) => {
      if (!current.signal.aborted) setMessage(String(error));
    });
    return () => {
      current.abort();
    };
  }, []);
  const run = async () => {
    setBusy(true);
    setMessage("\u6B63\u5728\u8BFB\u53D6\u5206\u4EAB\u5BF9\u8BDD\u5E76\u521B\u5EFA\u672C\u5730 Session\u2026");
    try {
      const { result } = await request({ url, workspaceId }, controller.current.signal);
      setDone(true);
      setMessage(`\u5DF2\u5BFC\u5165\u300C${result.title ?? "DeepSeek \u5BF9\u8BDD"}\u300D\uFF0C\u53EF\u4ECE\u4FA7\u680F\u6253\u5F00\u7EE7\u7EED\u804A\u5929\u3002`);
      await refresh().catch((error) => setMessage((previous) => `${previous}
\u5237\u65B0\u4F1A\u8BDD\u5217\u8868\u5931\u8D25\uFF1A${String(error)}`));
    } catch (error) {
      if (!controller.current.signal.aborted) setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (!controller.current.signal.aborted) setBusy(false);
    }
  };
  const button = { padding: "9px 14px", border: "1px solid #8886", borderRadius: 8, cursor: "pointer", color: "inherit", background: "transparent" };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dialog", { ref: dialog, onCancel: close, "aria-labelledby": "dsh-import-title", style: { color: "inherit", background: "var(--color-bg, Canvas)", border: "1px solid #8885", borderRadius: 16, padding: 24, width: 480, maxWidth: "calc(100vw - 40px)" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: "dsh-import-title", style: { fontSize: 19, margin: 0 }, children: "\u5BFC\u5165 DeepSeek \u5206\u4EAB\u5BF9\u8BDD" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: button, onClick: close, "aria-label": "\u5173\u95ED", children: "\xD7" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { opacity: 0.65, fontSize: 13 }, children: "\u7C98\u8D34\u516C\u5F00\u5206\u4EAB\u94FE\u63A5\uFF0C\u8F6C\u6210\u672C\u5730\u4F1A\u8BDD\u540E\u63A5\u7740\u804A\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: (e) => {
      e.preventDefault();
      void run();
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "grid", gap: 8 }, children: [
        "\u516C\u5F00\u5206\u4EAB\u94FE\u63A5",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "url", required: true, placeholder: "https://chat.deepseek.com/share/\u2026", value: url, disabled: busy || done, onChange: (e) => setUrl(e.target.value), style: { padding: 10, border: "1px solid #8886", borderRadius: 8, color: "inherit", background: "transparent" } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "grid", gap: 8, margin: "20px 0" }, children: [
        "\u76EE\u6807\u5DE5\u4F5C\u533A",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { disabled: busy || done, value: workspaceId, onChange: (e) => setWorkspaceId(e.target.value), style: { padding: 10, color: "inherit", background: "transparent", borderRadius: 8 }, children: workspaces.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: w.id, children: w.path }, w.id)) })
      ] }),
      workspaces.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u8BF7\u5148\u5728 DSH \u4E2D\u6DFB\u52A0\u4E00\u4E2A\u5DE5\u4F5C\u533A\u3002" }),
      done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: button, onClick: close, children: "\u5B8C\u6210" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: button, disabled: busy || !workspaceId, children: busy ? "\u6B63\u5728\u5BFC\u5165\u2026" : "\u5BFC\u5165\u4E3A\u672C\u5730\u4F1A\u8BDD" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", style: { whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto", fontSize: 13 }, children: message })
  ] });
}
function apply(ctx) {
  ctx.slots.inject("sidebar.session.action", () => ctx.slots.register({
    name: "sidebar.session.action",
    id: "deepseek-share-import",
    inject: () => ({ refresh: () => ctx.sessions.refresh() })
  }, Action));
}

return module.exports;}});
