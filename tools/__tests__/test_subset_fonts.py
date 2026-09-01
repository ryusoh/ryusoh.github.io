"""Tests for CJK character extraction and WOFF2 font subsetting pipeline."""

from pathlib import Path
from fontTools.ttLib import TTFont
import pytest
from tools.subset_fonts import extract_characters, is_cjk, find_source_font

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SUBSET_FONT = REPO_ROOT / "assets" / "fonts" / "glowsans-sc-extended-bold.subset.woff2"


def test_is_cjk_detection():
    """Verify CJK character detection for unified ideographs and punctuation."""
    assert is_cjk("中") is True
    assert is_cjk("屏") is True
    assert is_cjk("，") is True
    assert is_cjk("！") is True
    assert is_cjk("A") is False
    assert is_cjk("1") is False


def test_extract_characters():
    """Verify that extract_characters finds Chinese text in the repository."""
    chars = extract_characters()
    assert len(chars) > 50
    assert "屏" in chars
    assert "本" in chars
    assert "陸" in chars


def test_source_font_findable():
    """Verify that the source font file can be located."""
    try:
        source_font = find_source_font()
        assert source_font.exists()
        assert source_font.suffix.lower() == ".otf"
    except FileNotFoundError:
        pytest.skip("Source OTF font not installed in local environment")


def test_subset_font_file_integrity():
    """Verify the generated WOFF2 subset font exists, is compact, and valid."""
    if not SUBSET_FONT.exists():
        pytest.skip("Subset font not generated yet")

    # Ensure size is compact (< 500 KB)
    size_kb = SUBSET_FONT.stat().st_size / 1024
    assert 10 < size_kb < 500

    # Load font and verify cmap table
    font = TTFont(str(SUBSET_FONT))
    cmap = font.getBestCmap()
    assert ord("屏") in cmap
    assert ord("陸") in cmap
