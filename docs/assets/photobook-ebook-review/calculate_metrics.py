#!/usr/bin/env python3
"""Reproduce quantitative checks for the photobook architecture review."""

from itertools import combinations
from math import ceil
import json


def relative_luminance(hex_color):
    channels = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(foreground, background):
    fg = relative_luminance(foreground)
    bg = relative_luminance(background)
    return (max(fg, bg) + 0.05) / (min(fg, bg) + 0.05)


def effective_ppi(width_px, height_px, width_mm, height_mm):
    return min(width_px / (width_mm / 25.4), height_px / (height_mm / 25.4))


def pair_counts(groups):
    total = sum(groups.values())
    all_pairs = total * (total - 1) // 2
    intra = sum(count * (count - 1) // 2 for count in groups.values())
    return {"all": all_pairs, "intra_series": intra, "cross_series": all_pairs - intra}


result = {
    "bw_pairs": pair_counts({"p1": 18, "p6": 32, "p5": 1}),
    "color_pairs": pair_counts({"p2": 21, "p3": 23, "p4": 20, "p5": 12}),
    "web_tier": {
        "trim_ppi": effective_ppi(2048, 1365, 300, 200),
        "bleed_3mm_ppi": effective_ppi(2048, 1365, 306, 206),
        "max_width_at_200_ppi_mm": 2048 / 200 * 25.4,
        "max_width_at_240_ppi_mm": 2048 / 240 * 25.4,
        "max_width_at_300_ppi_mm": 2048 / 300 * 25.4,
    },
    "required_pixels": {
        f"{width}x{height}mm_at_{ppi}ppi": [
            ceil(width / 25.4 * ppi),
            ceil(height / 25.4 * ppi),
        ]
        for width, height, ppi in [(300, 200, 200), (300, 200, 240), (300, 200, 300), (306, 206, 300)]
    },
    "contrast_on_obsidian": {
        color: contrast_ratio(color, "#070709")
        for color in ["#E6E4DF", "#D8D5CE", "#8A9099", "#CE2323", "#2A2D34"]
    },
    "contrast_on_blueprint_slate": {
        color: contrast_ratio(color, "#111317")
        for color in ["#E6E4DF", "#D8D5CE", "#8A9099", "#CE2323", "#2A2D34"]
    },
}

print(json.dumps(result, indent=2))
