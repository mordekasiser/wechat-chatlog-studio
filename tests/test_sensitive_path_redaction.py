from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
SELF_PATH = Path(__file__).resolve().relative_to(REPO_ROOT)
EXCLUDED_PATHS = {SELF_PATH}
SKIPPED_DIR_NAMES = {".git", ".venv", ".pytest_cache", "__pycache__", "build", "dist"}
FORBIDDEN_PATTERNS = {
    "Windows user-home path": re.compile(r"[A-Za-z]:\\Users\\[^\\/\r\n\"']+", re.IGNORECASE),
    "macOS user-home path": re.compile(r"/Users/[^/\r\n\"']+"),
    "Linux user-home path": re.compile(r"/home/[^/\r\n\"']+"),
}


def _candidate_files() -> list[Path]:
    try:
        tracked = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=False,
            check=True,
        )
        untracked = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard", "-z"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=False,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return [
            path.relative_to(REPO_ROOT)
            for path in REPO_ROOT.rglob("*")
            if path.is_file() and not any(part in SKIPPED_DIR_NAMES for part in path.relative_to(REPO_ROOT).parts)
        ]

    raw_paths = {
        Path(raw.decode("utf-8"))
        for raw in tracked.stdout.split(b"\0") + untracked.stdout.split(b"\0")
        if raw
    }
    return sorted(raw_paths)


def _current_user_identifiers() -> set[str]:
    identifiers = {
        value.strip()
        for value in {
            Path.home().name,
            os.environ.get("USERNAME", ""),
            os.environ.get("USER", ""),
        }
        if value and value.strip()
    }
    return {value for value in identifiers if len(value) >= 3}


def _current_git_email() -> str | None:
    try:
        result = subprocess.run(
            ["git", "config", "--get", "user.email"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None

    email = result.stdout.strip()
    return email or None


def _forbidden_patterns() -> dict[str, re.Pattern[str]]:
    patterns = dict(FORBIDDEN_PATTERNS)

    for identifier in sorted(_current_user_identifiers()):
        patterns[f"current machine username ({identifier})"] = re.compile(rf"\b{re.escape(identifier)}\b", re.IGNORECASE)

    git_email = _current_git_email()
    if git_email:
        patterns[f"current git email ({git_email})"] = re.compile(rf"\b{re.escape(git_email)}\b", re.IGNORECASE)

    return patterns


def test_repository_text_files_do_not_embed_machine_specific_paths_or_identifiers() -> None:
    findings: list[str] = []
    patterns = _forbidden_patterns()

    for relative_path in _candidate_files():
        if relative_path in EXCLUDED_PATHS:
            continue
        if any(part in SKIPPED_DIR_NAMES for part in relative_path.parts):
            continue

        file_path = REPO_ROOT / relative_path
        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        for line_number, line in enumerate(content.splitlines(), start=1):
            for label, pattern in patterns.items():
                if pattern.search(line):
                    findings.append(f"{relative_path}:{line_number}: {label}: {line.strip()}")

    assert not findings, "Unexpected machine-specific path or personal identifier found:\n" + "\n".join(findings)
