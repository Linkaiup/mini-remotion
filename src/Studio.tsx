import React, { useEffect, useMemo, useState } from "react";
import { compositions } from "./compositions";
import { usePlayer } from "./drive/usePlayer";
import { Preview } from "./render/Preview";

const formatTime = (frame: number, fps: number): string => {
  const totalSeconds = frame / fps;
  const s = Math.floor(totalSeconds);
  const cs = Math.floor((totalSeconds - s) * 100);
  return `${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
};

export const Studio: React.FC = () => {
  const [selectedId, setSelectedId] = useState(compositions[0].id);
  const composition = useMemo(
    () => compositions.find((c) => c.id === selectedId) ?? compositions[0],
    [selectedId],
  );

  const player = usePlayer({
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  });

  // 切换 composition 时回到第 0 帧
  useEffect(() => {
    player.seek(0);
    player.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 键盘:空格播放/暂停,左右箭头逐帧
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  const scale = Math.min(900 / composition.width, 520 / composition.height);

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
      {/* 侧边栏:组合列表(数据层清单) */}
      <aside
        style={{
          width: 240,
          borderRight: "1px solid #1e293b",
          padding: 16,
          boxSizing: "border-box",
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

      {/* 主区:预览 + 控制条 */}
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
        <Preview composition={composition} frame={player.frame} scale={scale} />

        <div style={{ width: composition.width * scale, maxWidth: "100%" }}>
          {/* 时间轴 seek */}
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
    </div>
  );
};
