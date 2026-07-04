"""
LangGraph 编排:Agent 编排、失败恢复、资源调度、质量评测。
React(src/) 只负责画面;Node(engine/) 负责渲染;本模块负责大脑。
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, Dict, List, Literal, Optional, TypedDict

from langgraph.graph import END, StateGraph

from .code_utils import extract_code, static_check
from .llm import select_provider
from .node_bridge import PROJECT_ROOT, render_video, synth_tts, validate_engine, write_generated
from .prompts import SYSTEM_PROMPT, build_repair_message, enrich_prompt_with_tts
from .quality import evaluate_video
from .scheduler import pick_concurrency


class AgentState(TypedDict, total=False):
    prompt: str
    narration: Optional[str]
    enriched_prompt: str
    messages: Annotated[List[dict], operator.add]
    code: str
    attempts: int
    max_retries: int
    validated: bool
    last_errors: str
    skip_render: bool
    no_tts: bool
    out: str
    concurrency: Optional[int]
    video_path: Optional[str]
    quality: Optional[Dict[str, Any]]
    provider_name: str
    tts_info: Optional[Dict[str, Any]]
    error: Optional[str]


def prepare_node(state: AgentState) -> dict:
    """规划 + 可选 TTS,构建 enriched prompt 与初始消息。"""
    prompt = state["prompt"]
    tts_info = None

    if state.get("narration") and not state.get("no_tts"):
        if __import__("os").environ.get("MINI_REMOTION_TTS") != "noop":
            try:
                print("[video-agent] TTS 合成旁白…")
                tts_info = synth_tts(state["narration"], "narration")
                prompt = enrich_prompt_with_tts(
                    prompt, tts_info["mp3Path"], tts_info["durationSeconds"]
                )
            except Exception as e:
                print(f"[video-agent] TTS 跳过: {e}")

    provider = select_provider()
    return {
        "enriched_prompt": prompt,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "attempts": 0,
        "validated": False,
        "provider_name": provider.name,
        "tts_info": tts_info,
    }


def generate_node(state: AgentState) -> dict:
    """LLM 生成 TSX 代码。"""
    provider = select_provider()
    attempt = state.get("attempts", 0) + 1
    print(f"[video-agent] 生成代码(第 {attempt}/{state.get('max_retries', 3)} 次)…")

    raw = provider.complete(state["messages"])
    code = extract_code(raw)
    return {
        "code": code,
        "attempts": attempt,
        "messages": [{"role": "assistant", "content": raw}],
    }


def validate_node(state: AgentState) -> dict:
    """静态检查 → 写入 → Node 引擎 tsc+冒烟。"""
    code = state["code"]
    issues = static_check(code)
    if issues:
        err = "\n".join(f"- {i}" for i in issues)
        print(f"[video-agent] 静态检查失败")
        return {
            "validated": False,
            "last_errors": err,
            "messages": [build_repair_message(code, err)],
        }

    write_generated(code)
    print("[video-agent] 已写入 src/generated/current.tsx")

    result = validate_engine()
    if not result.get("ok"):
        parts = []
        if result.get("tsc"):
            parts.append(f"TypeScript:\n{result['tsc']}")
        if result.get("smoke"):
            parts.append(f"运行时(第0帧):\n{result['smoke']}")
        if result.get("error"):
            parts.append(str(result["error"]))
        err = "\n".join(parts) or "未知校验错误"
        print("[video-agent] 引擎校验失败")
        return {
            "validated": False,
            "last_errors": err,
            "messages": [build_repair_message(code, err)],
        }

    print("[video-agent] 校验通过 ✓")
    return {"validated": True, "last_errors": ""}


def render_node(state: AgentState) -> dict:
    """调用 Node 引擎逐帧渲染 + FFmpeg 合成。"""
    out = state.get("out") or "out/agent-video.mp4"
    conc = pick_concurrency(state.get("concurrency"))
    print(f"[video-agent] 渲染 GeneratedVideo → {out} (concurrency={conc})")
    path = render_video(comp="GeneratedVideo", out=out, concurrency=conc)
    print(f"[video-agent] ✅ 视频已导出: {path}")
    return {"video_path": path}


def evaluate_node(state: AgentState) -> dict:
    """质量评测。"""
    if not state.get("video_path"):
        return {"quality": {"ok": True, "score": 1.0, "issues": [], "skipped": True}}
    q = evaluate_video(state["video_path"])
    print(f"[video-agent] 质量评分: {q['score']:.2f} ({'通过' if q['ok'] else '有问题'})")
    if q.get("issues"):
        for i in q["issues"]:
            print(f"  - {i}")
    return {"quality": q}


def fail_node(state: AgentState) -> dict:
    return {
        "error": f"在 {state.get('max_retries', 3)} 次尝试后仍未通过校验。\n{state.get('last_errors', '')}"
    }


def route_after_validate(state: AgentState) -> Literal["generate", "render", "evaluate", "fail"]:
    if state.get("validated"):
        return "evaluate" if state.get("skip_render") else "render"
    if state.get("attempts", 0) >= state.get("max_retries", 3):
        return "fail"
    return "generate"


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("prepare", prepare_node)
    g.add_node("generate", generate_node)
    g.add_node("validate", validate_node)
    g.add_node("render", render_node)
    g.add_node("evaluate", evaluate_node)
    g.add_node("fail", fail_node)

    g.set_entry_point("prepare")
    g.add_edge("prepare", "generate")
    g.add_edge("generate", "validate")
    g.add_conditional_edges(
        "validate",
        route_after_validate,
        {
            "generate": "generate",
            "render": "render",
            "evaluate": "evaluate",
            "fail": "fail",
        },
    )
    g.add_edge("render", "evaluate")
    g.add_edge("evaluate", END)
    g.add_edge("fail", END)
    return g.compile()


def run_agent(
    *,
    prompt: str,
    narration: Optional[str] = None,
    out: str = "out/agent-video.mp4",
    max_retries: int = 3,
    concurrency: Optional[int] = None,
    skip_render: bool = False,
    no_tts: bool = False,
) -> Dict[str, Any]:
    graph = build_graph()
    final = graph.invoke(
        {
            "prompt": prompt,
            "narration": narration,
            "out": out,
            "max_retries": max_retries,
            "concurrency": concurrency,
            "skip_render": skip_render,
            "no_tts": no_tts,
            "messages": [],
        }
    )
    if final.get("error"):
        raise RuntimeError(final["error"])
    return {
        "code_path": str(PROJECT_ROOT / "src/generated/current.tsx"),
        "video_path": final.get("video_path"),
        "provider": final.get("provider_name"),
        "attempts": final.get("attempts"),
        "quality": final.get("quality"),
        "tts": final.get("tts_info"),
    }
