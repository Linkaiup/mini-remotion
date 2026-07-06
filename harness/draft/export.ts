import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Draft, DraftItem, TextItem } from "../../src/draft/types.js";
import type { VideoTimeline } from "../timeline/types.js";

const GENERATED_DRAFT = resolve("src/generated/draft.json");
const OUT_DRAFT = resolve("out/agent-draft.json");

/** Timeline + 素材 → Draft JSON(供 Studio 草稿层使用) */
export const timelineToDraft = (
  timeline: VideoTimeline,
  prompt: string,
): Draft => {
  const items: DraftItem[] = timeline.scenes.map((scene, i) => {
    const asset = timeline.assets?.find((a) => a.sceneId === scene.id);
    if (asset) {
      return {
        id: `item-${scene.id}`,
        type: "image" as const,
        from: scene.startFrame,
        durationInFrames: scene.endFrame - scene.startFrame,
        x: 0,
        y: 0,
        width: timeline.width,
        height: timeline.height,
        src: `staticFile("${asset.path}")`,
        animation: i === 0 ? "fadeIn" : "none",
      };
    }
    const text: TextItem = {
      id: `item-${scene.id}`,
      type: "text",
      from: scene.startFrame,
      durationInFrames: scene.endFrame - scene.startFrame,
      x: 80,
      y: timeline.height / 2 - 40,
      text: scene.label === "主体" ? prompt.slice(0, 48) : scene.label,
      fontSize: scene.label === "开场" ? 64 : 48,
      color: "#f8fafc",
      fontWeight: 700,
      animation: i === 0 ? "springPop" : "fadeIn",
    };
    return text;
  });

  return {
    id: "agent-generated",
    width: timeline.width,
    height: timeline.height,
    fps: timeline.fps,
    durationInFrames: timeline.durationInFrames,
    background: "#0f172a",
    items,
  };
};

export const exportDraft = async (
  timeline: VideoTimeline,
  prompt: string,
): Promise<{ draftPath: string; outPath: string }> => {
  const draft = timelineToDraft(timeline, prompt);
  await mkdir(resolve("src/generated"), { recursive: true });
  const json = JSON.stringify(draft, null, 2);
  await writeFile(GENERATED_DRAFT, json, "utf-8");
  await writeFile(OUT_DRAFT, json, "utf-8");
  return { draftPath: GENERATED_DRAFT, outPath: OUT_DRAFT };
};
