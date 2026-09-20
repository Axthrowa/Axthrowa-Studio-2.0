# -*- coding: utf-8 -*-
"""Scan src for leftover UTF-8 mojibake and fix."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"


def recover(s: str) -> str:
    out: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        matched = False
        for size in (3, 2):
            if i + size > n:
                continue
            chunk = s[i : i + size]
            try:
                raw = chunk.encode("cp1252")
            except UnicodeEncodeError:
                continue
            if raw[0] < 0x80:
                continue
            try:
                decoded = raw.decode("utf-8")
            except UnicodeDecodeError:
                continue
            if decoded.encode("utf-8") == raw and len(decoded) < size:
                out.append(decoded)
                i += size
                matched = True
                break
        if not matched:
            out.append(s[i])
            i += 1
    return "".join(out)


def looks_mojibake(s: str) -> bool:
    markers = (
        "Ã§",
        "Ã¶",
        "Ã¼",
        "Ã‡",
        "Ã–",
        "Ãœ",
        "Ä±",
        "ÄŸ",
        "ÅŸ",
        "Â·",
        "â€™",
        "â€”",
        "â€œ",
        "â€",
        "Ã ",
    )
    return any(m in s for m in markers)


def main() -> None:
    fixed_files = 0
    for path in ROOT.rglob("*"):
        if path.suffix.lower() not in {".ts", ".tsx", ".css", ".json", ".md", ".html"}:
            continue
        if "node_modules" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        if not looks_mojibake(text):
            continue
        new = recover(text)
        # Brand replacements in UI sources only
        if path.suffix in {".ts", ".tsx"} and "api/botaxt" not in str(path).replace("\\", "/"):
            new = (
                new.replace("BOTRIX STUDIO", "BotAxt Studio")
                .replace("Botrix Studio", "BotAxt Studio")
                .replace("Botrix", "BotAxt")
                .replace("BOTRIX", "BotAxt")
                .replace("botrix-widget-studio", "botaxt-widget-studio")
                .replace("botrix-studio-v2", "botaxt-studio-v2")
                .replace("botrix-form-tabs", "botaxt-form-tabs")
                .replace("data-botrix-master", "data-botaxt-master")
                .replace("MasterOverlay/botrix", "MasterOverlay/botaxt")
            )
            # don't blindly replace remaining botrix in API files — already skipped
        if new != text:
            path.write_text(new, encoding="utf-8", newline="\n")
            fixed_files += 1
            print("fixed", path.relative_to(ROOT.parent))
        else:
            print("detected but unchanged", path.relative_to(ROOT.parent))
    print("done, files=", fixed_files)


if __name__ == "__main__":
    main()
