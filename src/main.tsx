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

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (headless) {
  document.body.style.margin = "0";
  document.body.style.background = "transparent";
  root.render(<Headless compId={compId} />);
} else {
  document.body.style.margin = "0";
  root.render(
    <React.StrictMode>
      <Studio />
    </React.StrictMode>,
  );
}
