# Mini Remotion

极简 [Remotion](https://www.remotion.dev/) 教学实现 + **Enhanced Video Agent**：用 React 描述画面，用 Node 逐帧截图合成视频，用 TypeScript 状态机把「文本 → 视频」整条流水线编排起来。

**核心思想**：视频 = 一个「当前帧号」可被外部控制的 React 应用；渲染 = 逐帧截图 + FFmpeg 编码。同一帧 + 同一 props 永远得到同样画面 → 可随意 seek、可并发渲染。

---

## 快速开始

### 依赖

| 依赖 | 用途 |
|------|------|
| Node.js 18+ | 运行时 |
| [FFmpeg](https://ffmpeg.org/) | 编码、抽帧、混音（`brew install ffmpeg`） |
| Puppeteer | CLI / Agent 导出截图（已在 `devDependencies`） |

### 安装与预览

```bash
cd mini-remotion
npm install
npm run make-audio    # 可选：生成 public/audio.mp3
npm run make-video    # 可选：生成 public/sample.mp4（VideoDemo 需要）
npm run dev           # Studio → http://localhost:5173
```

Studio 快捷键：`空格` 播放/暂停，`←` `→` 逐帧。

### 30 秒导出第一个视频

```bash
# 终端 A：保持 dev server
npm run dev

# 终端 B：渲染 CodeDemo
npm run render -- --comp CodeDemo --out out/video.mp4
```

CI / 无 dev server 时用 bundle 模式：

```bash
MINI_REMOTION_RENDER_MODE=bundle npm run render -- --comp CodeDemo --out out/video.mp4
```

### Agent 环境（可选）

```bash
cp .env.example .env
# 按需填入 DEEPSEEK_API_KEY、ARK_API_KEY 等
```

---

## 三种使用方式

本项目面向三类场景，共用同一套 React composition 与渲染引擎。

```
                    ┌─────────────────┐
                    │  compositions   │  src/compositions.tsx
                    └────────┬────────┘
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   Studio 预览          CLI 手动渲染         Agent 自动生成
   npm run dev          npm run render       npm run agent
   调参 / 时间轴         指定 comp + props     文本 → 视频
```

### 1. Studio 预览（开发画面）

浏览器实时预览 composition，右侧可调 zod props，底部时间轴 seek。

在地址栏或下拉框切换 composition，或访问 `/?comp=CodeDemo`。

### 2. CLI 导出 mp4（手动渲染）

```bash
npm run render -- --comp <id> --out out/video.mp4

# 常用参数
npm run render -- --comp CodeDemo --out out/video.mp4 --concurrency 4
npm run render -- --comp VideoDemo --out out/video-demo.mp4
npm run render -- --comp AudioFadeDemo --out out/audio-fade.mp4

# 自定义 props（JSON 或 base64）
npm run render -- --comp CodeDemo --out out/custom.mp4 \
  --props '{"titleText":"Hello","starCount":90,"showBall":true,"titleColor":"#fde047","ballColor":"#dc2626","backgroundColor":"#0f172a"}'
```

### 3. Agent 一键生成（文本 → 视频）

```bash
# stub 模式（无需 API key）
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
| `src/generated/current.tsx` | 生成的视频组件 |
| `src/generated/draft.json` | 草稿层 JSON |
| `out/agent-video.mp4` | 最终视频 |
| `out/agent-manifest.json` | 运行摘要 |

---

## Composition 清单

注册表：`src/compositions.tsx`。

| ID | 类型 | 说明 | 前置条件 |
|----|------|------|----------|
| `DraftDemo` | 草稿层 | JSON → `DraftRenderer` | — |
| `CodeDemo` | 纯代码 | zod props 表单 + 动画演示 | `npm run make-audio`（有 BGM） |
| `AudioFadeDemo` | 纯代码 | 音量曲线淡入淡出（P4-d） | `npm run make-audio` |
| `VideoDemo` | 纯代码 | `<OffthreadVideo>` 抽帧 + 视频音轨 | `npm run make-video` |
| `GeneratedVideo` | Agent | `src/generated/current.tsx` | 先跑 `npm run agent` |
| `AgentDraft` | Agent 草稿 | `src/generated/draft.json` | 先跑 `npm run agent` |

---

## 功能一览

### 画面运行时（`src/core/`）

| 能力 | 组件 / API | 说明 |
|------|-----------|------|
| 帧驱动 | `useCurrentFrame`, `FrameProvider`, `Sequence` | 纯函数动画；用 `random(seed)` 代替 `Math.random()` |
| 插值 / 弹簧 | `interpolate`, `spring`, `Easing` | 确定性动画原语 |
| 图片 | `<Img>` + `delayRender` | 等图片加载完再截图 |
| 音频 | `<Audio>` | 预览播放；导出登记音轨 + FFmpeg 混流 |
| 音量曲线 | `volume={(f) => number}` | 预览实时；导出预处理烘焙（P4-d） |
| 视频（浏览器） | `<Video>` | 预览 seek；导出浏览器内 decode + 截图 |
| 视频（Offthread） | `<OffthreadVideo>` | 预览同 `<Video>`；导出 FFmpeg `/proxy` 抽帧（**推荐**） |
| 媒体资产 | `RenderAssetManager` | 统一登记 audio / video 音轨（P4-b） |
| 静态资源 | `staticFile("xxx")` | 映射 `public/` |
| Props Schema | `z`, `zColor` | Studio 自动生成表单 |

### 渲染引擎（`engine/` + `render/`）

| 能力 | 模块 | 说明 |
|------|------|------|
| Dev Server | `engine/dev-server.ts` | 自动拉起 Vite :5173 |
| Bundle 模式 | `engine/bundle.ts`, `render-site.ts` | `vite build` + preview，适合 CI |
| Offthread 代理 | `render/offthread/` | `GET /proxy?src=&time=` FFmpeg 抽帧（:3199） |
| 帧调度 | `render/frame-scheduler.ts` | 按 pool 切分连续帧段 |
| 浏览器池 | `render/chromium-pool.ts` | 多 Chromium 并行截图 |
| 分布式队列 | `render/queue/` | 帧任务写入 `out/queue/`，多 worker 消费 |
| 音频预处理 | `render/audio/preprocess-track.ts` | atrim + 音量曲线 → WAV |
| 音轨混流 | `render/audio/merge-tracks.ts` | adelay + amix 合成最终 mp4 |
| FFmpeg 编码 | `render/pipeline.ts` | PNG 序列 → H.264 + 混音 |
| 校验 | `engine/validate.ts` | tsc + 分场景冒烟测试 |

```bash
# 分布式 worker（另一终端 / 另一台机器参与同一批次）
npm run queue:worker -- <batchId>
```

### Harness Agent

| 阶段 | 目录 | 能力 |
|------|------|------|
| 时间线规划 | `harness/timeline/` | LLM 分镜；模板库 + 关键词匹配 |
| 素材生成 | `harness/assets/` | 火山方舟 Seedream 5.0 生图 |
| 代码生成 | `harness/composition/` | 按时间线生成 TSX |
| 静态分析 | `harness/analysis/` | meta / Sequence / 素材引用检查 |
| 低清预览 | `harness/preview/` | 全量渲染前 50% 分辨率抽帧 |
| 失败路由 | `harness/failure-router.ts` | static / visual / asset / render → 不同阶段 |
| 成本追踪 | `harness/cost/` | token + 图像费用，`--max-budget` |
| LLM 缓存 | `harness/cache/` | 复用 timeline + 已校验 TSX |
| 视觉 QA | `harness/quality/visual-qa.ts` | 黑屏 / 白屏检测 |
| Vision QA | `harness/quality/vision-llm.ts` | 多模态 LLM 语义点评 |
| Draft 导出 | `harness/draft/export.ts` | timeline → `draft.json` |
| TTS | `engine/tts/` | macOS say / noop |

---

## 架构总览

### 三层分工

```
┌─────────────────────────────────────────────────────────────┐
│  Harness (harness/)                                         │
│  状态机、LLM 编排、生图、质检、失败恢复、成本调度               │
└───────────────────────────────┬─────────────────────────────┘
                                │ import engine / render
┌───────────────────────────────▼─────────────────────────────┐
│  Engine (engine/ + render/)                                 │
│  站点就绪、校验、截图池、Offthread 代理、FFmpeg 编码混音        │
└───────────────────────────────┬─────────────────────────────┘
                                │ 加载 React composition
┌───────────────────────────────▼─────────────────────────────┐
│  React (src/)                                               │
│  帧驱动画面：frame + props → 像素                             │
└─────────────────────────────────────────────────────────────┘
```

### 画面四层（React 侧）

画面逻辑自内而外分四层；Agent 生成内容主要走**数据层**，草稿层是可选 JSON 编辑路径。

```
草稿层(可选)  →  数据层(核心)  →  渲染层  →  驱动层
```

| 层 | 职责 | 关键文件 |
|----|------|---------|
| ① 草稿层 | 纯 JSON，可可视化编辑 | `src/draft/types.ts`, `DraftRenderer.tsx` |
| ② 数据层 | `frame → 画面` | `src/core/*`, `src/compositions.tsx` |
| ③ 渲染层 | React 树 → 像素 | `Preview.tsx`, `Headless.tsx`, `render/pipeline.ts` |
| ④ 驱动层 | 决定当前帧号 | `usePlayer.ts`, `window.__miniRemotionSetFrame` |

- **预览**：`usePlayer` 用 `setState` 驱动帧号
- **导出**：Puppeteer 调用 `window.__miniRemotionSetFrame(n)` 逐帧推进

### CLI 渲染全流程

```
npm run render
    │
    ├─ ensureRenderSite()          dev :5173 或 bundle :4173
    ├─ ensureOffthreadServer()     FFmpeg 抽帧代理 :3199
    │
    ├─ scheduleFrames()            按 concurrency 切分帧段
    ├─ chromium-pool               多浏览器并行截图
    │     └─ Puppeteer 打开 ?headless=1&comp=&proxyPort=
    │           每帧: setFrame → wait ready → screenshot PNG
    │           每帧: collectAssets() 合并媒体登记
    │
    └─ encodeVideo()
          ├─ FFmpeg: PNG 序列 → 无声 H.264
          ├─ prepareAudioTracks()   抽轨 + preprocessTrack
          └─ mergeAudioTracks()     adelay + amix → 最终 mp4
```

### 媒体管线（画面 + 声音）

**画面（Offthread，推荐）**

```
<OffthreadVideo> 计算 currentTime
     ↓ fetch
http://127.0.0.1:3199/proxy?src=/sample.mp4&time=1.23
     ↓ FFmpeg 抽 PNG
<Img src={blob}>  → Puppeteer 截 #mini-remotion-canvas
```

**声音（统一资产模型）**

```
<Audio> / <OffthreadVideo>  登记 RenderAsset { type: 'audio' | 'video' }
     ↓ 每帧 collectAssets()，按 id 去重
prepareAudioTracks
     ├─ audio  → public 文件
     ├─ video  → FFmpeg 抽轨 → out/_audio_cache/
     └─ preprocessTrack  atrim + volume 曲线 → out/_audio_preprocessed/*.wav
mergeAudioTracks  adelay + amix → 与画面 mp4 合成
```

| 组件 | 预览 | 导出 |
|------|------|------|
| `<OffthreadVideo>` | `<video>` 播放 | FFmpeg 抽帧 → `<Img>` + 视频音轨混流 |
| `<Video>` | `<video>` 播放 | 浏览器 seek + 截图（较慢，教学用） |
| `<Audio>` | 隐藏 `<audio>` seek | 登记音轨；支持 `volume={(f) => ...}` |
| `<Img>` | 正常显示 | `delayRender` 等加载完再截图 |

### Agent 状态机

```
User Prompt
    ↓
INIT ─────────────────────────────────────────────┐
    ↓                                           │
TIMELINE_PLAN    LLM / stub 生成分镜 JSON         │
    ↓                                           │
ASSET_GEN        Seedream 生图 → public/generated/
    ↓                                           │
COMPOSE          LLM 生成 React TSX              │ 失败
    ↓                                           │
VALIDATE         tsc + 分场景冒烟                 │
    ↓                                           ↓
PREVIEW_CHECK    低清抽帧质检 ──────────────→ OPTIMIZE
    ↓              (按失败类型路由回不同阶段)
FRAME_SCHEDULE   探测 meta + 切分帧任务
    ↓
CHROMIUM_POOL    并行截图（可选 --distributed）
    ↓
FFMPEG           编码 + 音频混流
    ↓
QUALITY_CHECK    ffprobe + 亮度 QA + Vision LLM（可选）
    ↓
OUTPUT ──→ DONE
```

主流水线实现：`harness/state-machine.ts`。

### Headless 桥接 API

Puppeteer 打开 `/?headless=1&comp=<id>` 后，页面暴露：

| Window API | 用途 |
|------------|------|
| `__miniRemotionSetFrame(n)` | 驱动当前帧 |
| `__miniRemotionMeta` | 宽高 / fps / 总帧数 |
| `__miniRemotionReady` | `delayRender` 计数为 0 |
| `__miniRemotionCollectAssets()` | 媒体资产清单（audio + video 音轨） |
| `__miniRemotionProxyPort` | Offthread 代理端口 |
| `__miniRemotionVideoEnabled` | 是否 Offthread 抽帧（默认 true） |
| `__miniRemotionAudioEnabled` | 是否登记音轨（默认 true） |

---

## 项目结构

```
mini-remotion/
├── src/                              # React 画面层
│   ├── core/                         # 运行时原语
│   │   ├── frame-context.tsx         # useCurrentFrame, Sequence
│   │   ├── Audio.tsx / Video.tsx / OffthreadVideo.tsx / Img.tsx
│   │   ├── render-asset-manager.tsx  # 统一媒体资产登记
│   │   ├── volume-prop.ts            # 音量曲线 (P4-d)
│   │   └── interpolate.ts, spring.ts, delay-render.ts …
│   ├── draft/                        # 草稿层 JSON + DraftRenderer
│   ├── video/                        # 示例 composition
│   ├── render/                       # Preview + Headless 桥接
│   ├── generated/                    # Agent 输出 (current.tsx, draft.json)
│   ├── compositions.tsx              # composition 注册表
│   └── Studio.tsx                    # 开发 UI
│
├── render/                           # Node 渲染管线
│   ├── pipeline.ts                   # 截图 + FFmpeg 主编排
│   ├── render.ts                     # CLI 入口 (npm run render)
│   ├── offthread/                    # FFmpeg 抽帧 HTTP 代理
│   ├── audio/                        # 抽轨、预处理、混流
│   ├── headless-url.ts               # Headless URL 拼装
│   ├── frame-scheduler.ts            # 帧任务切分
│   ├── chromium-pool.ts              # 浏览器进程池
│   └── queue/                        # 分布式文件队列
│
├── engine/                           # 引擎封装（供 Harness / CLI 调用）
│   ├── dev-server.ts                 # 确保 Vite dev 就绪
│   ├── bundle.ts / render-site.ts    # bundle 模式
│   ├── validate.ts                   # tsc + 冒烟测试
│   ├── render-job.ts                 # 渲染任务 API
│   ├── write-generated.ts            # 写入 generated 文件
│   └── tts/                          # TTS 多后端
│
├── harness/                          # Agent 状态机
│   ├── state-machine.ts              # 主流水线循环
│   ├── cli.ts                        # npm run agent
│   ├── timeline/                     # 分镜规划 + 模板
│   ├── assets/                       # Seedream 生图
│   ├── composition/                  # LLM 生成 TSX
│   ├── preview/                      # 低清预览质检
│   ├── quality/                      # 视觉 QA + Vision LLM
│   ├── draft/                        # Draft JSON 导出
│   ├── cache/                        # LLM 缓存
│   ├── cost/                         # 费用追踪
│   └── failure-router.ts             # 失败分类路由
│
├── config/env.ts                     # .env 加载
├── scripts/                          # make-audio, make-video
├── public/                           # 静态资源 (audio.mp3, sample.mp4, generated/)
└── out/                              # 渲染输出、缓存、队列（部分 gitignore）
    ├── frames/                       # 截图 PNG 序列
    ├── _audio_cache/                 # 视频抽轨缓存
    ├── _audio_preprocessed/          # 预处理 WAV
    └── queue/                        # 分布式任务队列
```

---

## 环境变量

完整示例：`.env.example`。

| 变量 | 说明 |
|------|------|
| `MINI_REMOTION_PROVIDER` | `stub` \| `deepseek` \| `openai` |
| `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` | LLM API |
| `ARK_API_KEY` | 火山方舟 Seedream 生图 |
| `MINI_REMOTION_RENDER_MODE=bundle` | CI 用预构建站点渲染 |
| `MINI_REMOTION_DISTRIBUTED_QUEUE=1` | 分布式帧队列 |
| `MINI_REMOTION_PROXY_PORT` | Offthread 代理端口（默认 3199） |
| `MINI_REMOTION_OFFTHREAD_CACHE_SIZE` | 抽帧 LRU 缓存条数 |
| `MINI_REMOTION_IMAGES=noop` | 跳过生图 |
| `MINI_REMOTION_TTS=noop` | 跳过 TTS |
| `MINI_REMOTION_VISION_QA=1` | Vision LLM 语义质检 |
| `MAX_BUDGET_USD` | Agent 费用上限 |

---

## npm scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Studio（Vite :5173） |
| `npm run build` | 生产构建（`dist/`） |
| `npm run serve` | preview 静态站点（:4173） |
| `npm run render` | CLI 导出 mp4 |
| `npm run agent` | Harness Agent：文本 → 视频 |
| `npm run make-audio` | 生成 `public/audio.mp3` |
| `npm run make-video` | 生成 `public/sample.mp4`（含测试音轨） |
| `npm run queue:worker` | 分布式队列 worker |
| `npm run engine:validate` | tsc + 冒烟测试 |
| `npm run engine:render` | 引擎渲染 API / CLI |
| `npm run engine:write` | 写入 generated 文件 |

---

## 与真实 Remotion 的对应

| Mini Remotion | 真实 Remotion |
|---------------|---------------|
| `useCurrentFrame` | `packages/core/src/use-current-frame.ts` |
| `FrameProvider` | `packages/core/src/TimelineContext.tsx` |
| `window.__miniRemotionSetFrame` | `window.remotion_setFrame` |
| `Sequence` | `packages/core/src/Sequence.tsx` |
| `delayRender` | `packages/core/src/delay-render.ts` |
| `RenderAssetManager` | `packages/core` collectAssets |
| `OffthreadVideo` + FFmpeg `/proxy` | `offthread-video-server` + Rust compositor |
| `preprocess-track` + `merge-tracks` | `preprocess-audio-track` + `merge-audio-track` |
| 草稿层 | Editor Starter |
