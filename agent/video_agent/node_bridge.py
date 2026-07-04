"""调用 Node.js 渲染引擎(engine/*)的桥接层。"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict

# mini-remotion 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _run_tsx(script: str, args: list[str], *, inherit_stdio: bool = False) -> subprocess.CompletedProcess:
    cmd = [str(PROJECT_ROOT / "node_modules/.bin/tsx"), script, *args]
    env = {**os.environ, "PUPPETEER_CACHE_DIR": str(PROJECT_ROOT / ".puppeteer-cache")}
    return subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=not inherit_stdio,
        text=True,
        env=env,
    )


def write_generated(code: str) -> str:
    tmp = PROJECT_ROOT / ".agent-tmp-code.tsx"
    tmp.write_text(code, encoding="utf-8")
    proc = _run_tsx("engine/write-generated.ts", ["--code-file", str(tmp)])
    tmp.unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(f"write-generated 失败: {proc.stderr or proc.stdout}")
    data = json.loads(proc.stdout.strip())
    if not data.get("ok"):
        raise RuntimeError(data.get("error", "write-generated unknown error"))
    return data["path"]


def validate_engine() -> Dict[str, Any]:
    proc = _run_tsx("engine/validate.ts", [])
    out = (proc.stdout or "").strip()
    try:
        return json.loads(out) if out else {"ok": False, "error": proc.stderr}
    except json.JSONDecodeError:
        return {"ok": False, "error": out or proc.stderr or "validate parse error"}


def render_video(
    *,
    comp: str = "GeneratedVideo",
    out: str = "out/agent-video.mp4",
    concurrency: int = 3,
) -> str:
    out_path = PROJECT_ROOT / out
    proc = _run_tsx(
        "engine/render-job.ts",
        ["--comp", comp, "--out", out, "--concurrency", str(concurrency)],
        inherit_stdio=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"render-job 失败 exit={proc.returncode}")

    # 内层 FFmpeg 日志会混入 stdout,优先以产物文件为准
    if out_path.exists() and out_path.stat().st_size > 0:
        return str(out_path)

    out_text = (proc.stdout or "").strip()
    if out_text:
        try:
            data = json.loads(out_text.splitlines()[-1])
            if data.get("ok"):
                return data["path"]
        except json.JSONDecodeError:
            pass
    raise RuntimeError(f"渲染未产出有效文件: {out_path}")


def synth_tts(text: str, basename: str = "narration") -> Dict[str, Any]:
    proc = _run_tsx(
        "engine/tts-job.ts",
        ["--text", text, "--basename", basename],
    )
    data = json.loads((proc.stdout or "{}").strip() or "{}")
    if not data.get("ok"):
        raise RuntimeError(data.get("error", "tts failed"))
    return data
