import { selectProvider } from "../llm/index.js";
import { harnessLog } from "../log.js";
import {
  TIMELINE_SYSTEM_PROMPT,
  buildTimelineUserMessage,
} from "./prompts.js";
import type { VideoTimeline } from "./types.js";
import {
  applyTemplate,
  getTemplateById,
  matchTemplate,
} from "./templates.js";

const extractJson = (text: string): string => {
  const m = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
};

const validateTimeline = (raw: unknown): VideoTimeline | null => {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (
    typeof t.width !== "number" ||
    typeof t.height !== "number" ||
    typeof t.fps !== "number" ||
    typeof t.durationInFrames !== "number" ||
    typeof t.summary !== "string" ||
    !Array.isArray(t.scenes)
  ) {
    return null;
  }
  const scenes = t.scenes as Record<string, unknown>[];
  const parsed = scenes.map((s) => ({
    id: String(s.id ?? ""),
    label: String(s.label ?? ""),
    startFrame: Number(s.startFrame),
    endFrame: Number(s.endFrame),
    description: String(s.description ?? ""),
  }));
  if (parsed.some((s) => !s.id || s.endFrame <= s.startFrame)) return null;
  return {
    width: t.width,
    height: t.height,
    fps: t.fps,
    durationInFrames: t.durationInFrames,
    summary: t.summary,
    scenes: parsed,
  };
};

/** stub: 按 prompt 切 3 段场景 */
export const planTimelineStub = (
  prompt: string,
  durationInFrames = 120,
): VideoTimeline => {
  const fps = 30;
  const n = 3;
  const seg = Math.floor(durationInFrames / n);
  const labels = ["开场", "主体", "结尾"];
  const scenes = Array.from({ length: n }, (_, i) => ({
    id: `scene-${i}`,
    label: labels[i] ?? `场景${i + 1}`,
    startFrame: i * seg,
    endFrame: i === n - 1 ? durationInFrames : (i + 1) * seg,
    description:
      i === 0
        ? `开场动画: ${prompt.slice(0, 60)}`
        : i === 1
          ? prompt.slice(0, 120)
          : "结尾停留/淡出",
  }));
  return {
    width: 1280,
    height: 720,
    fps,
    durationInFrames,
    summary: prompt.slice(0, 80),
    scenes,
  };
};

export const planTimeline = async (
  prompt: string,
  opts?: {
    durationInFrames?: number;
    useStub?: boolean;
    templateId?: string;
  },
): Promise<VideoTimeline> => {
  const fallbackFrames = opts?.durationInFrames ?? 120;

  const template =
    (opts?.templateId ? getTemplateById(opts.templateId) : null) ??
    matchTemplate(prompt);

  if (template) {
    const tl = applyTemplate(template, prompt, opts?.durationInFrames ?? template.durationInFrames);
    harnessLog(
      "TIMELINE_PLAN",
      `模板 [${template.id}] → ${tl.scenes.length} 场景, ${tl.durationInFrames} 帧`,
    );
    return tl;
  }

  if (opts?.useStub || process.env.MINI_REMOTION_PROVIDER === "stub") {
    const tl = planTimelineStub(prompt, fallbackFrames);
    harnessLog("TIMELINE_PLAN", `stub → ${tl.scenes.length} 场景, ${tl.durationInFrames} 帧`);
    return tl;
  }

  const provider = selectProvider();
  harnessLog("TIMELINE_PLAN", `LLM 规划 (${provider.name})…`);

  const messages = [
    { role: "system" as const, content: TIMELINE_SYSTEM_PROMPT },
    buildTimelineUserMessage(prompt),
  ];

  try {
    const raw = await provider.complete(messages);
    const parsed = validateTimeline(JSON.parse(extractJson(raw)));
    if (parsed) {
      harnessLog(
        "TIMELINE_PLAN",
        `   ${parsed.scenes.length} 场景, ${parsed.durationInFrames} 帧 @ ${parsed.fps}fps`,
      );
      return parsed;
    }
  } catch {
    /* fallback below */
  }

  harnessLog("TIMELINE_PLAN", "   LLM JSON 无效, 回退 stub");
  return planTimelineStub(prompt, fallbackFrames);
};
