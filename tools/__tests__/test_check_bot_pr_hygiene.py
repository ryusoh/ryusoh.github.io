"""Tests for tools/check_bot_pr_hygiene.py — the Jules bot PR hygiene gate."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from tools.check_bot_pr_hygiene import find_violations, main  # noqa: E402

BOT_NAME = "google-labs-jules[bot]"
BOT_EMAIL = "161369871+google-labs-jules[bot]@users.noreply.github.com"


def _git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, capture_output=True, check=True)


def _commit(repo: Path, message: str, bot: bool = True, allow_empty: bool = False) -> None:
    name = BOT_NAME if bot else "Dev"
    email = BOT_EMAIL if bot else "dev@example.com"
    args = ["-c", f"user.email={email}", "-c", f"user.name={name}", "commit", "-m", message]
    if allow_empty:
        args.append("--allow-empty")
    _git(repo, *args)


def _write_and_commit(repo: Path, path: str, content: str, message: str, bot: bool = True) -> None:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    _git(repo, "add", path)
    _commit(repo, message, bot=bot)


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    """A git repo with one human commit on master and a bot branch checked out."""
    _git(tmp_path, "init", "-b", "master")
    (tmp_path / "README.md").write_text("x\n")
    _git(tmp_path, "add", "README.md")
    _commit(tmp_path, "init", bot=False)
    _git(tmp_path, "checkout", "-b", "bot-branch")
    return tmp_path


def test_clean_bot_test_addition_passes(repo: Path) -> None:
    _write_and_commit(
        repo, "tests/js/widget.test.js", "test('x', () => { expect(1).toBe(1); });\n", "add tests"
    )
    assert find_violations(repo, "master") == []


def test_bot_jest_test_deletion_flagged(repo: Path) -> None:
    _write_and_commit(repo, "tests/js/widget.test.js", "a\ndescribe('x', () => {});\n", "add tests")
    _write_and_commit(repo, "tests/js/widget.test.js", "a\n", "rewrite tests")
    violations = find_violations(repo, "master")
    assert any("test deletion" in v and "tests/js/widget.test.js" in v for v in violations)


def test_bot_pytest_deletion_flagged(repo: Path) -> None:
    _write_and_commit(repo, "tools/__tests__/test_widget.py", "a = 1\nb = 2\n", "add tool test")
    _write_and_commit(repo, "tools/__tests__/test_widget.py", "a = 1\n", "trim tool test")
    violations = find_violations(repo, "master")
    assert any("test deletion" in v for v in violations)


def test_bot_production_deletion_not_flagged(repo: Path) -> None:
    _write_and_commit(repo, "js/core.js", "a = 1\nb = 2\n", "add prod code")
    _write_and_commit(repo, "js/core.js", "a = 1\n", "trim prod code")
    assert find_violations(repo, "master") == []


def test_bot_empty_commit_flagged(repo: Path) -> None:
    _commit(repo, "responding to feedback", allow_empty=True)
    violations = find_violations(repo, "master")
    assert any("empty commit" in v for v in violations)


def test_bot_zero_content_file_flagged(repo: Path) -> None:
    _write_and_commit(repo, "dummy_file.txt", "", "add placeholder")
    violations = find_violations(repo, "master")
    assert any("placeholder" in v and "dummy_file.txt" in v for v in violations)


def test_human_test_deletion_ignored(repo: Path) -> None:
    _write_and_commit(repo, "tests/js/widget.test.js", "a = 1\nb = 2\n", "add tests", bot=False)
    _write_and_commit(repo, "tests/js/widget.test.js", "a = 1\n", "rewrite tests", bot=False)
    _commit(repo, "human empty commit", bot=False, allow_empty=True)
    assert find_violations(repo, "master") == []


def test_main_returns_1_with_violations(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _commit(repo, "empty", allow_empty=True)
    assert main(["--repo", str(repo), "--base", "master"]) == 1
    assert "empty commit" in capsys.readouterr().out


def test_main_returns_0_when_clean(repo: Path) -> None:
    _write_and_commit(repo, "tests/js/widget.test.js", "x = 1\n", "add tests")
    assert main(["--repo", str(repo), "--base", "master"]) == 0


def test_main_returns_0_on_empty_range(repo: Path) -> None:
    _git(repo, "checkout", "master")
    assert main(["--repo", str(repo), "--base", "master"]) == 0


def test_main_returns_2_on_missing_base(repo: Path) -> None:
    assert main(["--repo", str(repo), "--base", "no-such-ref"]) == 2
