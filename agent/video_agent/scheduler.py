"""资源调度:根据 CPU 与请求决定渲染并发度。"""

from __future__ import annotations

import os


def pick_concurrency(requested: Optional[int] = None) -> int:
    if requested is not None and requested > 0:
        return min(requested, 8)
    cpus = os.cpu_count() or 4
    # 留一半 CPU 给系统与其它浏览器进程
    return max(1, min(4, cpus // 2 or 1))
