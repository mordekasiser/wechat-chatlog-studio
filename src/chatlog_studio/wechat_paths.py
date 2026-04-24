from __future__ import annotations

import ctypes
import os
from pathlib import Path


MESSAGE_DB_RELATIVE_PATH = Path("db_storage") / "message" / "message_0.db"


def account_message_db_path(account_dir: Path) -> Path:
    return account_dir / MESSAGE_DB_RELATIVE_PATH


def is_account_dir(path: Path) -> bool:
    resolved = path.expanduser().resolve(strict=False)
    return account_message_db_path(resolved).exists()


def _windows_known_documents_dir() -> Path | None:
    if os.name != "nt":
        return None

    class GUID(ctypes.Structure):
        _fields_ = [
            ("Data1", ctypes.c_uint32),
            ("Data2", ctypes.c_uint16),
            ("Data3", ctypes.c_uint16),
            ("Data4", ctypes.c_ubyte * 8),
        ]

    try:
        shell32 = ctypes.windll.shell32
        ole32 = ctypes.windll.ole32
    except AttributeError:
        return None

    documents = GUID(
        0xFDD39AD0,
        0x238F,
        0x46AF,
        (ctypes.c_ubyte * 8)(0xAD, 0xB4, 0x6C, 0x85, 0x48, 0x03, 0x69, 0xC7),
    )
    path_ptr = ctypes.c_wchar_p()
    result = shell32.SHGetKnownFolderPath(ctypes.byref(documents), 0, None, ctypes.byref(path_ptr))
    if result != 0 or not path_ptr.value:
        return None
    try:
        return Path(path_ptr.value).expanduser()
    finally:
        ole32.CoTaskMemFree(path_ptr)


def candidate_xwechat_roots() -> list[Path]:
    home = Path.home()
    candidates: list[Path] = []

    known_documents = _windows_known_documents_dir()
    if known_documents is not None:
        candidates.append(known_documents / "xwechat_files")

    onedrive_env = os.environ.get("OneDrive")
    if onedrive_env:
        candidates.append(Path(onedrive_env) / "Documents" / "xwechat_files")

    candidates.append(home / "Documents" / "xwechat_files")
    candidates.append(home / "OneDrive" / "Documents" / "xwechat_files")

    unique_paths: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.expanduser().resolve(strict=False)
        if resolved in seen:
            continue
        seen.add(resolved)
        unique_paths.append(resolved)
    return unique_paths


def default_xwechat_root() -> Path:
    existing = next((path for path in candidate_xwechat_roots() if path.exists()), None)
    return existing if existing is not None else candidate_xwechat_roots()[0]


XWECHAT_ROOT = default_xwechat_root()
