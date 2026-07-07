import React, { useCallback, useEffect, useRef, useState } from "react";
import { staticFile } from "../core";
import { ANIMATION_OPTIONS } from "./animations";
import { applyEditorPatch, describePatchOps } from "./apply-patch";
import { callEditorAgent } from "./agent-client";
import { EditorPreview } from "./EditorPreview";
import { EFFECT_OPTIONS } from "./effects";
import { findTrackByKind } from "./normalize-project";
import {
  probeAudioDurationInFrames,
  probeVideoDurationInFrames,
} from "./media-duration";
import {
  createSampleEditorProject,
  downloadProjectJson,
  saveEditorProject,
} from "./sample-project";
import { EditorProvider, useEditor } from "./store";
import type { EditorClip, TrackKind } from "./types";

const formatTime = (frame: number, fps: number): string => {
  const s = frame / fps;
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  const cs = String(Math.floor((s % 1) * 100)).padStart(2, "0");
  return `${mm}:${ss}.${cs}`;
};

const panelBg = "#0b1120";
const border = "#1e293b";
const accent = "#3b82f6";
const muted = "#64748b";

const TopBar: React.FC = () => {
  const { project, dispatch, past, future, persist } = useEditor();

  return (
    <header
      style={{
        height: 48,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        borderBottom: `1px solid ${border}`,
        gap: 12,
        background: panelBg,
      }}
    >
      <span style={{ fontWeight: 700 }}>🎬 可视化编辑器</span>
      <span style={{ fontSize: 12, color: muted }}>{project.name}</span>
      <span style={{ fontSize: 12, color: muted }}>
        {project.width}×{project.height}
      </span>
      <a
        href="/?studio=1"
        style={{ fontSize: 12, color: "#7dd3fc", marginLeft: 8, textDecoration: "none" }}
      >
        经典 Studio
      </a>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={past.length === 0}
          onClick={() => dispatch({ type: "UNDO" })}
          style={btnStyle}
        >
          ↶ 撤销
        </button>
        <button
          type="button"
          disabled={future.length === 0}
          onClick={() => dispatch({ type: "REDO" })}
          style={btnStyle}
        >
          ↷ 重做
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("重置为示例项目？当前未导出内容将丢失。")) return;
            const fresh = createSampleEditorProject();
            saveEditorProject(fresh);
            dispatch({ type: "SET_PROJECT", project: fresh, pushHistory: false });
            dispatch({
              type: "SELECT",
              selection: { trackId: "track-text", clipId: "clip-title" },
            });
            dispatch({ type: "SET_FRAME", frame: 0 });
          }}
          style={btnStyle}
        >
          重置项目
        </button>
        <button
          type="button"
          onClick={() => {
            persist();
            downloadProjectJson(project);
          }}
          style={{ ...btnStyle, background: accent, color: "#fff", border: "none" }}
        >
          导出
        </button>
      </div>
    </header>
  );
};

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: `1px solid ${border}`,
  background: "transparent",
  color: "#e2e8f0",
  cursor: "pointer",
  fontSize: 13,
};

const AssetLibrary: React.FC = () => {
  const { project, dispatch, frame } = useEditor();
  const [tab, setTab] = useState<"media" | "text" | "sticker" | "effect" | "audio">(
    "media",
  );
  const [hint, setHint] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState<TrackKind | null>(null);

  const showHint = (msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(null), 2500);
  };

  const addClip = (
    kind: TrackKind,
    partial: Partial<EditorClip>,
    durationInFrames?: number,
  ) => {
    const track = findTrackByKind(project, kind);
    if (!track) {
      showHint(`找不到「${kind}」轨道，请刷新页面重试`);
      return;
    }
    const id = `clip-${Date.now()}`;
    const from = frame;
    const defaultDuration =
      kind === "text" || kind === "sticker"
        ? Math.min(90, project.durationInFrames - from) || 90
        : Math.max(1, project.durationInFrames - from) || project.durationInFrames;
    const base = {
      id,
      from,
      durationInFrames: durationInFrames ?? partial.durationInFrames ?? defaultDuration,
      x: 120,
      y: 120,
      scale: 1,
      opacity: 1,
      label: "新片段",
      animation: "fadeIn" as const,
      effect: "none" as const,
      ...partial,
    } as EditorClip;

    dispatch({ type: "ADD_CLIP", trackId: track.id, clip: base });
    const sec = (base.durationInFrames / project.fps).toFixed(1);
    showHint(`已添加到「${track.name}」轨道，时长 ${sec}s`);
  };

  const addVideoClip = async (partial: Partial<EditorClip> & { src: string }) => {
    showHint("正在读取视频时长…");
    const durationInFrames = await probeVideoDurationInFrames(
      partial.src,
      project.fps,
    );
    addClip("video", partial, durationInFrames);
  };

  const addAudioClip = async (partial: Partial<EditorClip> & { src: string }) => {
    showHint("正在读取音频时长…");
    const durationInFrames = await probeAudioDurationInFrames(
      partial.src,
      project.fps,
    );
    addClip("audio", partial, durationInFrames);
  };

  const openFilePicker = (kind: TrackKind, accept: string) => {
    setPendingKind(kind);
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.click();
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const kind = pendingKind;
    setPendingKind(null);
    if (!file || !kind) return;

    const url = URL.createObjectURL(file);
    if (kind === "video") {
      void addVideoClip({
        type: "video",
        src: url,
        width: 640,
        height: 360,
        x: 320,
        y: 180,
        label: file.name,
      });
    } else if (kind === "sticker") {
      addClip("sticker", {
        type: "image",
        src: url,
        width: 200,
        height: 200,
        x: 200,
        y: 200,
        label: file.name,
      });
    } else if (kind === "audio") {
      void addAudioClip({
        type: "audio",
        src: url,
        volume: 0.85,
        x: 0,
        y: 0,
        label: file.name,
      });
    }
  };

  const tabs = [
    { id: "media" as const, label: "媒体" },
    { id: "text" as const, label: "文字" },
    { id: "sticker" as const, label: "贴纸" },
    { id: "effect" as const, label: "特效" },
    { id: "audio" as const, label: "音频" },
  ];

  return (
    <aside
      style={{
        width: 200,
        borderRight: `1px solid ${border}`,
        background: panelBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", padding: 8, gap: 4 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...btnStyle,
              textAlign: "left",
              background: tab === t.id ? "#1e3a5f" : "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 12, fontSize: 12, color: muted, flex: 1 }}>
        <input
          ref={fileRef}
          type="file"
          style={{ display: "none" }}
          onChange={onFilePicked}
        />
        {hint ? (
          <div
            style={{
              marginBottom: 10,
              padding: 8,
              borderRadius: 6,
              background: "#14532d",
              color: "#bbf7d0",
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            {hint}
          </div>
        ) : null}
        {tab === "media" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              style={{ ...btnStyle, width: "100%" }}
              onClick={() => openFilePicker("video", "video/*")}
            >
              + 导入视频文件
            </button>
            <button
              type="button"
              style={{ ...btnStyle, width: "100%" }}
              onClick={() =>
                void addVideoClip({
                  type: "video",
                  src: staticFile("sample.mp4"),
                  width: 640,
                  height: 360,
                  x: 320,
                  y: 180,
                  label: "示例视频",
                })
              }
            >
              + 添加示例视频
            </button>
          </div>
        )}
        {tab === "text" && (
          <button
            type="button"
            style={{ ...btnStyle, width: "100%" }}
            onClick={() =>
              addClip("text", {
                type: "text",
                text: "新标题",
                fontSize: 48,
                color: "#fff",
                fontWeight: 700,
                animation: "bounceIn",
              })
            }
          >
            + 添加文字
          </button>
        )}
        {tab === "audio" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              style={{ ...btnStyle, width: "100%" }}
              onClick={() => openFilePicker("audio", "audio/*")}
            >
              + 导入音频文件
            </button>
            <button
              type="button"
              style={{ ...btnStyle, width: "100%" }}
              onClick={() =>
                void addAudioClip({
                  type: "audio",
                  src: staticFile("audio.mp3"),
                  volume: 0.8,
                  x: 0,
                  y: 0,
                  label: "示例音频",
                })
              }
            >
              + 添加示例音频
            </button>
          </div>
        )}
        {tab === "sticker" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              style={{ ...btnStyle, width: "100%" }}
              onClick={() => openFilePicker("sticker", "image/*")}
            >
              + 导入图片贴纸
            </button>
            <button
              type="button"
              style={{ ...btnStyle, width: "100%" }}
              onClick={() =>
                addClip("sticker", {
                  type: "image",
                  src: staticFile("logo.svg"),
                  width: 120,
                  height: 120,
                  x: 200,
                  y: 200,
                  label: "logo",
                  effect: "zoomPulse",
                })
              }
            >
              + 添加 logo 贴纸
            </button>
          </div>
        )}
        {tab === "effect" && (
          <p style={{ lineHeight: 1.5 }}>
            选中片段后，在右侧检查器中选择「特效」。
          </p>
        )}
      </div>
    </aside>
  );
};

const Inspector: React.FC = () => {
  const { selectedClip, updateClip, project } = useEditor();
  if (!selectedClip) {
    return (
      <aside
        style={{
          width: 260,
          borderLeft: `1px solid ${border}`,
          padding: 16,
          background: panelBg,
          fontSize: 13,
          color: muted,
        }}
      >
        检查器 — 选中片段以编辑位置、时长、动画与特效。
      </aside>
    );
  }

  if (selectedClip.type === "audio") {
    return (
      <aside
        style={{
          width: 260,
          borderLeft: `1px solid ${border}`,
          padding: 16,
          background: panelBg,
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>检查器 · 音频</div>
        <Field label="标签">
          <input
            type="text"
            value={selectedClip.label ?? ""}
            onChange={(e) => updateClip({ label: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <Field label={`时长（帧，约 ${(selectedClip.durationInFrames / project.fps).toFixed(1)}s）`}>
          <input
            type="number"
            min={1}
            value={selectedClip.durationInFrames}
            onChange={(e) =>
              updateClip({ durationInFrames: Math.max(1, Number(e.target.value)) })
            }
            style={inputStyle}
          />
        </Field>
        <Field label={`音量 ${(selectedClip.volume ?? 1).toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={selectedClip.volume ?? 1}
            onChange={(e) => updateClip({ volume: Number(e.target.value) })}
            style={{ width: "100%", accentColor: accent }}
          />
        </Field>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 260,
        borderLeft: `1px solid ${border}`,
        padding: 16,
        background: panelBg,
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>检查器</div>
      <Field label="位置 X">
        <input
          type="number"
          value={selectedClip.x}
          onChange={(e) => updateClip({ x: Number(e.target.value) })}
          style={inputStyle}
        />
      </Field>
      {selectedClip.type === "video" ? (
        <>
          <Field
            label={`时长（帧，约 ${(selectedClip.durationInFrames / project.fps).toFixed(1)}s）`}
          >
            <input
              type="number"
              min={1}
              value={selectedClip.durationInFrames}
              onChange={(e) =>
                updateClip({ durationInFrames: Math.max(1, Number(e.target.value)) })
              }
              style={inputStyle}
            />
          </Field>
          <Field label="原声">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!selectedClip.muted}
                onChange={(e) => updateClip({ muted: !e.target.checked })}
              />
              播放视频原声
            </label>
          </Field>
          {!selectedClip.muted ? (
            <Field label={`原声音量 ${(selectedClip.volume ?? 1).toFixed(2)}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedClip.volume ?? 1}
                onChange={(e) => updateClip({ volume: Number(e.target.value) })}
                style={{ width: "100%", accentColor: accent }}
              />
            </Field>
          ) : null}
        </>
      ) : null}
      <Field label="位置 Y">
        <input
          type="number"
          value={selectedClip.y}
          onChange={(e) => updateClip({ y: Number(e.target.value) })}
          style={inputStyle}
        />
      </Field>
      <Field label={`缩放 ${selectedClip.scale.toFixed(2)}`}>
        <input
          type="range"
          min={0.1}
          max={2}
          step={0.01}
          value={selectedClip.scale}
          onChange={(e) => updateClip({ scale: Number(e.target.value) })}
          style={{ width: "100%", accentColor: accent }}
        />
      </Field>
      <Field label={`不透明度 ${(selectedClip.opacity ?? 1).toFixed(2)}`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={selectedClip.opacity ?? 1}
          onChange={(e) => updateClip({ opacity: Number(e.target.value) })}
          style={{ width: "100%", accentColor: accent }}
        />
      </Field>
      <Field label="动画">
        <select
          value={selectedClip.animation ?? "none"}
          onChange={(e) =>
            updateClip({
              animation: e.target.value as EditorClip["animation"],
            })
          }
          style={inputStyle}
        >
          {ANIMATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="特效">
        <select
          value={selectedClip.effect ?? "none"}
          onChange={(e) =>
            updateClip({ effect: e.target.value as EditorClip["effect"] })
          }
          style={inputStyle}
        >
          {EFFECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      {selectedClip.type === "text" ? (
        <Field label="文字">
          <input
            type="text"
            value={selectedClip.text}
            onChange={(e) => updateClip({ text: e.target.value })}
            style={inputStyle}
          />
        </Field>
      ) : null}
    </aside>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#020617",
  border: `1px solid ${border}`,
  borderRadius: 6,
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 13,
};

const Timeline: React.FC = () => {
  const { project, frame, dispatch, selection } = useEditor();
  const pxPerFrame = 3;

  return (
    <div
      style={{
        height: 200,
        borderTop: `1px solid ${border}`,
        background: "#020617",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "8px 12px",
          borderBottom: `1px solid ${border}`,
        }}
      >
        <button type="button" style={btnStyle} onClick={() => dispatch({ type: "SPLIT_AT_PLAYHEAD" })}>
          分割
        </button>
        <button type="button" style={btnStyle} onClick={() => dispatch({ type: "DELETE_SELECTION" })}>
          删除
        </button>
        <span style={{ fontSize: 12, color: muted, lineHeight: "32px" }}>
          变速：在检查器调整 playbackRate（后续）
        </span>
      </div>
      <div style={{ flex: 1, overflow: "auto", position: "relative", padding: 8 }}>
        <div
          style={{
            position: "absolute",
            left: 120 + frame * pxPerFrame,
            top: 0,
            bottom: 0,
            width: 2,
            background: "#ef4444",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
        {project.tracks.map((track) => (
          <div
            key={track.id}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 6,
              minHeight: 36,
            }}
          >
            <div
              style={{
                width: 100,
                fontSize: 12,
                color: muted,
                flexShrink: 0,
              }}
            >
              {track.name}
            </div>
            <div style={{ position: "relative", flex: 1, height: 32 }}>
              {track.clips.map((clip) => {
                const selected =
                  selection?.clipId === clip.id &&
                  selection.trackId === track.id;
                return (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "SELECT",
                        selection: { trackId: track.id, clipId: clip.id },
                      })
                    }
                    style={{
                      position: "absolute",
                      left: clip.from * pxPerFrame,
                      width: Math.max(clip.durationInFrames * pxPerFrame, 24),
                      height: 28,
                      top: 2,
                      borderRadius: 4,
                      border: selected
                        ? `2px solid ${accent}`
                        : "1px solid #334155",
                      background:
                        track.kind === "video"
                          ? "#1d4ed8"
                          : track.kind === "text"
                            ? "#7c3aed"
                            : track.kind === "audio"
                              ? "#059669"
                              : "#d97706",
                      color: "#fff",
                      fontSize: 11,
                      cursor: "pointer",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      padding: "0 6px",
                    }}
                  >
                    {clip.label ?? clip.id}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AgentPanel: React.FC = () => {
  const { project, dispatch, agentMessages, agentBusy } = useEditor();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentMessages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || agentBusy) return;
    setInput("");
    const userId = `u-${Date.now()}`;
    dispatch({
      type: "AGENT_ADD_MESSAGE",
      message: { id: userId, role: "user", content: text },
    });
    dispatch({ type: "AGENT_SET_BUSY", busy: true });
    const result = await callEditorAgent({ project, message: text });
    const assistantId = `a-${Date.now()}`;
    dispatch({
      type: "AGENT_ADD_MESSAGE",
      message: {
        id: assistantId,
        role: "assistant",
        content: result.reply,
        patch: result.patch ?? undefined,
        patchStatus: result.patch ? "pending" : undefined,
      },
    });
    dispatch({ type: "AGENT_SET_BUSY", busy: false });
  }, [input, agentBusy, project, dispatch]);

  return (
    <aside
      style={{
        width: 300,
        borderLeft: `1px solid ${border}`,
        background: panelBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>
        Agent
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
        {agentMessages.length === 0 ? (
          <p style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>
            用自然语言编辑时间轴，例如：
            <br />「标题改成弹入」
            <br />「旁白后移 1 秒」
          </p>
        ) : null}
        {agentMessages.map((m) => (
          <div
            key={m.id}
            style={{
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              background: m.role === "user" ? "#1e293b" : "#0f172a",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>
              {m.role === "user" ? "你" : "Agent"}
            </div>
            {m.content}
            {m.patch && m.patchStatus === "pending" ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "#7dd3fc", marginBottom: 6 }}>
                  {describePatchOps(m.patch).map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    style={{ ...btnStyle, background: "#166534", border: "none" }}
                    onClick={() => {
                      dispatch({ type: "APPLY_PATCH", patch: m.patch! });
                      dispatch({
                        type: "AGENT_UPDATE_MESSAGE",
                        id: m.id,
                        patch: { patchStatus: "accepted" },
                      });
                      saveEditorProject(applyEditorPatch(project, m.patch!));
                    }}
                  >
                    接受
                  </button>
                  <button
                    type="button"
                    style={btnStyle}
                    onClick={() =>
                      dispatch({
                        type: "AGENT_UPDATE_MESSAGE",
                        id: m.id,
                        patch: { patchStatus: "rejected" },
                      })
                    }
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {agentBusy ? (
          <div style={{ color: muted, fontSize: 12 }}>思考中…</div>
        ) : null}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${border}` }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="输入指令…"
          style={inputStyle}
        />
      </div>
    </aside>
  );
};

const EditorShell: React.FC = () => {
  const { project, frame, playing, dispatch } = useEditor();
  const scale = Math.min(1, 640 / project.width, 360 / project.height);

  const onTransportFrame = useCallback(
    (f: number) => dispatch({ type: "SET_FRAME", frame: f }),
    [dispatch],
  );
  const onTransportEnd = useCallback(() => {
    dispatch({ type: "SET_FRAME", frame: project.durationInFrames - 1 });
    dispatch({ type: "SET_PLAYING", playing: false });
  }, [dispatch, project.durationInFrames]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: panelBg,
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <TopBar />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <AssetLibrary />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <EditorPreview
              project={project}
              frame={frame}
              scale={scale}
              playing={playing}
              onTransportFrame={onTransportFrame}
              onTransportEnd={onTransportEnd}
            />
          </div>
          <div style={{ padding: "0 16px 12px" }}>
            <input
              type="range"
              min={0}
              max={project.durationInFrames - 1}
              value={frame}
              onChange={(e) =>
                dispatch({ type: "SET_FRAME", frame: Number(e.target.value) })
              }
              style={{ width: "100%", accentColor: accent }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_FRAME", frame: frame - 1 })}
                style={btnStyle}
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "SET_PLAYING", playing: !playing })
                }
                style={{ ...btnStyle, minWidth: 72 }}
              >
                {playing ? "暂停" : "播放"}
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_FRAME", frame: frame + 1 })}
                style={btnStyle}
              >
                ⏭
              </button>
              <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {formatTime(frame, project.fps)} /{" "}
                {formatTime(project.durationInFrames - 1, project.fps)}
              </span>
            </div>
          </div>
          <Timeline />
        </div>
        <Inspector />
        <AgentPanel />
      </div>
    </div>
  );
};

export const Editor: React.FC = () => (
  <EditorProvider>
    <EditorShell />
  </EditorProvider>
);
