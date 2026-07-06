# Mini Remotion

极简 [Remotion](https://www.remotion.dev/) 教学实现 + **Enhanced Video Agent**：用 React 描述画面，用 Node 逐帧截图合成视频，用 TypeScript 状态机把「文本 → 视频」整条流水线编排起来。

```
┌─────────────────────────────────────────────────────────────┐
│  Harness (harness/)     状态机、LLM 编排、质检、失败恢复、成本调度   │
└───────────────────────────────┬─────────────────────────────┘
                                │ import engine / render
┌───────────────────────────────▼─────────────────────────────┐
│  Engine (engine/ + render/)  校验、截图、FFmpeg、TTS、Bundle  │
└───────────────────────────────┬─────────────────────────────┘
                                │ 加载 React composition
┌───────────────────────────────▼─────────────────────────────┐
│  React (src/)            帧驱动画面：frame → 像素              │
└─────────────────────────────────────────────────────────────┘
```

**核心思想**：视频 = 一个「当前帧号」可被外部控制的 React 应用；渲染 = 逐帧截图 + FFmpeg 编码。同一帧 + 同一 props 永远得到同样画面 → 可随意 seek、可并发渲染。

---

## 快速开始

### 依赖

- Node.js 18+
- [FFmpeg](https://ffmpeg.org/)（`brew install ffmpeg`）
- 导出视频需 Puppeteer（已列入 `devDependencies`）

### 安装与预览

```bash
cd mini-remotion
npm install
npm run make-audio    # 可选：生成 public/audio.mp3
npm run make-video    # 可选：生成 public/sample.mp4（VideoDemo 需要）
npm run dev           # http://localhost:5173
```

Studio 快捷键：`空格` 播放/暂停，`←` `→` 逐帧。

### 环境配置（Agent / 生图 / TTS）

```bash
cp .env.example .env
# 编辑 .env，至少按需填入 DEEPSEEK_API_KEY、ARK_API_KEY 等
```

---

## 三种使用方式

### 1. Studio 预览（开发画面）

在浏览器里实时预览 composition，调 props、拖时间轴。

| Composition | 说明 |
|-------------|------|
| `DraftDemo` | 草稿层 JSON → `DraftRenderer` 翻译为 React |
| `CodeDemo` | 纯代码视频 + zod props 表单（右侧面板可调参） |
| `VideoDemo` | `<Video>` 组件演示（需 `npm run make-video`） |
| `GeneratedVideo` | Agent 生成的 TSX（`src/generated/current.tsx`） |
| `AgentDraft` | Agent 导出的草稿 JSON（`src/generated/draft.json`） |

注册表：`src/compositions.tsx`。

### 2. CLI 导出 mp4（手动渲染）

```bash
# 终端 A：保持 dev server
npm run dev

# 终端 B：渲染
npm run render -- --comp CodeDemo --out out/video.mp4
npm run render -- --comp CodeDemo --out out/video.mp4 --concurrency 4
npm run render -- --comp VideoDemo --out out/video-demo.mp4

# 自定义 props（JSON 或 base64）
npm run render -- --comp CodeDemo --out out/custom.mp4 \
  --props '{"titleText":"Hello","starCount":90,"showBall":true,"titleColor":"#fde047","ballColor":"#dc2626","backgroundColor":"#0f172a"}'
```

**CI / 无 dev server 环境**：使用 bundle 模式（预构建站点 + preview）：

```bash
MINI_REMOTION_RENDER_MODE=bundle npm run render -- --comp CodeDemo --out out/video.mp4
```

引擎会自动 `vite build` 并启动 `vite preview`（默认 `http://localhost:4173`）。

### 3. Agent 一键生成（文本 → 视频）

```bash
# stub 模式（无需 API key）
MINI_REMOTION_PROVIDER=stub npm run agent -- "星空背景,标题弹入"

# DeepSeek（.env 配置 DEEPSEEK_API_KEY）
npm run agent -- "蓝色渐变产品开场"

# 旁白 + 模板 + 预算控制
npm run agent -- "产品发布" --narration "欢迎来到发布会" --template countdown --max-budget 0.5

# 只生成代码与校验，不渲染
npm run agent -- "测试" --no-render

# 跳过生图 / 预览 / 缓存
npm run agent -- "宣传短片" --no-images --no-preview --no-cache
```

**Agent 全部 CLI 选项**：

| 选项 | 说明 |
|------|------|
| `--out <path>` | 输出 mp4（默认 `out/agent-video.mp4`） |
| `--narration <text>` | 旁白文本（macOS `say` 合成） |
| `--no-tts` | 跳过 TTS |
| `--no-images` | 跳过 Seedream 图像生成 |
| `--no-render` | 只生成 + 校验，不渲染 |
| `--concurrency <n>` | Chromium 并发段数 |
| `--max-retries <n>` | 最大重试（默认 3） |
| `--min-quality <0-1>` | 最低质量分（默认 0.5） |
| `--max-budget <usd>` | LLM + 图像费用上限 |
| `--no-cache` | 禁用 timeline / 代码缓存 |
| `--no-preview` | 跳过低清预览，直接全量渲染 |
| `--template <id>` | `intro-main-outro` \| `title-slide` \| `countdown` |
| `--distributed` | 文件队列分布式帧截图 |
| `--vision-qa` | Vision LLM 语义质检 |

产物：

- `src/generated/current.tsx` — 生成的视频组件
- `src/generated/draft.json` — 草稿层 JSON
- `out/agent-video.mp4` — 最终视频
- `out/agent-manifest.json` — 运行摘要

---

## 功能一览

### 画面运行时（`src/core/`）

| 能力 | 组件 / API | 说明 |
|------|-----------|------|
| 帧驱动 | `useCurrentFrame`, `FrameProvider`, `Sequence` | 纯函数动画，禁止 `Math.random()` |
| 插值 / 弹簧 | `interpolate`, `spring`, `Easing` | 确定性动画原语 |
| 图片 | `<Img>` + `delayRender` | 等图片加载完再截图 |
| 音频 | `<Audio>` + `AudioManager` | 预览播放；导出登记时间线，FFmpeg 混流 |
| 视频 | `<Video>` + `VideoManager` | 预览 seek；导出逐帧 seek 后截图进画面 |
| 静态资源 | `staticFile("xxx")` | 映射 `public/` 目录 |
| Props Schema | `z`, `zColor` | Studio 自动生成表单 |

### 渲染引擎（`engine/` + `render/`）

| 能力 | 模块 | 说明 |
|------|------|------|
| Dev Server | `engine/dev-server.ts` | 自动拉起 Vite :5173 |
| Bundle 模式 | `engine/bundle.ts`, `engine/render-site.ts` | `vite build` + preview，适合 CI |
| 帧调度 | `render/frame-scheduler.ts` | 按 pool 切分连续帧段 |
| 浏览器池 | `render/chromium-pool.ts` | 多 Chromium 进程并行截图 |
| 分布式队列 | `render/queue/` | 帧任务写入 `out/queue/`，可多 worker 消费 |
| FFmpeg | `render/pipeline.ts` | PNG 序列 → H.264 + 音频混流 |
| 校验 | `engine/validate.ts` | tsc + 分场景冒烟测试 |

```bash
# 分布式 worker（另一终端 / 另一台机器参与同一批次）
npm run queue:worker -- <batchId>
```

### Harness Agent 流水线

```
User Prompt
    ↓
INIT ─────────────────────────────────────────────┐
    ↓                                           │
TIMELINE_PLAN    LLM / stub 生成分镜 JSON         │
    ↓                                           │
ASSET_GEN        Seedream 5.0 生图 → public/generated/
    ↓                                           │
COMPOSE          LLM 生成 React TSX              │ 失败
    ↓                                           │
VALIDATE         静态检查 + tsc + 分场景冒烟       │
    ↓                                           ↓
PREVIEW_CHECK    低清抽帧快速质检 ──────────→ OPTIMIZE
    ↓              (按失败类型路由回不同阶段)
FRAME_SCHEDULE   探测 meta + 切分帧任务
    ↓
CHROMIUM_POOL    并行截图（可选分布式队列）
    ↓
FFMPEG           编码 + 音频混流
    ↓
QUALITY_CHECK    ffprobe + 亮度 QA + Vision LLM（可选）
    ↓
OUTPUT ──→ DONE
```

| 阶段 | 目录 / 文件 | 能力 |
|------|------------|------|
| 时间线规划 | `harness/timeline/` | LLM 输出分镜；模板库 + 关键词匹配 |
| 素材生成 | `harness/assets/` | 火山方舟 Seedream 5.0 |
| 代码生成 | `harness/composition/` | 按时间线生成 TSX |
| 静态分析 | `harness/analysis/compose-lint.ts` | meta / Sequence / 素材引用检查 |
| 低清预览 | `harness/preview/` | 全量渲染前 50% 分辨率抽帧 |
| 失败路由 | `harness/failure-router.ts` | static / visual / asset / render → 不同阶段 |
| 成本追踪 | `harness/cost/` | token + 图像费用，`--max-budget` |
| LLM 缓存 | `harness/cache/` | 复用 timeline + 已校验 TSX |
| 智能调度 | `harness/scheduler.ts` | 动态 pool、渲染/LLM 超时 |
| TTS | `engine/tts/` | macOS say / noop |
| Draft 导出 | `harness/draft/export.ts` | timeline → `draft.json` |
| 视觉 QA | `harness/quality/visual-qa.ts` | 抽帧亮度，黑屏/白屏检测 |
| Vision QA | `harness/quality/vision-llm.ts` | 多模态 LLM 语义点评 |

---

## 项目结构

```
mini-remotion/
├── src/                          # React 画面层
│   ├── core/                     # 运行时：Sequence, Img, Audio, Video, interpolate…
│   ├── draft/                    # 草稿层 JSON 模型 + DraftRenderer
│   ├── video/                    # 示例 composition（CodeDemo, VideoDemo）
│   ├── render/                   # Preview（预览）+ Headless（导出桥接）
│   ├── generated/                # Agent 输出：current.tsx, draft.json
│   ├── compositions.tsx          # composition 注册表
│   └── Studio.tsx                # 开发 UI
│
├── render/                       # Node 渲染管线
│   ├── pipeline.ts               # 截图 + FFmpeg 编码
│   ├── frame-scheduler.ts        # 帧任务切分
│   ├── chromium-pool.ts          # 浏览器进程池
│   ├── queue/                    # 分布式文件队列
│   └── render.ts                 # CLI 入口
│
├── engine/                       # 引擎封装
│   ├── dev-server.ts             # 确保 Vite dev 就绪
│   ├── bundle.ts                 # vite build + preview
│   ├── render-site.ts            # dev / bundle 统一入口
│   ├── validate.ts               # tsc + 冒烟测试
│   ├── render-job.ts             # 渲染任务 API
│   ├── write-generated.ts        # 写入 generated 文件
│   └── tts/                      # TTS 多后端
│
├── harness/                      # Agent 状态机
│   ├── state-machine.ts          # 主流水线循环
│   ├── cli.ts                    # npm run agent
│   ├── timeline/                 # 分镜规划 + 模板
│   ├── assets/                   # Seedream 生图
│   ├── composition/              # LLM 生成 TSX
│   ├── preview/                  # 低清预览质检
│   ├── quality/                  # 视觉 QA + Vision LLM
│   ├── draft/                    # Draft JSON 导出
│   ├── cache/                    # LLM 缓存
│   ├── cost/                     # 费用追踪
│   └── failure-router.ts         # 失败分类路由
│
├── config/env.ts                 # .env 加载
├── scripts/                      # make-audio, make-video
├── public/                       # 静态资源（audio.mp4, generated/）
└── out/                          # 渲染输出、缓存、队列（gitignore 部分）
```

---

## 画面四层架构

画面逻辑按四层组织（Agent 生成的内容主要走**数据层**；草稿层是可选的 JSON 编辑路径）：

```
草稿层(可选)  →  数据层(核心)  →  渲染层  →  驱动层
```

| 层 | 职责 | 关键文件 |
|----|------|---------|
| ① 草稿层 | 纯 JSON 数据（可视化编辑） | `src/draft/types.ts`, `DraftRenderer.tsx` |
| ② 数据层 | `frame → 画面` | `src/core/*`, `src/compositions.tsx` |
| ③ 渲染层 | React 树 → 像素 | `Preview.tsx`, `Headless.tsx`, `render/pipeline.ts` |
| ④ 驱动层 | 决定当前帧号 | `usePlayer.ts`, `window.__miniRemotionSetFrame` |

连接点：

- 数据层 ↔ 渲染层：`FrameProvider` 注入当前帧
- 驱动层 ↔ 数据层：预览用 `setState`；导出用 `window.__miniRemotionSetFrame(frame)`

### 导出时 Headless 桥接 API

Puppeteer 打开 `/?headless=1&comp=<id>` 后，页面挂载：

| Window API | 用途 |
|------------|------|
| `__miniRemotionSetFrame(n)` | 驱动当前帧 |
| `__miniRemotionMeta` | composition 宽高/fps/总帧数 |
| `__miniRemotionReady` | `delayRender` 计数为 0 |
| `__miniRemotionGetAudio()` | 音频时间线（FFmpeg 混流） |
| `__miniRemotionGetVideo()` | 视频轨元数据（调试用） |

---

## 媒体组件行为

### `<Audio>`

- **预览**：隐藏 `<audio>`，跟随帧 / 播放态 seek
- **导出**：不播放，登记 `AudioEntry` → FFmpeg `atrim` + `adelay` + `amix`

### `<Video>`

- **预览**：可见 `<video>`，同步 seek / 播放
- **导出**：每帧 seek 到正确时间点 + `delayRender`，由截图捕获画面（与 `<Audio>` 不同，不走 FFmpeg 叠轨）

### `<Img>`

- 挂载时 `delayRender()`，加载完成 `continueRender()`，保证截图时图片已绘制

---

## 环境变量速查

完整示例见 `.env.example`。

| 变量 | 说明 |
|------|------|
| `MINI_REMOTION_PROVIDER` | `stub` \| `deepseek` \| `openai` |
| `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` | LLM API |
| `ARK_API_KEY` | 火山方舟 Seedream 生图 |
| `MINI_REMOTION_IMAGES=noop` | 跳过生图 |
| `MINI_REMOTION_TTS=noop` | 跳过 TTS |
| `MINI_REMOTION_RENDER_MODE=bundle` | 使用预构建站点渲染 |
| `MINI_REMOTION_DISTRIBUTED_QUEUE=1` | 分布式帧队列 |
| `MINI_REMOTION_VISION_QA=1` | Vision LLM 质检 |
| `MAX_BUDGET_USD` | Agent 费用上限 |

---

## npm scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Studio（Vite :5173） |
| `npm run build` | 生产构建（`dist/`） |
| `npm run serve` | preview 静态站点（:4173） |
| `npm run render` | CLI 导出 mp4 |
| `npm run agent` | Harness Agent 文本 → 视频 |
| `npm run make-audio` | 生成 `public/audio.mp3` |
| `npm run make-video` | 生成 `public/sample.mp4` |
| `npm run queue:worker` | 分布式队列 worker |
| `npm run engine:validate` | tsc + 冒烟测试 |

---

## 与真实 Remotion 的对应

| Mini Remotion | 真实 Remotion |
|---------------|---------------|
| `useCurrentFrame` | `packages/core/src/use-current-frame.ts` |
| `FrameProvider` | `packages/core/src/TimelineContext.tsx` |
| `window.__miniRemotionSetFrame` | `window.remotion_setFrame` |
| `Sequence` | `packages/core/src/Sequence.tsx` |
| `delayRender` | `packages/core/src/delay-render.ts` |
| `render/pipeline.ts` | `packages/renderer/src/render-frames.ts` |
| 草稿层 | Editor Starter |

---

## 进阶方向

- Studio 可视化编辑草稿 JSON（拖拽、改属性）
- 可嵌入的 `<Player>` 组件
- Vision QA 失败 → 自动 `OPTIMIZE` 修片闭环
- 远程 worker + 对象存储传帧
