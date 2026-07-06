import React from "react";
import ReactDOM from "react-dom/client";
import { Studio } from "./Studio";
import { Headless } from "./render/Headless";
import { compositions } from "./compositions";

/**
 * 入口:根据 URL 参数决定进入哪种模式。
 *  - 默认:Studio(交互预览,驱动层用 rAF)
 *  - ?headless=1&comp=<id>:导出模式(驱动层由 Node 端 Puppeteer 控制)
 */
const params = new URLSearchParams(window.location.search);
const headless = params.get("headless") === "1";
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
      <Studio />
    </React.StrictMode>,
  );
}
