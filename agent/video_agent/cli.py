#!/usr/bin/env python3
"""CLI: python -m video_agent.cli "视频描述" """

from __future__ import annotations

import argparse
import sys

from .graph import run_agent


def main() -> None:
    parser = argparse.ArgumentParser(description="Enhanced Video Agent (LangGraph)")
    parser.add_argument("prompt", nargs="*", help="视频描述")
    parser.add_argument("--out", default="out/agent-video.mp4")
    parser.add_argument("--narration", default=None, help="旁白文本(macOS say)")
    parser.add_argument("--no-tts", action="store_true")
    parser.add_argument("--no-render", action="store_true", help="只生成+校验")
    parser.add_argument("--concurrency", type=int, default=None)
    parser.add_argument("--max-retries", type=int, default=3)
    args = parser.parse_args()

    prompt = " ".join(args.prompt).strip()
    if not prompt:
        parser.print_help()
        sys.exit(1)

    result = run_agent(
        prompt=prompt,
        narration=args.narration,
        out=args.out,
        max_retries=args.max_retries,
        concurrency=args.concurrency,
        skip_render=args.no_render,
        no_tts=args.no_tts,
    )

    print("\n[video-agent] 完成")
    print(f"  provider: {result['provider']}")
    print(f"  attempts: {result['attempts']}")
    print(f"  code:     {result['code_path']}")
    if result.get("video_path"):
        print(f"  video:    {result['video_path']}")
    if result.get("quality"):
        print(f"  quality:  {result['quality']['score']:.2f}")
    if result.get("tts"):
        t = result["tts"]
        print(f"  audio:    public/{t['mp3Path']} ({t['durationSeconds']:.1f}s)")


if __name__ == "__main__":
    main()
