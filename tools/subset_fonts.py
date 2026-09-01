#!/usr/bin/env python3
"""
Extracts unique Chinese / CJK glyphs and punctuation used across the repository
and generates an ultra-lightweight WOFF2 font subset from GlowSansSC-Extended-Bold.otf.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from fontTools import subset

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FONT = REPO_ROOT / "assets" / "fonts" / "glowsans-sc-extended-bold.subset.woff2"

DEFAULT_SOURCE_PATHS = [
    Path.home() / "Library" / "Fonts" / "GlowSansSC-Extended-Bold.otf",
    Path.home() / ".fonts" / "GlowSansSC-Extended-Bold.otf",
    Path.home() / ".local" / "share" / "fonts" / "GlowSansSC-Extended-Bold.otf",
    REPO_ROOT / "assets" / "fonts" / "GlowSansSC-Extended-Bold.otf",
]

COMMON_PUNCTUATION = "，。！？、“”‘’（）—…《》：；【】·～「」『』〈〉〔〕"


def is_cjk(ch: str) -> bool:
    code = ord(ch)
    return (
        (0x4E00 <= code <= 0x9FFF)      # CJK Unified Ideographs
        or (0x3400 <= code <= 0x4DBF)   # CJK Unified Ideographs Extension A
        or (0x20000 <= code <= 0x2A6DF) # CJK Unified Ideographs Extension B
        or (0x3000 <= code <= 0x303F)   # CJK Symbols and Punctuation
        or (0xFF00 <= code <= 0xFFEF)   # Halfwidth and Fullwidth Forms
    )


def extract_characters() -> set[str]:
    chars: set[str] = set(COMMON_PUNCTUATION)

    # Scan markdown, html, js, css files
    extensions = {".md", ".html", ".js", ".css", ".json"}
    ignore_dirs = {".git", "node_modules", "vendor", "coverage", ".venv", ".gemini"}

    for root, dirs, files in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for f in files:
            path = Path(root) / f
            if path.suffix.lower() in extensions:
                try:
                    text = path.read_text(encoding="utf-8", errors="ignore")
                    for ch in text:
                        if is_cjk(ch):
                            chars.add(ch)
                except Exception:
                    pass

    return chars


def find_source_font() -> Path:
    for candidate in DEFAULT_SOURCE_PATHS:
        if candidate.exists() and candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "Could not find GlowSansSC-Extended-Bold.otf in any standard font paths."
    )


def subset_font(source_path: Path, chars: set[str], output_path: Path) -> None:
    text_content = "".join(sorted(chars))
    output_path.parent.mkdir(parents=True, exist_ok=True)

    options = subset.Options()
    options.flavor = "woff2"
    options.with_zopfli = False
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.glyph_names = False

    font = subset.load_font(str(source_path), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text_content)
    subsetter.subset(font)

    subset.save_font(font, str(output_path), options)


def main() -> int:
    chars = extract_characters()
    print(f"Extracted {len(chars)} unique CJK characters & punctuation symbols.")

    try:
        source_font = find_source_font()
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    print(f"Found source font: {source_font} ({source_font.stat().st_size / (1024*1024):.2f} MB)")
    print(f"Generating subset at: {OUTPUT_FONT} ...")

    subset_font(source_font, chars, OUTPUT_FONT)

    output_size_kb = OUTPUT_FONT.stat().st_size / 1024
    print(f"Done! Subset created successfully: {OUTPUT_FONT.name} ({output_size_kb:.2f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
