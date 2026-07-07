import React from "react";
import ReactDOM from "react-dom/client";
import { Editor } from "./editor/Editor";
import { Studio } from "./Studio";
import { Headless } from "./render/Headless";
import { compositions } from "./compositions";

/**
 * 入口:根据 URL 参数决定模式。
 *  - 默认:可视化编辑器 (?studio=1 进入经典 Studio)
 *  - ?headless=1:导出模式(Puppeteer)
 */
const params = new URLSearchParams(window.location.search);
const headless = params.get("headless") === "1";
const useStudio = params.get("studio") === "1";
const compId = params.get("comp") ?? compositions[0].id;

// Offthread 代理端口(由 Node 渲染器注入,对照 remotion_proxyPort)
const proxyPort = params.get("proxyPort");
if (proxyPort) {
  window.__miniRemotionProxyPort = Number(proxyPort);
}
// 导出时默认启用 Offthread 视频抽帧
if (headless) {
  window.__miniRemotionVideoEnabled = params.get("video") !== "0";
  window.__miniRemotionAudioEnabled = params.get("audio") !== "0";
}

// 导出时可通过 ?props=<base64(JSON)> 覆盖默认 props(对应真实 Remotion 的 --props)
const parseInputProps = (): Record<string, unknown> => {
  const raw = params.get("props");
  if (!raw) return {};
  try {
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return {};
  }
};

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (headless) {
  document.body.style.margin = "0";
  document.body.style.background = "transparent";
  root.render(<Headless compId={compId} inputProps={parseInputProps()} />);
} else {
  document.body.style.margin = "0";
  root.render(
    <React.StrictMode>
      {useStudio ? <Studio /> : <Editor />}
    </React.StrictMode>,
  );
}
