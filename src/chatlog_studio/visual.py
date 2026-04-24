from __future__ import annotations

import argparse
import json
import mimetypes
import os
import socket
import sys
import threading
import time
import uuid
import webbrowser
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

from .core import (
    AccountNotFoundError,
    ChatlogError,
    DEFAULT_OUTPUT_BASE,
    MEDIA_EXTRACTOR_VERSION,
    build_account_paths,
    clear_output_cache,
    describe_search_roots,
    export_chat,
    get_chat_messages,
    get_message_media_file,
    is_prepared,
    load_contacts,
    load_sessions,
    prepare_data,
    resolve_account_dir,
    resolve_wechat_source,
)
from .wechat4_key_probe import find_matching_account_dir, get_weixin_pids
from .wechat_paths import XWECHAT_ROOT, candidate_xwechat_roots


UI_ROOT = Path(str(files("chatlog_studio").joinpath("webui")))
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
DEFAULT_CHAT_LIMIT = 400


@dataclass
class TaskState:
    task_id: str
    kind: str
    status: str = "queued"
    current: int = 0
    total: int = 1
    message: str = "Queued"
    error: str | None = None
    result: dict[str, object] | None = None
    started_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Launch the local visual chat log tool for your own WeChat desktop data."
    )
    parser.add_argument(
        "--account-dir",
        type=Path,
        help="Optional WeChat source directory. Accepts either xwechat_files root or a single account directory.",
    )
    parser.add_argument(
        "--output-base",
        type=Path,
        default=DEFAULT_OUTPUT_BASE,
        help="Root directory where per-account decrypted databases, exports and extracted media are written.",
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help="Bind address. Default: 127.0.0.1")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Preferred port. Default: 8765")
    parser.add_argument("--no-browser", action="store_true", help="Do not auto-open the browser.")
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Allow non-loopback bind addresses. Use only on trusted networks.",
    )
    return parser


def pick_available_port(host: str, preferred_port: int, attempts: int = 20) -> int:
    for offset in range(attempts):
        port = preferred_port + offset
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
        return port
    raise OSError(f"no free port found from {preferred_port} to {preferred_port + attempts - 1}")


class ChatlogVisualApp:
    def __init__(self, account_dir: Path | None, output_base: Path) -> None:
        self.manual_source_path = account_dir.resolve(strict=False) if account_dir else None
        self.output_base = output_base.resolve()
        self.ui_root = UI_ROOT
        self._tasks: dict[str, TaskState] = {}
        self._tasks_lock = threading.Lock()
        self._busy_accounts: set[str] = set()
        self._account_task_ids: dict[str, str] = {}
        self._matched_account_cache: tuple[float, tuple[str, ...], str | None] = (0.0, (), None)

    def _clear_matched_account_cache(self) -> None:
        self._matched_account_cache = (0.0, (), None)

    def browse_wechat_root(self, initial_dir: str | None = None) -> dict[str, object]:
        fallback_root = self.manual_source_path or XWECHAT_ROOT
        selected = choose_directory(
            title="选择微信文件根目录",
            initial_dir=Path(os.path.expandvars(initial_dir)).expanduser() if initial_dir else fallback_root,
        )
        return {"path": str(selected) if selected else None}

    def set_wechat_root(self, source_dir: str | None) -> dict[str, object]:
        with self._tasks_lock:
            if self._busy_accounts:
                raise ChatlogError("cannot change WeChat source directory while a prepare or rebuild task is running")

        if source_dir:
            source = resolve_wechat_source(Path(os.path.expandvars(source_dir)).expanduser())
            if not source.account_dirs:
                raise AccountNotFoundError(f"no account directories found under: {describe_search_roots(source)}")
            self.manual_source_path = source.requested_path
        else:
            self.manual_source_path = None
        self._clear_matched_account_cache()
        return self.build_status_payload(None)

    def current_source(self):
        return resolve_wechat_source(self.manual_source_path)

    def list_accounts(self) -> list[dict[str, object]]:
        accounts: list[dict[str, object]] = []
        source = self.current_source()
        for account_dir in source.account_dirs:
            paths = build_account_paths(account_dir, output_base=self.output_base)
            accounts.append(
                {
                    "id": account_dir.name,
                    "name": account_dir.name,
                    "path": str(account_dir),
                    "updatedAt": int(account_dir.stat().st_mtime),
                    "prepared": is_prepared(paths),
                    "outputRoot": str(paths.output_root),
                }
            )
        return accounts

    def _cached_matched_account_path(self, accounts: list[dict[str, object]]) -> str | None:
        now = time.time()
        account_paths = tuple(str(account["path"]) for account in accounts)
        cached_at, cached_accounts, cached_path = self._matched_account_cache
        if cached_accounts == account_paths and now - cached_at < 2.0:
            return cached_path
        matched_dir = find_matching_account_dir([Path(str(account["path"])) for account in accounts], pages=1)
        matched_path = str(matched_dir) if matched_dir else None
        self._matched_account_cache = (now, account_paths, matched_path)
        return matched_path

    def _find_matched_running_account(self, accounts: list[dict[str, object]]) -> dict[str, object] | None:
        if not get_weixin_pids():
            return None
        matched_path = self._cached_matched_account_path(accounts)
        if matched_path:
            for account in accounts:
                if account["path"] == matched_path:
                    return account
        return None

    def resolve_requested_account(self, account_id: str | None) -> Path:
        accounts = self.list_accounts()
        if account_id:
            for account in accounts:
                if account_id in (account["id"], account["path"]):
                    return Path(str(account["path"])).resolve(strict=False)
            raise AccountNotFoundError(f"unknown account: {account_id}")
        matched = self._find_matched_running_account(accounts)
        if matched is not None:
            return Path(str(matched["path"])).resolve(strict=False)
        if accounts:
            return Path(str(accounts[0]["path"])).resolve(strict=False)
        raise AccountNotFoundError(f"no account directories found under: {describe_search_roots(self.current_source())}")

    def require_prepared_paths(self, account_id: str | None):
        account_dir = self.resolve_requested_account(account_id)
        paths = build_account_paths(account_dir, output_base=self.output_base)
        if not is_prepared(paths):
            raise ChatlogError("local data is not prepared yet")
        return account_dir, paths

    def set_output_base(self, output_base: str | None) -> dict[str, object]:
        with self._tasks_lock:
            if self._busy_accounts:
                raise ChatlogError("cannot change output directory while a prepare or rebuild task is running")

        next_output_base = Path(os.path.expandvars(output_base)).expanduser() if output_base else DEFAULT_OUTPUT_BASE
        resolved_output_base = next_output_base.resolve()
        if resolved_output_base.exists() and not resolved_output_base.is_dir():
            raise ChatlogError(f"output directory points to a file: {resolved_output_base}")
        resolved_output_base.mkdir(parents=True, exist_ok=True)
        self.output_base = resolved_output_base
        return self.build_status_payload(None)

    def browse_output_base(self, initial_dir: str | None = None) -> dict[str, object]:
        selected = choose_directory(
            title="选择 Chatlog Studio 输出目录",
            initial_dir=Path(os.path.expandvars(initial_dir)).expanduser() if initial_dir else self.output_base,
        )
        return {"path": str(selected) if selected else None}

    def _reserve_account_for_task(self, account_key: str, task: TaskState) -> str | None:
        with self._tasks_lock:
            if account_key in self._busy_accounts:
                existing_task_id = self._account_task_ids.get(account_key)
                if existing_task_id is None:
                    raise ChatlogError(f"another prepare or rebuild task is already running for: {account_key}")
                return existing_task_id
            self._busy_accounts.add(account_key)
            self._account_task_ids[account_key] = task.task_id
            self._tasks[task.task_id] = task
        return None

    def _reserve_account_for_sync_operation(self, account_key: str) -> None:
        with self._tasks_lock:
            if account_key in self._busy_accounts:
                raise ChatlogError(f"another prepare or rebuild task is already running for: {account_key}")
            self._busy_accounts.add(account_key)

    def _release_account_operation(self, account_key: str, task_id: str | None = None) -> None:
        with self._tasks_lock:
            self._busy_accounts.discard(account_key)
            if task_id is None:
                self._account_task_ids.pop(account_key, None)
            elif self._account_task_ids.get(account_key) == task_id:
                self._account_task_ids.pop(account_key, None)

    def build_status_payload(self, account_id: str | None) -> dict[str, object]:
        accounts = self.list_accounts()
        source = self.current_source()
        matched_account = self._find_matched_running_account(accounts)
        payload: dict[str, object] = {
            "appName": "Chatlog Studio",
            "xwechatRoot": str(XWECHAT_ROOT),
            "xwechatRoots": [str(path) for path in candidate_xwechat_roots()],
            "outputBase": str(self.output_base),
            "defaultOutputBase": str(DEFAULT_OUTPUT_BASE),
            "hasRunningWeixin": bool(get_weixin_pids()),
            "accounts": accounts,
            "selectedAccountId": None,
            "selectedAccountPath": None,
            "manualSourcePath": str(source.requested_path) if source.requested_path else None,
            "manualSourceKind": source.source_kind if source.requested_path else None,
            "searchRoots": [str(path) for path in source.search_roots],
            "matchedAccountId": matched_account["id"] if matched_account else None,
            "prepared": False,
            "stats": {
                "contacts": 0,
                "sessions": 0,
                "exports": 0,
                "decryptedFiles": 0,
                "mediaFiles": 0,
            },
        }

        if not accounts:
            return payload

        account_dir = self.resolve_requested_account(account_id)
        paths = build_account_paths(account_dir, output_base=self.output_base)
        payload["selectedAccountId"] = account_dir.name
        payload["selectedAccountPath"] = str(account_dir)
        payload["outputRoot"] = str(paths.output_root)
        payload["prepared"] = is_prepared(paths)

        if payload["prepared"]:
            payload["stats"] = {
                "contacts": len(load_contacts(paths)),
                "sessions": len(load_sessions(paths)),
                "exports": len(list(paths.exports_dir.glob("*.txt"))),
                "decryptedFiles": len(list(paths.decrypted_dir.glob("*.db"))),
                "mediaFiles": len(list(paths.media_dir.rglob("*.*"))) if paths.media_dir.exists() else 0,
            }
        return payload

    def prepare_payload(self, account_id: str | None, force: bool = False) -> dict[str, object]:
        account_dir = self.resolve_requested_account(account_id)
        account_key = account_dir.name
        self._reserve_account_for_sync_operation(account_key)
        try:
            result = prepare_data(account_dir=account_dir, output_base=self.output_base, force=force)
            return {
                "accountId": result.paths.account_dir.name,
                "accountPath": str(result.paths.account_dir),
                "outputRoot": str(result.paths.output_root),
                "validatedVariant": result.validation.variant.name if result.validation else None,
                "usedCache": result.used_cache,
                "decryptedFiles": [str(path) for path in result.decrypted_files],
                "status": self.build_status_payload(result.paths.account_dir.name),
            }
        finally:
            self._release_account_operation(account_key)

    def start_prepare_task(self, account_id: str | None, force: bool) -> dict[str, object]:
        account_dir = self.resolve_requested_account(account_id)
        account_key = account_dir.name
        task = TaskState(
            task_id=uuid.uuid4().hex,
            kind="prepare",
            message="Clearing cache and rebuilding" if force else "Checking local cache",
        )
        existing_task_id = self._reserve_account_for_task(account_key, task)
        if existing_task_id is not None:
            return self.task_payload(existing_task_id)

        def progress(current: int, total: int, message: str) -> None:
            with self._tasks_lock:
                task.current = current
                task.total = max(total, 1)
                task.message = message
                task.status = "running"
                task.updated_at = time.time()

        def worker() -> None:
            try:
                with self._tasks_lock:
                    task.status = "running"
                    task.updated_at = time.time()
                result = prepare_data(
                    account_dir=account_dir,
                    output_base=self.output_base,
                    force=force,
                    progress=progress,
                )
                with self._tasks_lock:
                    task.status = "succeeded"
                    task.current = task.total
                    task.message = "Using local cache" if result.used_cache else "Preparation completed"
                    task.result = {
                        "accountId": result.paths.account_dir.name,
                        "accountPath": str(result.paths.account_dir),
                        "outputRoot": str(result.paths.output_root),
                        "validatedVariant": result.validation.variant.name if result.validation else None,
                        "usedCache": result.used_cache,
                        "decryptedFiles": [str(path) for path in result.decrypted_files],
                        "status": self.build_status_payload(result.paths.account_dir.name),
                    }
                    task.updated_at = time.time()
            except Exception as exc:  # noqa: BLE001 - thread boundary must serialize all failures.
                with self._tasks_lock:
                    task.status = "failed"
                    task.error = str(exc)
                    task.message = "Preparation failed"
                    task.updated_at = time.time()
            finally:
                self._release_account_operation(account_key, task.task_id)

        threading.Thread(target=worker, daemon=True).start()
        return self.task_payload(task.task_id)

    def task_payload(self, task_id: str) -> dict[str, object]:
        with self._tasks_lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise ChatlogError(f"unknown task: {task_id}")
            return {
                "taskId": task.task_id,
                "kind": task.kind,
                "status": task.status,
                "current": task.current,
                "total": task.total,
                "percent": round((task.current / max(task.total, 1)) * 100),
                "message": task.message,
                "error": task.error,
                "result": task.result,
                "startedAt": int(task.started_at),
                "updatedAt": int(task.updated_at),
            }

    def clear_cache_payload(self, account_id: str | None, clear_exports: bool = False) -> dict[str, object]:
        account_dir = self.resolve_requested_account(account_id)
        account_key = account_dir.name
        self._reserve_account_for_sync_operation(account_key)
        try:
            result = clear_output_cache(account_dir=account_dir, output_base=self.output_base, clear_exports=clear_exports)
            return {
                "removedPaths": [str(path) for path in result.removed_paths],
                "status": self.build_status_payload(result.paths.account_dir.name),
            }
        finally:
            self._release_account_operation(account_key)

    def sessions_payload(self, account_id: str | None, query: str | None) -> dict[str, object]:
        _, paths = self.require_prepared_paths(account_id)
        rows = load_sessions(paths)
        if query:
            normalized = query.lower()
            rows = [row for row in rows if normalized in row.search_blob]
        return {
            "items": [
                {
                    "username": row.username,
                    "displayName": row.display_name,
                    "summary": row.summary,
                    "lastTimestamp": row.last_timestamp,
                    "unreadCount": row.unread_count,
                }
                for row in rows
            ]
        }

    def contacts_payload(self, account_id: str | None, query: str | None) -> dict[str, object]:
        _, paths = self.require_prepared_paths(account_id)
        rows = load_contacts(paths)
        if query:
            normalized = query.lower()
            rows = [row for row in rows if normalized in row.search_blob]
        return {
            "items": [
                {
                    "username": row.username,
                    "displayName": row.display_name,
                    "remark": row.remark,
                    "nickName": row.nick_name,
                    "alias": row.alias,
                }
                for row in rows
            ]
        }

    def chat_payload(
        self,
        account_id: str | None,
        username: str,
        full: bool,
        before_create_time: int | None = None,
        before_local_id: int | None = None,
    ) -> dict[str, object]:
        account_dir, _ = self.require_prepared_paths(account_id)
        result = get_chat_messages(
            username,
            account_dir=account_dir,
            output_base=self.output_base,
            limit=None if full else DEFAULT_CHAT_LIMIT,
            before_create_time=before_create_time,
            before_local_id=before_local_id,
        )
        account_param = quote(account_dir.name, safe="")
        messages: list[dict[str, object]] = []
        for row in result.messages:
            image_url: str | None = None
            image_full_url: str | None = None
            video_url: str | None = None
            video_mime_type: str | None = None
            media_available = False
            if row.display_type == "image":
                try:
                    get_message_media_file(
                        username=result.contact.username,
                        local_id=row.local_id,
                        create_time=row.create_time,
                        account_dir=account_dir,
                        output_base=self.output_base,
                        variant="preview",
                    )
                    media_available = True
                    image_url = (
                        f"/api/media/{quote(result.contact.username, safe='')}/{row.local_id}"
                        f"?account={account_param}&createTime={row.create_time}"
                        f"&variant=preview&v={quote(MEDIA_EXTRACTOR_VERSION, safe='')}"
                    )
                    try:
                        get_message_media_file(
                            username=result.contact.username,
                            local_id=row.local_id,
                            create_time=row.create_time,
                            account_dir=account_dir,
                            output_base=self.output_base,
                            variant="best",
                        )
                        image_full_url = (
                            f"/api/media/{quote(result.contact.username, safe='')}/{row.local_id}"
                            f"?account={account_param}&createTime={row.create_time}"
                            f"&variant=best&v={quote(MEDIA_EXTRACTOR_VERSION, safe='')}"
                        )
                    except ChatlogError:
                        image_full_url = None
                except ChatlogError:
                    media_available = False
            elif row.display_type == "video":
                try:
                    video_file = get_message_media_file(
                        username=result.contact.username,
                        local_id=row.local_id,
                        create_time=row.create_time,
                        account_dir=account_dir,
                        output_base=self.output_base,
                        variant="video",
                        media_id=row.media_id,
                    )
                    media_available = True
                    video_mime_type = video_file.mime_type
                    video_url = (
                        f"/api/media/{quote(result.contact.username, safe='')}/{row.local_id}"
                        f"?account={account_param}&createTime={row.create_time}&variant=video"
                    )
                except ChatlogError:
                    media_available = False

            messages.append(
                {
                    "localId": row.local_id,
                    "localType": row.local_type,
                    "baseType": row.base_type,
                    "createTime": row.create_time,
                    "status": row.status,
                    "isOutgoing": row.is_outgoing,
                    "sender": row.sender,
                    "text": row.text,
                    "displayType": row.display_type,
                    "mediaAvailable": media_available,
                    "mediaId": row.media_id,
                    "imageUrl": image_url,
                    "imageFullUrl": image_full_url,
                    "videoUrl": video_url,
                    "videoMimeType": video_mime_type,
                    "links": list(row.links),
                }
            )
        return {
            "contact": {
                "username": result.contact.username,
                "displayName": result.contact.display_name,
                "remark": result.contact.remark,
                "nickName": result.contact.nick_name,
                "alias": result.contact.alias,
            },
            "messages": messages,
            "totalMessages": result.total_messages,
            "returnedMessages": len(result.messages),
            "truncated": result.truncated,
            "hasMore": result.has_more,
            "nextBeforeCreateTime": result.next_before_create_time,
            "nextBeforeLocalId": result.next_before_local_id,
        }

    def media_file(
        self,
        account_id: str | None,
        username: str,
        local_id: int,
        create_time: int | None,
        variant: str,
    ):
        account_dir, _ = self.require_prepared_paths(account_id)
        return get_message_media_file(
            username=username,
            local_id=local_id,
            create_time=create_time,
            account_dir=account_dir,
            output_base=self.output_base,
            variant=variant,
        )

    def export_payload(self, account_id: str | None, query: str) -> dict[str, object]:
        account_dir, _ = self.require_prepared_paths(account_id)
        result = export_chat(query=query, account_dir=account_dir, output_base=self.output_base)
        return {
            "contact": {
                "username": result.contact.username,
                "displayName": result.contact.display_name,
            },
            "messageCount": result.message_count,
            "outputPath": str(result.output_path),
        }


class ChatlogHTTPServer(ThreadingHTTPServer):
    def __init__(self, server_address, request_handler_class, app: ChatlogVisualApp):
        super().__init__(server_address, request_handler_class)
        self.app = app


class ChatlogRequestHandler(BaseHTTPRequestHandler):
    server_version = "ChatlogStudio/1.0"

    @property
    def app(self) -> ChatlogVisualApp:
        return self.server.app  # type: ignore[attr-defined]

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_get(parsed)
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.handle_api_post(parsed)

    def handle_api_get(self, parsed) -> None:
        params = parse_qs(parsed.query)
        account_id = self.get_single_param(params, "account")
        try:
            if parsed.path.startswith("/api/tasks/"):
                task_id = unquote(parsed.path.removeprefix("/api/tasks/"))
                self.send_json(HTTPStatus.OK, self.app.task_payload(task_id))
                return
            if parsed.path == "/api/status":
                self.send_json(HTTPStatus.OK, self.app.build_status_payload(account_id))
                return
            if parsed.path == "/api/sessions":
                self.send_json(
                    HTTPStatus.OK,
                    self.app.sessions_payload(account_id, self.get_single_param(params, "query")),
                )
                return
            if parsed.path == "/api/contacts":
                self.send_json(
                    HTTPStatus.OK,
                    self.app.contacts_payload(account_id, self.get_single_param(params, "query")),
                )
                return
            if parsed.path.startswith("/api/chat/"):
                username = unquote(parsed.path.removeprefix("/api/chat/"))
                full = self.get_single_param(params, "full") == "1"
                before_create_time = self.get_int_param(params, "beforeCreateTime")
                before_local_id = self.get_int_param(params, "beforeLocalId")
                self.send_json(
                    HTTPStatus.OK,
                    self.app.chat_payload(account_id, username, full, before_create_time, before_local_id),
                )
                return
            if parsed.path.startswith("/api/media/"):
                self.send_media(parsed, params, account_id)
                return
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "endpoint not found"})
        except (AccountNotFoundError, ChatlogError, FileNotFoundError, LookupError, OSError, RuntimeError, ValueError) as exc:
            status = HTTPStatus.CONFLICT if str(exc) == "local data is not prepared yet" else HTTPStatus.BAD_REQUEST
            self.send_json(status, {"error": str(exc)})

    def handle_api_post(self, parsed) -> None:
        try:
            body = self.read_json_body()
            account_id = body.get("account")
            if parsed.path == "/api/output-base":
                self.send_json(HTTPStatus.OK, self.app.set_output_base(body.get("outputBase")))
                return
            if parsed.path == "/api/output-base/browse":
                self.send_json(HTTPStatus.OK, self.app.browse_output_base(body.get("initialDir")))
                return
            if parsed.path == "/api/wechat-root":
                self.send_json(HTTPStatus.OK, self.app.set_wechat_root(body.get("sourceDir")))
                return
            if parsed.path == "/api/wechat-root/browse":
                self.send_json(HTTPStatus.OK, self.app.browse_wechat_root(body.get("initialDir")))
                return
            if parsed.path == "/api/tasks/prepare":
                force = bool(body.get("force"))
                self.send_json(HTTPStatus.ACCEPTED, self.app.start_prepare_task(account_id, force))
                return
            if parsed.path == "/api/prepare":
                self.send_json(HTTPStatus.OK, self.app.prepare_payload(account_id, bool(body.get("force"))))
                return
            if parsed.path == "/api/cache/clear":
                self.send_json(HTTPStatus.OK, self.app.clear_cache_payload(account_id, bool(body.get("clearExports"))))
                return
            if parsed.path == "/api/export":
                query = body.get("query", "")
                if not query:
                    raise ChatlogError("query is required")
                self.send_json(HTTPStatus.OK, self.app.export_payload(account_id, query))
                return
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "endpoint not found"})
        except json.JSONDecodeError:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid JSON body"})
        except (AccountNotFoundError, ChatlogError, FileNotFoundError, LookupError, OSError, RuntimeError, ValueError) as exc:
            status = HTTPStatus.CONFLICT if str(exc) == "local data is not prepared yet" else HTTPStatus.BAD_REQUEST
            self.send_json(status, {"error": str(exc)})

    def serve_static(self, request_path: str) -> None:
        if request_path == "/favicon.ico":
            request_path = "/favicon.svg"
        target = "index.html" if request_path in ("", "/") else request_path.lstrip("/")
        normalized = Path(target)
        if normalized.is_absolute() or ".." in normalized.parts:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        file_path = self.app.ui_root / normalized
        if file_path.is_dir():
            file_path = file_path / "index.html"
        if not file_path.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_type, _ = mimetypes.guess_type(str(file_path))
        payload = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{content_type or 'application/octet-stream'}; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def send_media(self, parsed, params: dict[str, list[str]], account_id: str | None) -> None:
        parts = parsed.path.removeprefix("/api/media/").split("/")
        if len(parts) != 2:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "media endpoint not found"})
            return
        username = unquote(parts[0])
        local_id = int(unquote(parts[1]))
        create_time = self.get_int_param(params, "createTime")
        variant = self.get_single_param(params, "variant") or "preview"
        result = self.app.media_file(account_id, username, local_id, create_time, variant)
        payload = result.output_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", result.mime_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "private, max-age=0, must-revalidate")
        self.end_headers()
        self.wfile.write(payload)

    def read_json_body(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            raise json.JSONDecodeError("top-level JSON must be an object", raw.decode("utf-8", "replace"), 0)
        return data

    def get_single_param(self, params: dict[str, list[str]], name: str) -> str | None:
        values = params.get(name)
        if not values:
            return None
        value = values[0].strip()
        return value or None

    def get_int_param(self, params: dict[str, list[str]], name: str) -> int | None:
        value = self.get_single_param(params, name)
        if value is None:
            return None
        return int(value)

    def send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


def choose_directory(title: str, initial_dir: Path) -> Path | None:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as exc:  # noqa: BLE001 - optional desktop integration.
        raise ChatlogError(f"folder picker is unavailable: {exc}") from exc

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        browse_dir = initial_dir
        while not browse_dir.exists() and browse_dir.parent != browse_dir:
            browse_dir = browse_dir.parent
        selected = filedialog.askdirectory(
            title=title,
            initialdir=str(browse_dir),
            mustexist=False,
        )
        return Path(selected).resolve() if selected else None
    finally:
        root.destroy()


def main(argv: list[str] | None = None) -> int:
    try:
        args = build_parser().parse_args(argv)
        if not UI_ROOT.exists():
            raise ChatlogError("UI assets not found")
        if args.host not in {"127.0.0.1", "localhost", "::1"} and not args.allow_remote:
            raise ChatlogError("refusing non-local bind; pass --allow-remote to expose the local web UI")
        if args.account_dir is not None:
            resolve_wechat_source(args.account_dir)

        port = pick_available_port(args.host, args.port)
        app = ChatlogVisualApp(account_dir=args.account_dir, output_base=args.output_base)
        server = ChatlogHTTPServer((args.host, port), ChatlogRequestHandler, app)
        url = f"http://{args.host}:{port}/"

        print("Chatlog Studio")
        print(f"URL:    {url}")
        print(f"Data:   {XWECHAT_ROOT}")
        print(f"Output: {app.output_base}")
        print("Press Ctrl+C to stop.")

        if not args.no_browser:
            threading.Timer(0.5, lambda: webbrowser.open(url)).start()

        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print()
            print("Stopping Chatlog Studio...")
        finally:
            server.server_close()
        return 0
    except (AccountNotFoundError, ChatlogError, FileNotFoundError, LookupError, OSError, RuntimeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
