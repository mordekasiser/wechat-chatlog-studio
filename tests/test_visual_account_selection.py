from pathlib import Path

from chatlog_studio.visual import ChatlogVisualApp


def create_account(root: Path, name: str) -> Path:
    account = root / name
    db_path = account / "db_storage" / "message" / "message_0.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.write_text("db", encoding="utf-8")
    return account


def test_visual_resolve_requested_account_prefers_explicit_selection(monkeypatch, tmp_path: Path) -> None:
    root = tmp_path / "xwechat_files"
    first = create_account(root, "wxid_first")
    second = create_account(root, "wxid_second")
    output = tmp_path / "output"

    app = ChatlogVisualApp(account_dir=root, output_base=output)

    monkeypatch.setattr("chatlog_studio.visual.get_weixin_pids", lambda: [1234])
    monkeypatch.setattr("chatlog_studio.visual.find_matching_account_dir", lambda account_dirs, pages=1: second.resolve())

    assert app.resolve_requested_account(None) == second.resolve()
    assert app.resolve_requested_account(first.name) == first.resolve()


def test_visual_status_payload_exposes_manual_root_and_match(monkeypatch, tmp_path: Path) -> None:
    root = tmp_path / "xwechat_files"
    account = create_account(root, "wxid_target")
    output = tmp_path / "output"

    app = ChatlogVisualApp(account_dir=root, output_base=output)

    monkeypatch.setattr("chatlog_studio.visual.get_weixin_pids", lambda: [1234])
    monkeypatch.setattr("chatlog_studio.visual.find_matching_account_dir", lambda account_dirs, pages=1: account.resolve())

    status = app.build_status_payload(None)

    assert status["manualSourcePath"] == str(root.resolve())
    assert status["manualSourceKind"] == "root"
    assert status["matchedAccountId"] == account.name
    assert status["selectedAccountId"] == account.name


def test_visual_status_payload_does_not_report_fallback_as_match(monkeypatch, tmp_path: Path) -> None:
    root = tmp_path / "xwechat_files"
    create_account(root, "wxid_first")
    create_account(root, "wxid_second")
    output = tmp_path / "output"

    app = ChatlogVisualApp(account_dir=root, output_base=output)

    monkeypatch.setattr("chatlog_studio.visual.get_weixin_pids", lambda: [1234])
    monkeypatch.setattr("chatlog_studio.visual.find_matching_account_dir", lambda account_dirs, pages=1: None)

    status = app.build_status_payload(None)

    assert status["matchedAccountId"] is None
    assert status["selectedAccountId"] == status["accounts"][0]["id"]


def test_visual_switching_wechat_root_invalidates_match_cache(monkeypatch, tmp_path: Path) -> None:
    root_a = tmp_path / "root_a"
    account_a = create_account(root_a, "wxid_alpha")
    root_b = tmp_path / "root_b"
    account_b = create_account(root_b, "wxid_beta")
    output = tmp_path / "output"

    app = ChatlogVisualApp(account_dir=root_a, output_base=output)

    monkeypatch.setattr("chatlog_studio.visual.get_weixin_pids", lambda: [1234])

    calls: list[list[str]] = []

    def fake_find_matching_account_dir(account_dirs, pages=1):
        resolved = [str(path.resolve()) for path in account_dirs]
        calls.append(resolved)
        if account_b.name in resolved[0]:
            return account_b.resolve()
        return account_a.resolve()

    monkeypatch.setattr("chatlog_studio.visual.find_matching_account_dir", fake_find_matching_account_dir)

    first_status = app.build_status_payload(None)
    switched_status = app.set_wechat_root(str(root_b))

    assert first_status["matchedAccountId"] == account_a.name
    assert switched_status["matchedAccountId"] == account_b.name
    assert switched_status["selectedAccountId"] == account_b.name
    assert len(calls) == 2
