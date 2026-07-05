# Mini Remotion

三层职责分离的极简 Remotion + Enhanced Video Agent:

```
┌─────────────────────────────────────────────────────────────┐
│  TypeScript Harness (harness/)  状态机编排、质量评测、失败恢复、资源调度  │
└───────────────────────────────┬─────────────────────────────┘
                                │ 直接 import engine/render
┌───────────────────────────────▼─────────────────────────────┐
│  Node.js (engine/ + render/)   逐帧渲染、冒烟校验、FFmpeg 合成、TTS   │
└───────────────────────────────┬─────────────────────────────┘
                                │ 加载并渲染
┌───────────────────────────────▼─────────────────────────────┐
│  React (src/)                  画面表达层(frame → 像素)            │
└─────────────────────────────────────────────────────────────┘
```

内部仍按**四层架构**组织画面逻辑:

```
草稿层(可选)  →  数据层(核心)  →  渲染层  →  驱动层
```

## 核心思想

> **视频 = 一个「当前帧号」可被外部控制的 React 应用;渲染 = 逐帧截图再用 FFmpeg 合成。**

视频内容**不逐帧存储**,而是由组件根据 `useCurrentFrame()` 实时计算(纯函数)。因此同一帧永远渲染出同样画面 —— 这带来两个关键能力:可随意 seek、可并发渲染。

## 四层对应的文件

| 层 | 职责 | 文件 |
|----|------|------|
| **① 草稿层** | 纯 JSON 数据模型(给可视化编辑器用) | `src/draft/types.ts`、`src/draft/sample-draft.ts` |
| 草稿→数据桥 | 把 JSON 翻译成 React 组件 | `src/draft/DraftRenderer.tsx` |
| **② 数据层** | `frame → 画面` 的核心运行时 | `src/core/*`(`useCurrentFrame` / `interpolate` / `spring` / `random` / `Sequence` / `delayRender`) |
| 数据层清单 | 注册所有 composition | `src/compositions.tsx` |
| **③ 渲染层** | 把当前帧的 React 树变成像素 | `src/render/Preview.tsx`(预览)、`src/render/Headless.tsx`(导出桥接)、`render/render.ts`(Puppeteer+FFmpeg) |
| **④ 驱动层** | 调度器:决定渲染第几帧 | `src/drive/usePlayer.ts`(播放/暂停/seek)、`render/render.ts`(导出循环) |

数据层与渲染层的连接点是 `FrameProvider`;驱动层与数据层的连接点是「设置当前帧号」(浏览器端 setState / 导出端 `window.__miniRemotionSetFrame`)。

## 运行

```bash
npm install
npm run dev        # 打开 http://localhost:5173
```

Studio 里可切换两个示例:
- **DraftDemo** —— 由 `src/draft/sample-draft.ts` 的 JSON 草稿翻译而来(走完整四层)。
- **CodeDemo** —— 纯代码视频(不经过草稿层),演示数据层完全能力。

快捷键:`空格`=播放/暂停,`←/→`=逐帧。

## 音频(第 2 步)

- 示例音频用 FFmpeg 现场合成:`npm run make-audio` → 生成 `public/audio.mp3`。
- `<Audio src={staticFile("audio.mp3")} volume={0.5} />`:
  - **预览**:隐藏 `<audio>` 跟随帧/播放态同步(点播放按钮才会响,受浏览器自动播放策略限制)。
  - **导出**:不播放,只把自己登记进"音频时间线",由 FFmpeg 离线混流。**声音不靠截图**。

## 导出为 mp4(可选)

需要额外安装 Puppeteer,并确保系统有 FFmpeg(mac: `brew install ffmpeg`):

```bash
npm install -D puppeteer
npm run dev                                   # 终端 A:保持 dev server 运行
npm run render -- --comp DraftDemo --out out/video.mp4   # 终端 B
```

导出流程:逐帧截图 → FFmpeg 编码无声视频 → 按音频时间线(`atrim` 裁剪 + `adelay` 定位 + `volume` 调音 + `amix` 混合)混流。图片资源会在 `delayRender` 就绪后才截图。

## 并发渲染(第 3 步)

```bash
npm run render -- --comp CodeDemo --out out/video.mp4 --concurrency 4
```

把 `0..N` 帧切成若干连续段,**每段各开一个独立浏览器进程并行渲染**,最后 FFmpeg 拼接。

- 为什么能并行:`frame → 画面` 是纯函数,各段无共享状态、可独立渲染任意帧。语义上等价于"把不同帧段分给不同机器"。
- 为什么用多进程而非多标签页:headless Chrome 只让**前台页面**的 `requestAnimationFrame` 正常触发,后台标签页会被节流卡死;每段独立浏览器进程各有前台页面,互不干扰。
- 确定性验证:串行与并行输出经 `ffmpeg psnr` 比较为 `inf`(逐像素完全一致)。

## Props Schema + 可视化调参(第 4 步)

用 `zod` 给 composition 定义带类型的 props:

```ts
export const codeDemoSchema = z.object({
  titleText: z.string(),
  titleColor: zColor(),      // 标记为颜色 -> 表单渲染取色器
  starCount: z.number().min(0).max(120), // 带范围 -> 表单渲染滑块
  showBall: z.boolean(),     // -> 复选框
});
```

- **Studio 右侧面板**:`PropsEditor` 读取 zod schema 的 `_def`(typeName / checks / description),**自动生成表单**,改动实时反映到预览。
- **导出覆盖 props**:面板底部给出 `npm run render -- --comp CodeDemo --props <base64>` 命令;`--props` 也接受直接的 JSON 字符串。
- **链路**:Studio schema → `--props`(base64)→ headless URL(`?props=`)→ 合并 `defaultProps` → 组件渲染。同一套 props 预览/导出一致。

```bash
# 用自定义参数导出
npm run render -- --comp CodeDemo --out out/video.mp4 \
  --props '{"titleText":"Hello","backgroundColor":"#3b0764","starCount":90,"showBall":true,"titleColor":"#fde047","ballColor":"#dc2626"}'
```

## Enhanced Video Agent(文本 → 视频)

**TypeScript Harness Agent** 负责编排;**Node** 负责渲染;**React** 负责画面。

```
User Prompt
    ↓
Harness Agent (INIT)
    ↓
Timeline Planning   → harness/timeline/     分镜 JSON
    ↓
React Composition   → harness/composition/  LLM 生成 TSX
    ↓
Validate            → tsc + 冒烟
    ↓
Frame Scheduler     → render/frame-scheduler.ts
    ↓
Chromium Pool       → render/chromium-pool.ts
    ↓
FFmpeg              → render/pipeline.ts
    ↓
Quality Check       → harness/quality.ts
    ↓
Output              → out/*.mp4 + agent-manifest.json
```

失败恢复:`VALIDATE / QUALITY_CHECK → OPTIMIZE → COMPOSE`  
终态:`DONE | FAILED`

```bash
cp .env.example .env   # 编辑 .env, 填入 DEEPSEEK_API_KEY

# stub(无需 key, 或在 .env 里设 MINI_REMOTION_PROVIDER=stub)
npm run agent -- "星空背景,标题弹入"

# DeepSeek V4 Pro(.env 中 MINI_REMOTION_PROVIDER=deepseek + DEEPSEEK_API_KEY)
npm run agent -- "蓝色渐变开场"

# 旁白(macOS say)
npm run agent -- "产品介绍" --narration "欢迎来到我们的产品"

# 只生成+校验,不渲染
MINI_REMOTION_PROVIDER=stub npm run agent -- "测试" --no-render
```

| 目录 | 技术栈 | 职责 |
|------|--------|------|
| `src/` | React | 画面表达:`useCurrentFrame`、组件、动画 |
| `engine/` + `render/` | Node.js | 写 generated、校验(tsc+冒烟)、并发截图、FFmpeg |
| `harness/timeline/` | Timeline Planning | LLM/stub 输出分镜 JSON |
| `harness/composition/` | React Composition | 按时间线生成 TSX |
| `render/frame-scheduler.ts` | Frame Scheduler | 切分并行帧任务 |
| `render/chromium-pool.ts` | Chromium Pool | 浏览器进程池截图 |
| `render/pipeline.ts` | FFmpeg | 编码 + 混流 |
| `harness/quality.ts` | Quality Check | ffprobe 评测 |

环境变量:`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`(默认 `deepseek-v4-pro`)、`DEEPSEEK_BASE_URL`、`MINI_REMOTION_PROVIDER=stub|deepseek|openai`、`MINI_REMOTION_TTS=noop`  
也支持 OpenAI 兼容配置:`OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL`。  
推荐放在项目根目录 **`.env`** 文件中(见 `.env.example`); shell 里 `export` 的变量优先级更高,会覆盖 `.env`。

后续如需更复杂的多 Agent 能力,可接入 LangGraph.js;当前保持 TypeScript 栈一致,便于工程落地。

## 与真实 Remotion 的对应

| Mini Remotion | 真实 Remotion 源码 |
|---------------|--------------------|
| `useCurrentFrame` | `packages/core/src/use-current-frame.ts` |
| `FrameProvider` / 帧状态 | `packages/core/src/TimelineContext.tsx` |
| `window.__miniRemotionSetFrame` | `window.remotion_setFrame` |
| `Sequence` | `packages/core/src/Sequence.tsx` |
| `delayRender` / `continueRender` | `packages/core/src/delay-render.ts` |
| `render/render.ts` | `packages/renderer/src/render-frames.ts` |
| 草稿层 | Editor Starter(建在核心之上) |

## 下一步可以进阶的方向

- `<Audio>` / `<Video>`:收集音轨信息,导出时用 FFmpeg 混音(不能靠截图)。
- 图片资源 + `delayRender`:等待图片加载完再截图。
- 并发渲染:开多个页面分段渲染 0–N / N–2N 帧再拼接。
- 可视化编辑:让 Studio 能拖拽修改草稿 JSON。
- Player 组件:把预览封装成可嵌入任意页面的 `<Player>`。
- Agent 视觉自审:抽帧 → 视觉模型点评 → 自动修正草稿/代码。
