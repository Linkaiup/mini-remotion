"""LLM Provider: OpenAI API 与离线 stub。"""

from __future__ import annotations

import os
import re
from typing import List, Protocol

from .prompts import SYSTEM_PROMPT


class LLMProvider(Protocol):
    name: str

    def complete(self, messages: List[dict]) -> str: ...


class StubProvider:
    name = "stub"

    def complete(self, messages: List[dict]) -> str:
        user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        title = user.split("\n")[0].strip()[:40].replace("`", "'")
        return f'''```tsx
import React from "react";
import {{ interpolate, spring, useCurrentFrame }} from "../core";

export const meta = {{
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 120,
}};

export const VideoComposition: React.FC = () => {{
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 20], [0, 1], {{ extrapolateRight: "clamp" }});
  const pop = spring({{ frame, fps: meta.fps, config: {{ damping: 14 }} }});
  return (
    <div style={{{{
      position: "absolute", inset: 0,
      background: "radial-gradient(circle at 30% 20%, #1e3a8a, #0f172a 70%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", color: "#f1f5f9",
    }}}}>
      <div style={{{{
        opacity: fade, transform: `scale(${{pop}})`, fontSize: 76, fontWeight: 800,
      }}}}>
        {title}
      </div>
    </div>
  );
}};
```'''


class OpenAIProvider:
    def __init__(self) -> None:
        from openai import OpenAI

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("缺少 OPENAI_API_KEY")
        self.model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.client = OpenAI(api_key=api_key, base_url=os.environ.get("OPENAI_BASE_URL"))
        self.name = f"openai:{self.model}"

    def complete(self, messages: List[dict]) -> str:
        res = self.client.chat.completions.create(
            model=self.model,
            temperature=0.4,
            messages=messages,
        )
        return res.choices[0].message.content or ""


def select_provider() -> LLMProvider:
    explicit = os.environ.get("MINI_REMOTION_PROVIDER")
    if explicit == "stub":
        return StubProvider()
    if explicit == "openai":
        return OpenAIProvider()
    if os.environ.get("OPENAI_API_KEY"):
        return OpenAIProvider()
    print("[video-agent] 未检测到 OPENAI_API_KEY,使用 stub provider")
    return StubProvider()
