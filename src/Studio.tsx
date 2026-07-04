import React, { useEffect, useMemo, useState } from "react";
import { compositions } from "./compositions";
import { usePlayer } from "./drive/usePlayer";
import { PropsEditor } from "./PropsEditor";
import { Preview } from "./render/Preview";

const formatTime = (frame: number, fps: number): string => {
  const totalSeconds = frame / fps;
  const s = Math.floor(totalSeconds);
  const cs = Math.floor((totalSeconds - s) * 100);
  return `${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
};

const encodeProps = (props: Record<string, unknown>): string =>
  btoa(unescape(encodeURIComponent(JSON.stringify(props))));

export const Studio: React.FC = () => {
  const [selectedId, setSelectedId] = useState(compositions[0].id);
  const composition = useMemo(
    () => compositions.find((c) => c.id === selectedId) ?? compositions[0],
    [selectedId],
  );

  // 每个 composition 各自维护一份当前 props(初值 = defaultProps)
  const [propsMap, setPropsMap] = useState<
    Record<string, Record<string, unknown>>
  >(() =>
    Object.fromEntries(
      compositions.map((c) => [c.id, { ...c.defaultProps }]),
    ),
  );
  const currentProps = propsMap[selectedId] ?? {};
  const setCurrentProps = (v: Record<string, unknown>) =>
    setPropsMap((m) => ({ ...m, [selectedId]: v }));
  const resetProps = () =>
    setPropsMap((m) => ({ ...m, [selectedId]: { ...composition.defaultProps } }));

  const player = usePlayer({
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  });

  useEffect(() => {
    player.seek(0);
    player.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        player.toggle();
      } else if (e.code === "ArrowRight") {
        player.seek(player.frame + 1);
      } else if (e.code === "ArrowLeft") {
        player.seek(player.frame - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player]);

  const scale = Math.min(760 / composition.width, 460 / composition.height);

  const hasSchema = Boolean(composition.schema);
  const renderCmd = hasSchema
    ? `npm run render -- --comp ${composition.id} --props ${encodeProps(currentProps)}`
    : `npm run render -- --comp ${composition.id}`;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#0b1120",
        color: "#e2e8f0",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 左侧:组合列表(数据层清单) */}
      <aside
        style={{
          width: 220,
          borderRight: "1px solid #1e293b",
          padding: 16,
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
          🎬 Mini Remotion
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
          COMPOSITIONS
        </div>
        {compositions.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              marginBottom: 4,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: c.id === selectedId ? "#1d4ed8" : "transparent",
              color: c.id === selectedId ? "#fff" : "#cbd5e1",
              fontSize: 14,
            }}
          >
            {c.id}
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              {c.width}×{c.height} · {c.fps}fps · {c.durationInFrames}f
            </div>
          </button>
        ))}
      </aside>

      {/* 中间:预览 + 控制条 */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
        }}
      >
        <Preview
          composition={composition}
          frame={player.frame}
          scale={scale}
          playing={player.playing}
          inputProps={currentProps}
        />

        <div style={{ width: composition.width * scale, maxWidth: "100%" }}>
          <input
            type="range"
            min={0}
            max={composition.durationInFrames - 1}
            value={player.frame}
            onChange={(e) => player.seek(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#3b82f6" }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 12,
            }}
          >
            <button
              onClick={player.toggle}
              style={{
                width: 96,
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: "#3b82f6",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {player.playing ? "⏸ 暂停" : "▶ 播放"}
            </button>

            <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
              帧 {player.frame} / {composition.durationInFrames - 1} ·{" "}
              {formatTime(player.frame, composition.fps)}
            </div>

            <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              空格=播放/暂停 · ←/→=逐帧
            </div>
          </div>
        </div>
      </main>

      {/* 右侧:props 编辑器(schema → 表单) */}
      <aside
        style={{
          width: 300,
          borderLeft: "1px solid #1e293b",
          padding: 16,
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        <PropsEditor
          schema={composition.schema}
          value={currentProps}
          onChange={setCurrentProps}
          onReset={resetProps}
        />

        {hasSchema ? (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
              用当前参数导出:
            </div>
            <textarea
              readOnly
              value={renderCmd}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: "100%",
                height: 90,
                background: "#0b1120",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "#7dd3fc",
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                padding: 8,
                boxSizing: "border-box",
                resize: "none",
              }}
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
};
