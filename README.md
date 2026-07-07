# Mini Remotion + Agent

一个**可编程视频**实验项目：用 React 描述画面，用 Node 逐帧截图合成 mp4，再用 TypeScript Agent 把「自然语言 → 可编辑时间轴 → 成片」串成完整链路。

它由两大模块共同构成，共用同一套渲染内核：

| 模块 | 是什么 | 解决什么问题 |
|------|--------|--------------|
| **Mini Remotion** | 精简版 Remotion 运行时 + Node 渲染引擎 | 用代码/JSON 表达视频，确定性逐帧渲染，支持预览与导出 |
| **Agent（Harness）** | LLM 编排的状态机流水线 | 用一句话生成视频，或在编辑器里用自然语言改项目 |

**核心思想**：视频 = 一个「当前帧号」可被外部控制的 React 应用。同一帧 + 同一 props → 永远同样画面，因此可以随意 seek、并发截图、离线混音。

---

## Mini Remotion 与 Agent 如何协同

两者不是两个独立项目，而是**同一技术栈上的两层**：

```
┌──────────────────────────────────────────────────────────────────┐
│                         你的使用入口                               │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ 可视化编辑器  │ 经典 Studio   │  CLI 渲染    │  Agent CLI 一键生成   │
│ npm run dev  │ ?studio=1    │ npm run render│ npm run agent       │
│ + 编辑器 Agent│              │              │                     │
└──────┬───────┴──────┬───────┴──────┬───────┴──────────┬──────────┘
       │              │              │                  │
       │   EditorProject JSON       │            Generated TSX
       │   compositions + props     │            + draft.json
       └──────────────┴──────────────┴──────────────────┘
                              │
                    React 画面层 (src/)
              frame + props → 像素（预览 / Headless）
                              │
                    Engine + Render (engine/ + render/)
         Vite 站点 · Puppeteer 截图 · Offthread 抽帧 · FFmpeg 编码混音
                              │
                    Agent Harness (harness/)
              分镜 · 生图 · 写代码 · 校验 · 质检 · 失败重试 · 成本追踪
```

### Mini Remotion 负责「画面与渲染」

- **运行时**（`src/core/`）：`useCurrentFrame`、`Sequence`、`<Audio>` / `<Video>` / `<OffthreadVideo>`、音量曲线、媒体资产登记等 Remotion 核心原语
- **表达层**：代码 composition（`src/video/`）、草稿 JSON（`src/draft/`）、编辑器多轨道模型（`src/editor/`）
- **渲染层**（`render/` + `engine/`）：拉起 Vite、Puppeteer 逐帧截图、FFmpeg 抽帧/抽轨/混音，输出 mp4

### Agent 负责「理解与编排」

Agent 有两条路径，能力互补：

| 路径 | 入口 | 输入 | 输出 | 典型场景 |
|------|------|------|------|----------|
| **流水线 Agent** | `npm run agent` | 一句视频描述 | `current.tsx` + `draft.json` + mp4 | 从零生成成片 |
| **编辑器 Agent** | 编辑器右侧对话面板 | 自然语言 + 当前 `EditorProject` | JSON Patch diff，接受/拒绝 | 改标题动画、移动旁白、调时长 |

流水线 Agent 走完整状态机（分镜 → 生图 → 写 React → 校验 → 低清预览 → 全量渲染 → 质检）。  
编辑器 Agent 在已有项目上产出**增量补丁**，不重新跑整条流水线。

两者最终都落到 **Mini Remotion 的 React 树 + 渲染引擎** 上——Agent 生成代码或 JSON，引擎负责把每一帧画对。

---

## 快速开始

### 依赖

| 依赖 | 用途 |
|------|------|
| Node.js 18+ | 运行时 |
| [FFmpeg](https://ffmpeg.org/) | 编码、抽帧、混音（`brew install ffmpeg`） |
| Puppeteer | CLI / Agent 导出截图（已在 `devDependencies`） |

### 安装

```bash
cd mini-remotion
npm install
npm run make-audio    # 可选：public/audio.mp3
npm run make-video    # 可选：public/sample.mp4
npm run dev           # → http://localhost:5173（默认可视化编辑器）
```

经典 Studio：`http://localhost:5173/?studio=1`

### 30 秒导出第一个视频

```bash
# 终端 A
npm run dev

# 终端 B
npm run render -- --comp CodeDemo --out out/video.mp4
```

### Agent 环境（可选）

```bash
cp .env.example .env
# 填入 DEEPSEEK_API_KEY、ARK_API_KEY 等；无 key 时走 stub 规则模式
```

---

## 五种使用方式

### 1. 可视化编辑器（默认）

`npm run dev` 打开多轨道剪辑界面：

| 区域 | 功能 |
|------|------|
| **素材库** | 导入/添加视频、文字、贴纸、音频；自动探测媒体时长 |
| **预览** | 声音主时钟驱动时间轴，画面跟随渲染；播放 / 逐帧 / 拖动 |
| **检查器** | 位置、缩放、时长、原声开关、动画、特效 |
| **时间轴** | 多轨道片段、选中、分割、删除、撤销/重做 |
| **Agent 面板** | 自然语言修改项目，查看 diff，接受或拒绝 |

内置动画：淡入、左/右滑入、弹簧放大、弹入  
内置特效：模糊入场、黑白、暗角、呼吸缩放  

项目自动保存到 `localStorage`；「导出」下载 `project.json`；「重置项目」恢复示例。

> 编辑器项目导出 mp4 尚在完善中；当前可导出 JSON，或用 Agent CLI 生成 composition 后 `npm run render`。

### 2. 编辑器内 Agent（对话式改片）

在编辑器右侧输入指令，例如：

- `标题改成弹入`
- `旁白后移 1 秒`

无 API Key 时走规则 stub；配置 LLM 后由 `harness/editor/agent.ts` 理解更复杂意图，返回 `EditorPatch`，经 `apply-patch.ts` 应用到 `EditorProject`。

API：`POST /api/editor/agent`（Vite 中间件，见 `harness/editor/api-handler.ts`）。

### 3. 经典 Studio

`?studio=1` — composition 列表 + Zod props 表单，适合调试单个 composition。

快捷键：`空格` 播放/暂停，`←` `→` 逐帧。

### 4. CLI 手动渲染

```bash
npm run render -- --comp <id> --out out/video.mp4
npm run render -- --comp CodeDemo --out out/video.mp4 --concurrency 4
npm run render -- --comp CodeDemo --out out/custom.mp4 \
  --props '{"titleText":"Hello","starCount":90}'
```

CI 无 dev server 时：

```bash
MINI_REMOTION_RENDER_MODE=bundle npm run render -- --comp CodeDemo --out out/video.mp4
```

### 5. Agent CLI 一键生成（文本 → 视频）

```bash
# stub，无需 API key
MINI_REMOTION_PROVIDER=stub npm run agent -- "星空背景,标题弹入"

# DeepSeek
npm run agent -- "蓝色渐变产品开场"

# 旁白 + 模板 + 预算
npm run agent -- "产品发布" --narration "欢迎来到发布会" --template countdown --max-budget 0.5

# 只生成代码与校验，不渲染
npm run agent -- "测试" --no-render
```

| 选项 | 说明 |
|------|------|
| `--out <path>` | 输出 mp4（默认 `out/agent-video.mp4`） |
| `--narration <text>` | 旁白（macOS `say` 合成） |
| `--no-tts` / `--no-images` / `--no-render` | 跳过 TTS / 生图 / 渲染 |
| `--concurrency <n>` | Chromium 并发段数 |
| `--max-retries <n>` | 最大重试（默认 3） |
| `--min-quality <0-1>` | 最低质量分（默认 0.5） |
| `--max-budget <usd>` | LLM + 图像费用上限 |
| `--no-cache` / `--no-preview` | 禁用缓存 / 跳过低清预览 |
| `--template <id>` | `intro-main-outro` \| `title-slide` \| `countdown` |
| `--distributed` | 分布式帧队列 |
| `--vision-qa` | Vision LLM 语义质检 |

**Agent 产物**：

| 路径 | 内容 |
|------|------|
| `src/generated/current.tsx` | 生成的 React 视频组件 |
| `src/generated/draft.json` | 草稿层 JSON（可选编辑路径） |
| `out/agent-video.mp4` | 最终视频 |
| `out/agent-manifest.json` | 运行摘要 |

生成后可用 `npm run render -- --comp GeneratedVideo` 重新导出。

---

## Composition 清单

注册表：`src/compositions.tsx`。

| ID | 来源 | 说明 | 前置 |
|----|------|------|------|
| `DraftDemo` | 草稿层 | JSON → `DraftRenderer` | — |
| `CodeDemo` | 示例 | Zod props + 动画演示 | `make-audio` |
| `AudioFadeDemo` | 示例 | 音量曲线淡入淡出 | `make-audio` |
| `VideoDemo` | 示例 | Offthread 抽帧 + 视频音轨 | `make-video` |
| `GeneratedVideo` | Agent | `src/generated/current.tsx` | 先 `npm run agent` |
| `AgentDraft` | Agent | `src/generated/draft.json` | 先 `npm run agent` |

---

## 架构详解

### 三层分工

```
Harness (harness/)     状态机、LLM、生图、质检、失败恢复、编辑器 Agent API
        ↓ import
Engine (engine/ + render/)   站点就绪、校验、截图池、Offthread 代理、FFmpeg
        ↓ 加载 React
React (src/)           帧驱动画面：frame + props → 像素
```

### 画面四层（React 侧）

| 层 | 职责 | 关键路径 |
|----|------|---------|
| ① 草稿层 | 纯 JSON，可 Agent 导出 | `src/draft/` |
| ② 数据层 | `frame → 画面` | `src/core/`, `src/editor/` |
| ③ 渲染层 | React 树 → 像素 | `Preview.tsx`, `Headless.tsx`, `render/pipeline.ts` |
| ④ 驱动层 | 当前帧号 | 编辑器 `PreviewTransport`、Studio `usePlayer`、导出 `__miniRemotionSetFrame` |

**预览播放（编辑器）**：采用专业剪辑器常用的**声音主时钟**方案——`<audio>` 连续播放驱动全局帧号，`<video>` 静音并按帧 seek 跟画（`src/core/preview-transport.tsx`）。

**导出**：Puppeteer 调用 `window.__miniRemotionSetFrame(n)` 逐帧推进，与预览解耦。

### CLI 渲染流程

```
npm run render
  ├─ ensureRenderSite()           dev :5173 或 bundle :4173
  ├─ ensureOffthreadServer()      FFmpeg 抽帧代理 :3199
  ├─ scheduleFrames() + chromium-pool   并行截图
  │    └─ 每帧 setFrame → screenshot → collectAssets()
  └─ encodeVideo()
       ├─ PNG → H.264
       ├─ prepareAudioTracks()    抽轨 + 音量曲线预处理
       └─ mergeAudioTracks()      adelay + amix → 最终 mp4
```

### 媒体管线

**画面（Offthread，推荐）**

```
<OffthreadVideo> → GET /proxy?src=&time= → FFmpeg 抽 PNG → <Img> → 截图
```

**声音**

```
<Audio> / <Video> 登记 RenderAsset → prepareAudioTracks → mergeAudioTracks
```

| 组件 | 预览 | 导出 |
|------|------|------|
| `<OffthreadVideo>` | `<video>` + 音轨分离 | FFmpeg 抽帧 + 视频音轨混流 |
| `<Video>` | 音画分离，声音主时钟 | 浏览器 seek + 截图 |
| `<Audio>` | 隐藏 `<audio>`，可作主时钟 | 登记音轨，支持 `volume={(f) => ...}` |

### 流水线 Agent 状态机

```
User Prompt
  → TIMELINE_PLAN      分镜 JSON（LLM / 模板）
  → ASSET_GEN          Seedream 生图 → public/generated/
  → COMPOSE            生成 React TSX
  → VALIDATE           tsc + 冒烟
  → PREVIEW_CHECK      低清抽帧质检
  → FRAME_SCHEDULE → CHROMIUM_POOL → FFMPEG
  → QUALITY_CHECK      ffprobe + 视觉 QA + Vision LLM（可选）
  → OUTPUT
```

失败时 `failure-router.ts` 按类型回退到不同阶段重试。实现：`harness/state-machine.ts`。

### Headless 桥接 API

| Window API | 用途 |
|------------|------|
| `__miniRemotionSetFrame(n)` | 驱动当前帧 |
| `__miniRemotionMeta` | 宽高 / fps / 总帧数 |
| `__miniRemotionReady` | `delayRender` 计数为 0 |
| `__miniRemotionCollectAssets()` | 媒体资产清单 |
| `__miniRemotionProxyPort` | Offthread 代理端口 |

---

## 项目结构

```
mini-remotion/
├── src/                         # React 画面层（Mini Remotion）
│   ├── core/                    # 运行时：帧、Sequence、媒体组件、PreviewTransport
│   ├── editor/                  # 可视化编辑器 + EditorProject 模型
│   ├── draft/                   # 草稿层 JSON
│   ├── video/                   # 示例 composition
│   ├── render/                  # Preview + Headless 桥接
│   ├── generated/               # Agent 输出 (current.tsx, draft.json)
│   ├── compositions.tsx
│   └── main.tsx                 # 默认 Editor；?studio=1 / ?headless=1
│
├── render/                      # Node 渲染管线
│   ├── pipeline.ts              # 截图 + FFmpeg 主编排
│   ├── offthread/               # FFmpeg 抽帧 HTTP 代理
│   ├── audio/                   # 抽轨、预处理、混流
│   └── queue/                   # 分布式帧队列
│
├── engine/                      # 引擎封装（CLI / Agent 共用）
│   ├── dev-server.ts, bundle.ts, validate.ts, render-job.ts
│   └── tts/                     # macOS say / noop
│
├── harness/                     # Agent（Harness）
│   ├── state-machine.ts         # 流水线 Agent 主循环
│   ├── cli.ts                   # npm run agent
│   ├── editor/                  # 编辑器 Agent API + stub + LLM
│   ├── timeline/, composition/, assets/, quality/, cache/, cost/
│   └── failure-router.ts
│
├── config/env.ts
├── scripts/                     # make-audio, make-video
├── public/                      # 静态资源
└── out/                         # 渲染输出（gitignore）
```

---

## 环境变量

完整示例：`.env.example`。

| 变量 | 说明 |
|------|------|
| `MINI_REMOTION_PROVIDER` | `stub` \| `deepseek` \| `openai` |
| `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` | LLM API |
| `ARK_API_KEY` | 火山方舟 Seedream 生图 |
| `MINI_REMOTION_RENDER_MODE=bundle` | CI 用预构建站点 |
| `MINI_REMOTION_DISTRIBUTED_QUEUE=1` | 分布式帧队列 |
| `MINI_REMOTION_VISION_QA=1` | Vision LLM 语义质检 |
| `MAX_BUDGET_USD` | Agent 费用上限 |

---

## npm scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 可视化编辑器（Vite :5173） |
| `npm run build` | 生产构建 |
| `npm run render` | CLI 导出 mp4 |
| `npm run agent` | 流水线 Agent：文本 → 视频 |
| `npm run make-audio` / `make-video` | 生成示例素材 |
| `npm run queue:worker` | 分布式队列 worker |
| `npm run engine:validate` | tsc + 冒烟测试 |

---

## 与真实 Remotion 的对应

| Mini Remotion | 真实 Remotion |
|---------------|---------------|
| `useCurrentFrame` | `packages/core/src/use-current-frame.ts` |
| `Sequence` | `packages/core/src/Sequence.tsx` |
| `delayRender` | `packages/core/src/delay-render.ts` |
| `RenderAssetManager` | collectAssets |
| `OffthreadVideo` + `/proxy` | offthread-video-server |
| `preprocess-track` + `merge-tracks` | preprocess-audio-track + merge-audio-track |
| 编辑器 `EditorProject` | Editor Starter 方向 |
| Harness Agent | 无官方等价物（自研编排层） |

---

## 路线图与已知限制

- 编辑器项目 **一键导出 mp4**（EditorProject → Headless）待完善
- 时间轴 **拖拽** 改位置/时长待完善
- 编辑器 Agent **多轮对话记忆** 依赖面板会话，未持久化到服务端
- `blob:` 本地导入素材仅预览可用，Node 渲染需换为 `public/` 路径

本项目定位是 **Remotion 原理教学 + Agent 视频生产实验**，欢迎在此基础上扩展。
