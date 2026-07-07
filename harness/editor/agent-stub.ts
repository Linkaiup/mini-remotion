import type { EditorAnimation, EditorPatch, EditorProject } from "../../src/editor/types.js";
import type { EditorAgentResponse } from "./agent.js";

const findTextClip = (project: EditorProject) => {
  for (const t of project.tracks) {
    if (t.kind !== "text") continue;
    const clip = t.clips.find((c) => c.type === "text");
    if (clip) return { trackId: t.id, clip: clip };
  }
  return null;
};

const findAudioClip = (project: EditorProject) => {
  for (const t of project.tracks) {
    if (t.kind !== "audio") continue;
    const clip = t.clips[0];
    if (clip) return { trackId: t.id, clip };
  }
  return null;
};

const animFromText = (text: string): EditorAnimation | null => {
  if (/弹入|bounce/i.test(text)) return "bounceIn";
  if (/弹簧|spring/i.test(text)) return "springPop";
  if (/淡入|fade/i.test(text)) return "fadeIn";
  if (/左滑|slide.*左/i.test(text)) return "slideInLeft";
  if (/右滑/i.test(text)) return "slideInRight";
  return null;
};

/** 离线规则 Agent：覆盖 UI 稿中的典型指令 */
export const runEditorAgentStub = (
  project: EditorProject,
  message: string,
): EditorAgentResponse => {
  const msg = message.trim();
  const ops: EditorPatch["ops"] = [];
  let summary = "";

  const title = findTextClip(project);
  if (title && /标题/.test(msg)) {
    const anim = animFromText(msg);
    if (anim) {
      ops.push({
        op: "update_clip",
        trackId: title.trackId,
        clipId: title.clip.id,
        patch: { animation: anim },
      });
      summary = `将标题动画改为「${anim}」`;
    }
    const textMatch = msg.match(/标题(?:改成|改为|换成)[「"']?([^「」"'\n]+)/);
    if (textMatch && title.clip.type === "text") {
      ops.push({
        op: "update_clip",
        trackId: title.trackId,
        clipId: title.clip.id,
        patch: { text: textMatch[1].trim() },
      });
      summary = `更新标题文字`;
    }
  }

  const audio = findAudioClip(project);
  const moveMatch = msg.match(
    /(?:旁白|音频|配音).*?(后移|前移|延迟|提前).*?(\d+(?:\.\d+)?)\s*秒/,
  );
  if (audio && moveMatch) {
    const sec = Number(moveMatch[2]);
    const delta = /前移|提前/.test(moveMatch[1]) ? -sec : sec;
    const frames = Math.round(delta * project.fps);
    ops.push({
      op: "move_clip",
      trackId: audio.trackId,
      clipId: audio.clip.id,
      from: Math.max(0, audio.clip.from + frames),
    });
    summary = summary || `旁白时间轴 ${delta > 0 ? "后移" : "前移"} ${Math.abs(sec)} 秒`;
  }

  if (/模糊|blur/i.test(msg) && title) {
    ops.push({
      op: "update_clip",
      trackId: title.trackId,
      clipId: title.clip.id,
      patch: { effect: "blur" },
    });
    summary = summary || "为标题添加模糊入场特效";
  }

  if (ops.length === 0) {
    return {
      reply:
        "暂未匹配到可执行规则。可尝试：「标题改成弹入」「旁白后移 1 秒」「标题改成 新品发布」。配置 LLM API 后可理解更复杂指令。",
      patch: null,
    };
  }

  return {
    reply: `已生成 ${ops.length} 项修改，请确认是否应用到项目。`,
    patch: { summary: summary || msg, ops },
  };
};
