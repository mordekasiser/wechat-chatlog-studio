from pathlib import Path

import pytest

from chatlog_studio.core import AccountNotFoundError, describe_search_roots, resolve_account_dir, resolve_wechat_source


def create_account(root: Path, name: str, marker: str = "db") -> Path:
    account = root / name
    db_path = account / "db_storage" / "message" / "message_0.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.write_text(marker, encoding="utf-8")
    return account


def test_resolve_wechat_source_accepts_root_directory(tmp_path: Path) -> None:
    root = tmp_path / "xwechat_files"
    first = create_account(root, "wxid_first")
    second = create_account(root, "wxid_second")

    source = resolve_wechat_source(root)

    assert source.source_kind == "root"
    assert source.requested_path == root.resolve()
    assert {account.name for account in source.account_dirs} == {first.name, second.name}
    assert describe_search_roots(source) == str(root.resolve())


def test_resolve_wechat_source_accepts_single_account_directory(tmp_path: Path) -> None:
    root = tmp_path / "xwechat_files"
    account = create_account(root, "wxid_target")

    source = resolve_wechat_source(account)

    assert source.source_kind == "account"
    assert source.account_dirs == [account.resolve()]
    assert source.search_roots == [root.resolve()]


def test_resolve_account_dir_uses_root_path(tmp_path: Path) -> None:
    root = tmp_path / "xwechat_files"
    account = create_account(root, "wxid_target")

    assert resolve_account_dir(root) == account.resolve()


def test_resolve_account_dir_reports_all_auto_roots(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root_a = tmp_path / "missing-a"
    root_b = tmp_path / "missing-b"

    monkeypatch.setattr("chatlog_studio.core.candidate_xwechat_roots", lambda: [root_a.resolve(), root_b.resolve()])

    with pytest.raises(AccountNotFoundError) as excinfo:
        resolve_account_dir()

    assert str(root_a.resolve()) in str(excinfo.value)
    assert str(root_b.resolve()) in str(excinfo.value)


def test_resolve_wechat_source_rejects_missing_path(tmp_path: Path) -> None:
    missing = tmp_path / "missing-root"

    with pytest.raises(AccountNotFoundError) as excinfo:
        resolve_wechat_source(missing)

    assert str(missing.resolve()) in str(excinfo.value)
