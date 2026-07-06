import type { VideoTimeline, TimelineScene } from "./types.js";

export type TimelineTemplate = {
  id: string;
  label: string;
  keywords: RegExp;
  durationInFrames: number;
  buildScenes: (prompt: string, total: number) => TimelineScene[];
};

const third = (total: number, i: number, n: number): [number, number] => {
  const seg = Math.floor(total / n);
  const start = i * seg;
  const end = i === n - 1 ? total : (i + 1) * seg;
  return [start, end];
};

export const TIMELINE_TEMPLATES: TimelineTemplate[] = [
  {
    id: "intro-main-outro",
    label: "开场-主体-结尾",
    keywords: /介绍|产品|宣传|开场|结尾|三段|全链路|demo|演示/i,
    durationInFrames: 120,
    buildScenes: (prompt, total) => {
      const labels = ["开场", "主体", "结尾"];
      return labels.map((label, i) => {
        const [start, end] = third(total, i, 3);
        return {
          id: `scene-${i}`,
          label,
          startFrame: start,
          endFrame: end,
          description:
            i === 0
              ? `开场: ${prompt.slice(0, 60)}`
              : i === 1
                ? prompt.slice(0, 120)
                : "结尾停留/淡出",
        };
      });
    },
  },
  {
    id: "title-slide",
    label: "标题幻灯",
    keywords: /标题|片头|logo|品牌/i,
    durationInFrames: 90,
    buildScenes: (prompt, total) => [
      {
        id: "title",
        label: "标题",
        startFrame: 0,
        endFrame: Math.floor(total * 0.6),
        description: `大标题弹入: ${prompt.slice(0, 40)}`,
      },
      {
        id: "hold",
        label: "停留",
        startFrame: Math.floor(total * 0.6),
        endFrame: total,
        description: "标题停留,轻微缩放",
      },
    ],
  },
  {
    id: "countdown",
    label: "倒计时",
    keywords: /倒计时|倒数|launch|发布/i,
    durationInFrames: 150,
    buildScenes: (_prompt, total) => [
      {
        id: "tick",
        label: "倒计时",
        startFrame: 0,
        endFrame: Math.floor(total * 0.85),
        description: "3-2-1 数字倒计时动画",
      },
      {
        id: "reveal",
        label: "揭晓",
        startFrame: Math.floor(total * 0.85),
        endFrame: total,
        description: "主标题揭晓",
      },
    ],
  },
];

export const matchTemplate = (prompt: string): TimelineTemplate | null => {
  const explicit = process.env.MINI_REMOTION_TEMPLATE;
  if (explicit) {
    return TIMELINE_TEMPLATES.find((t) => t.id === explicit) ?? null;
  }
  return TIMELINE_TEMPLATES.find((t) => t.keywords.test(prompt)) ?? null;
};

export const applyTemplate = (
  template: TimelineTemplate,
  prompt: string,
  durationInFrames?: number,
): VideoTimeline => {
  const total = durationInFrames ?? template.durationInFrames;
  return {
    width: 1280,
    height: 720,
    fps: 30,
    durationInFrames: total,
    summary: prompt.slice(0, 80),
    scenes: template.buildScenes(prompt, total),
  };
};

export const getTemplateById = (id: string): TimelineTemplate | undefined =>
  TIMELINE_TEMPLATES.find((t) => t.id === id);
