# dsh · DeepSeek 分享对话导入

DeepSeek Harness 原生插件：粘贴公开分享链接，转换为本地 DSH Session，然后在 DSH 中继续聊天。

## 安装和使用

需要 Node.js 24+ 和 DSH 0.2.2 预览版。在 DSH 的「插件 → 添加插件」中输入发行包 URL 并启用：

```text
https://github.com/Q3yp/dsh-plugin-deepseek-share-import/releases/download/v0.1.0/dsh-plugin-deepseek-share-import-0.1.0.tgz
```

在 DSH 所在的机器安装无头浏览器：

```sh
dsh plugin --profile desktop exec playwright install chromium
```

Web profile 将 `desktop` 改为 `web`。浏览器只在导入时运行，不需要图形桌面或登录。

也可启用「插件 → 实验性插件 → 自定义插件索引」，在「发现」中添加：

```text
https://raw.githubusercontent.com/Q3yp/dsh-plugin-deepseek-share-import/main/market/index.json
```

## 本地开发

```sh
git clone https://github.com/Q3yp/dsh-plugin-deepseek-share-import.git
cd dsh-plugin-deepseek-share-import
npm ci
npm run browser:install
npm pack
```

仓库包含预构建的 `lib/`，Git 安装不需要运行构建脚本。

## 导入对话

点击侧栏「新建会话」旁的导入按钮，粘贴 `https://chat.deepseek.com/share/…`，选择目标工作区，点击「导入为本地会话」。完成后从侧栏打开该会话继续聊天。

每次导入创建一个独立 Session，之后由 DSH 管理。用户提问、回答、公开的思考片段、搜索记录和代码块进入原生会话；文件和图片显示引用卡片，不下载附件二进制。消息树沿分享数据中的当前分支导入。

## 实现

- `src/share.ts`：在一次性的无头 Chromium 中匿名读取公开分享接口，完成或取消后关闭浏览器。
- `src/source.ts`：校验网页数据，并适配官方消息转换格式。
- `src/import.ts`：复用官方 `convertConversation`，通过原生 Session 校验、持久化和工作区服务创建本地会话。
- `src/index.ts`：Cordis Host 插件及 owner-only 导入路由。
- `src/client.tsx`：侧栏导入弹窗，支持 Web Fetch 和 Desktop 的 `__DSH_TRANSPORT__`。

导入过程不读取账号令牌、不保存浏览器资料，也不创建额外归档或同步状态。Session 使用 DSH Host 现有的存储后端。插件只向 DeepSeek 读取分享内容。

消息转换器固定使用 [`@deepseek-ai/dsh-deepseek-chat-import` 0.2.2-rc.3](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/experimental/deepseek-chat-import) 的纯转换模块，构建时编译进插件。网页接口变更、分享失效或限流时，面板显示错误。

## 验证

已使用真实公开分享 `h2m965ycfclrbprp0z` 读取 10 条消息并写入真实 DSH JSONL 存储；保留 5 条用户消息和 4 个 reasoning block，通过 DSH 原生 Session 校验。Connection Fetch 路由仅允许 owner 导入。完整 DSH GUI 的交互尚未验证。
