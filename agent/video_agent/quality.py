"""质量评测:对导出视频做基础检查(可扩展视觉模型)。"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Dict, List


def evaluate_video(path: str) -> Dict[str, Any]:
    p = Path(path)
    issues: List[str] = []
    score = 1.0

    if not p.exists():
        return {"ok": False, "score": 0.0, "issues": ["视频文件不存在"]}

    size = p.stat().st_size
    if size < 1024:
        issues.append(f"视频过小({size} bytes)")
        score -= 0.5

    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(p),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        data = json.loads(proc.stdout)
        duration = float(data.get("format", {}).get("duration", 0))
        if duration <= 0:
            issues.append("视频时长为 0")
            score -= 0.5
    except Exception as e:
        issues.append(f"ffprobe 失败: {e}")
        score -= 0.3

    score = max(0.0, min(1.0, score))
    return {
        "ok": len(issues) == 0,
        "score": score,
        "issues": issues,
        "path": str(p),
    }
