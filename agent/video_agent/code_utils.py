"""代码抽取与静态契约检查(Python 侧,在调用 Node 引擎前拦截)。"""

import re
from typing import Any, Dict, List


def extract_code(text: str) -> str:
    m = re.search(r"```(?:tsx|ts|jsx|js)?\s*\n([\s\S]*?)```", text)
    return (m.group(1) if m else text).strip()


def static_check(code: str) -> List[str]:
    issues: List[str] = []

    if not re.search(r"export\s+const\s+meta\s*=", code):
        issues.append("缺少 `export const meta = { ... }`。")
    if not re.search(r"export\s+const\s+VideoComposition\s*:", code):
        issues.append("缺少 `export const VideoComposition: React.FC`。")

    for m in re.finditer(r'import[^;]*?from\s*["\']([^"\']+)["\']', code):
        src = m.group(1)
        if src not in ("react", "../core"):
            issues.append(f'禁止的 import:"{src}"(只允许 "react" 或 "../core")。')

    forbidden = [
        (r"Math\.random\s*\(", "禁止 Math.random()(请用 random(seed))。"),
        (r"Date\.now\s*\(", "禁止 Date.now()。"),
        (r"new\s+Date\s*\(", "禁止 new Date()。"),
        (r"\bfetch\s*\(", "禁止 fetch()。"),
        (r"setTimeout\s*\(", "禁止 setTimeout()。"),
        (r"setInterval\s*\(", "禁止 setInterval()。"),
        (r"requestAnimationFrame\s*\(", "禁止 requestAnimationFrame()。"),
    ]
    for pattern, msg in forbidden:
        if re.search(pattern, code):
            issues.append(msg)

    return issues
