# -*- coding: utf-8 -*-
"""Recover UTF-8 text that was mis-decoded as cp1252 and re-saved."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    ROOT / "src/components/studio/StudioWidgetsPanel.tsx",
    ROOT / "src/components/studio/DynamicWidgetForm.tsx",
    ROOT / "src/components/studio/WidgetTestBar.tsx",
    ROOT / "src/routes/overlay/MasterOverlay.tsx",
]


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


def brand(s: str) -> str:
    reps = [
        ("BOTRIX STUDIO", "BotAxt Studio"),
        ("BOTRIX SPLIT", "BotAxt SPLIT"),
        ("botrix-widget-studio", "botaxt-widget-studio"),
        ("botrix-studio-v2", "botaxt-studio-v2"),
        ("botrix-form-tabs", "botaxt-form-tabs"),
        ("data-botrix-master", "data-botaxt-master"),
        ("MasterOverlay/botrix", "MasterOverlay/botaxt"),
        ("Botrix Studio", "BotAxt Studio"),
        ("Botrix sekmeleri", "BotAxt sekmeleri"),
        ("Botrix-style", "BotAxt"),
        ("Botrix", "BotAxt"),
        ("botrix", "botaxt"),
        ("BOTRIX", "BotAxt"),
    ]
    for a, b in reps:
        s = s.replace(a, b)
    # Keep API fallback path intact if we accidentally rewrote it
    s = s.replace('"/api/botaxt", "/api/botaxt"', '"/api/botaxt", "/api/botrix"')
    s = s.replace("`/api/botaxt/*`", "`/api/botrix/*`")
    return s


def main() -> None:
    for path in TARGETS:
        if not path.exists():
            print("skip missing", path)
            continue
        original = path.read_text(encoding="utf-8")
        fixed = brand(recover(original))
        if fixed != original:
            path.write_text(fixed, encoding="utf-8", newline="\n")
            print("fixed", path.relative_to(ROOT), "chars", len(original), "->", len(fixed))
        else:
            print("unchanged", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
