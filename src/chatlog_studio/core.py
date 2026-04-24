from __future__ import annotations
import hashlib
import os
import re
import shutil
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable

from .wechat4_key_probe import ValidationResult, decrypt_database, find_working_key
from .wechat_paths import XWECHAT_ROOT, account_message_db_path, candidate_xwechat_roots, is_account_dir


PACKAGE_ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT_BASE = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "ChatlogStudio"
MEDIA_EXTRACTOR_VERSION = "img-v2"
WECHAT_V4_IMAGE_HEADERS = (b"\x07\x08V1", b"\x07\x08V2")


class ChatlogError(RuntimeError):
    pass


class NoRunningWeixinError(ChatlogError):
    pass


class AccountNotFoundError(ChatlogError):
    pass


class AmbiguousContactError(ChatlogError):
    def __init__(self, query: str, matches: list["ContactRecord"]) -> None:
        self.query = query
        self.matches = matches
        super().__init__(f"multiple contacts matched: {query}")


@dataclass(frozen=True)
class AccountPaths:
    account_dir: Path
    output_root: Path
    decrypted_dir: Path
    exports_dir: Path
    media_dir: Path


@dataclass(frozen=True)
class ContactRecord:
    username: str
    display_name: str
    remark: str
    nick_name: str
    alias: str

    @property
    def search_blob(self) -> str:
        return "\n".join(
            value.lower()
            for value in (self.username, self.display_name, self.remark, self.nick_name, self.alias)
            if value
        )


@dataclass(frozen=True)
class SessionRecord:
    username: str
    display_name: str
    summary: str
    last_timestamp: int
    unread_count: int

    @property
    def search_blob(self) -> str:
        return "\n".join(
            value.lower()
            for value in (self.username, self.display_name, self.summary)
            if value
        )


@dataclass(frozen=True)
class PrepareResult:
    paths: AccountPaths
    validation: ValidationResult | None
    decrypted_files: list[Path]
    used_cache: bool


@dataclass(frozen=True)
class ExportResult:
    contact: ContactRecord
    output_path: Path
    message_count: int


@dataclass(frozen=True)
class MessageRecord:
    local_id: int
    local_type: int
    base_type: int
    create_time: int
    status: int
    is_outgoing: bool
    sender: str
    text: str
    display_type: str
    media_available: bool
    media_id: str | None = None
    media_url: str | None = None
    links: tuple[str, ...] = ()


@dataclass(frozen=True)
class ChatMessagesResult:
    contact: ContactRecord
    messages: list[MessageRecord]
    total_messages: int
    truncated: bool
    has_more: bool
    next_before_create_time: int | None
    next_before_local_id: int | None


@dataclass(frozen=True)
class CacheClearResult:
    paths: AccountPaths
    removed_paths: list[Path]


@dataclass(frozen=True)
class MediaFileResult:
    output_path: Path
    mime_type: str
    source_path: Path


@dataclass(frozen=True)
class WeChatSource:
    requested_path: Path | None
    source_kind: str
    search_roots: list[Path]
    account_dirs: list[Path]


ProgressCallback = Callable[[int, int, str], None]

RESOURCE_HASH_RE = re.compile(rb"[0-9a-fA-F]{32}")
MEDIA_VARIANT_CANDIDATES = {
    "preview": ["_t.dat", ".dat", "_h.dat"],
    "best": ["_h.dat", ".dat", "_t.dat"],
}
MEDIA_SUFFIX_MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
}
VIDEO_SUFFIX_MIME = {key: value for key, value in MEDIA_SUFFIX_MIME.items() if value.startswith("video/")}
URL_RE = re.compile(r"https?://[^\s<>'\"，。！？、）】》]+", re.IGNORECASE)


def discover_account_dirs(root: Path | None = None) -> list[Path]:
    roots = [root.expanduser().resolve(strict=False)] if root is not None else candidate_xwechat_roots()

    candidates: dict[Path, float] = {}
    for search_root in roots:
        if not search_root.exists():
            continue
        for child in search_root.iterdir():
            if not child.is_dir():
                continue
            message_db = account_message_db_path(child)
            if not message_db.exists():
                continue
            resolved_child = child.resolve(strict=False)
            candidates[resolved_child] = max(candidates.get(resolved_child, 0.0), message_db.stat().st_mtime)

    return [item[0] for item in sorted(candidates.items(), key=lambda item: item[1], reverse=True)]


def resolve_wechat_source(source_path: Path | None = None) -> WeChatSource:
    if source_path is None:
        roots = candidate_xwechat_roots()
        return WeChatSource(
            requested_path=None,
            source_kind="auto",
            search_roots=roots,
            account_dirs=discover_account_dirs(),
        )

    resolved = source_path.expanduser().resolve(strict=False)
    if not resolved.exists():
        raise AccountNotFoundError(f"path does not exist: {resolved}")
    if not resolved.is_dir():
        raise AccountNotFoundError(f"path is not a directory: {resolved}")
    if is_account_dir(resolved):
        return WeChatSource(
            requested_path=resolved,
            source_kind="account",
            search_roots=[resolved.parent.resolve(strict=False)],
            account_dirs=[resolved],
        )

    return WeChatSource(
        requested_path=resolved,
        source_kind="root",
        search_roots=[resolved],
        account_dirs=discover_account_dirs(resolved),
    )


def describe_search_roots(source: WeChatSource | None = None) -> str:
    active_source = source or resolve_wechat_source()
    return ", ".join(str(path) for path in active_source.search_roots)


def resolve_account_dir(account_dir: Path | None = None) -> Path:
    source = resolve_wechat_source(account_dir)
    if source.account_dirs:
        return source.account_dirs[0]
    raise AccountNotFoundError(f"no account directories found under: {describe_search_roots(source)}")


def build_account_paths(
    account_dir: Path,
    output_base: Path = DEFAULT_OUTPUT_BASE,
) -> AccountPaths:
    output_root = output_base.resolve() / account_dir.name
    return AccountPaths(
        account_dir=account_dir,
        output_root=output_root,
        decrypted_dir=output_root / "decrypted",
        exports_dir=output_root / "exports",
        media_dir=output_root / "media",
    )


def ensure_output_dirs(paths: AccountPaths) -> None:
    for directory in (
        paths.output_root,
        paths.decrypted_dir,
        paths.exports_dir,
        paths.media_dir,
    ):
        directory.mkdir(parents=True, exist_ok=True)


def flatten_db_name(db_path: Path, db_storage_root: Path) -> str:
    relative = db_path.relative_to(db_storage_root)
    return "__".join(relative.parts)


def list_decrypted_files(paths: AccountPaths) -> list[Path]:
    return sorted(paths.decrypted_dir.glob("*.db"))


def _verify_cache_target(output_root: Path, target: Path) -> Path:
    resolved_output_root = output_root.resolve()
    resolved_target = target.resolve()
    if resolved_output_root == resolved_target or resolved_output_root in resolved_target.parents:
        return resolved_target
    raise ChatlogError(f"refusing to clear path outside cache root: {resolved_target}")


def clear_output_cache(
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
    clear_exports: bool = False,
) -> CacheClearResult:
    resolved_account_dir = resolve_account_dir(account_dir)
    paths = build_account_paths(resolved_account_dir, output_base=output_base)
    removed_paths: list[Path] = []

    targets = [paths.decrypted_dir, paths.media_dir]
    if clear_exports:
        targets.append(paths.exports_dir)

    for directory in targets:
        if not directory.exists():
            continue
        resolved_directory = _verify_cache_target(paths.output_root, directory)
        shutil.rmtree(resolved_directory)
        removed_paths.append(directory)

    ensure_output_dirs(paths)
    return CacheClearResult(paths=paths, removed_paths=removed_paths)


def collect_required_databases(account_dir: Path) -> list[Path]:
    db_storage_root = account_dir / "db_storage"
    required = [
        db_storage_root / "contact" / "contact.db",
        db_storage_root / "session" / "session.db",
    ]
    required.extend(sorted((db_storage_root / "message").glob("message_[0-9]*.db")))
    resource_db = db_storage_root / "message" / "message_resource.db"
    if resource_db.exists():
        required.append(resource_db)

    missing = [path for path in required if not path.exists()]
    if missing:
        missing_list = ", ".join(str(path) for path in missing)
        raise ChatlogError(f"missing required databases: {missing_list}")
    return required


def get_primary_message_db(account_dir: Path) -> Path:
    db_path = account_message_db_path(account_dir)
    if not db_path.exists():
        raise ChatlogError(f"primary message database not found: {db_path}")
    return db_path


def prepare_data(
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
    pages: int = 3,
    max_candidates: int = 256,
    force: bool = False,
    progress: ProgressCallback | None = None,
) -> PrepareResult:
    resolved_account_dir = resolve_account_dir(account_dir)
    paths = build_account_paths(resolved_account_dir, output_base=output_base)
    if force:
        clear_output_cache(account_dir=resolved_account_dir, output_base=output_base)
    ensure_output_dirs(paths)
    if not force and is_prepared(paths):
        if progress is not None:
            progress(1, 1, "Using existing local cache")
        return PrepareResult(
            paths=paths,
            validation=None,
            decrypted_files=list_decrypted_files(paths),
            used_cache=True,
        )

    primary_message_db = get_primary_message_db(resolved_account_dir)
    try:
        if progress is not None:
            progress(0, 1, f"Validating {primary_message_db.name}")
        validation = find_working_key(
            primary_message_db,
            pages=pages,
            max_candidates=max_candidates,
        )
    except (FileNotFoundError, LookupError, OSError, RuntimeError, ValueError) as exc:
        raise ChatlogError(f"failed to validate {primary_message_db.name}: {exc}") from exc

    db_storage_root = resolved_account_dir / "db_storage"
    required_databases = collect_required_databases(resolved_account_dir)
    total_steps = len(required_databases)
    decrypted_files: list[Path] = []
    for index, source_db in enumerate(required_databases, start=1):
        # WeChat 4.x stores per-database salts and effectively per-database key material.
        # Reuse the already-validated message_0 result only for that exact file; every other
        # database must be validated independently against its own header pages.
        if source_db == primary_message_db:
            db_validation = validation
        else:
            try:
                db_validation = find_working_key(
                    source_db,
                    pages=pages,
                    max_candidates=max_candidates,
                )
            except (FileNotFoundError, LookupError, OSError, RuntimeError, ValueError) as exc:
                raise ChatlogError(f"failed to validate {source_db.name}: {exc}") from exc
        target_db = paths.decrypted_dir / flatten_db_name(source_db, db_storage_root)
        if progress is not None:
            progress(index, total_steps, f"Decrypting {source_db.name}")
        decrypt_database(source_db, target_db, db_validation)
        decrypted_files.append(target_db)

    return PrepareResult(paths=paths, validation=validation, decrypted_files=decrypted_files, used_cache=False)


def is_prepared(paths: AccountPaths) -> bool:
    required = [
        paths.decrypted_dir / "contact__contact.db",
        paths.decrypted_dir / "session__session.db",
    ]
    return all(path.exists() for path in required) and any(paths.decrypted_dir.glob("message__message_*.db"))


def ensure_prepared(
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
) -> AccountPaths:
    resolved_account_dir = resolve_account_dir(account_dir)
    paths = build_account_paths(resolved_account_dir, output_base=output_base)
    if not is_prepared(paths):
        prepare_data(account_dir=resolved_account_dir, output_base=output_base)
    return paths


def get_contact_db(paths: AccountPaths) -> Path:
    db_path = paths.decrypted_dir / "contact__contact.db"
    if not db_path.exists():
        raise ChatlogError(f"decrypted contact database not found: {db_path}")
    return db_path


def get_session_db(paths: AccountPaths) -> Path:
    db_path = paths.decrypted_dir / "session__session.db"
    if not db_path.exists():
        raise ChatlogError(f"decrypted session database not found: {db_path}")
    return db_path


def iter_message_dbs(paths: AccountPaths) -> list[Path]:
    return sorted(
        path
        for path in paths.decrypted_dir.glob("message__message_*.db")
        if path.name != "message__message_resource.db"
    )


def get_message_resource_db(paths: AccountPaths) -> Path:
    db_path = paths.decrypted_dir / "message__message_resource.db"
    if not db_path.exists():
        raise ChatlogError("decrypted message resource database not found")
    return db_path


def _connect_sqlite(db_path: Path):
    import sqlite3

    connection = sqlite3.connect(str(db_path))
    connection.text_factory = lambda value: value.decode("utf-8", "replace")
    return connection


def load_contacts(paths: AccountPaths) -> list[ContactRecord]:
    connection = _connect_sqlite(get_contact_db(paths))
    try:
        rows = connection.execute(
            """
            SELECT username, COALESCE(remark, ''), COALESCE(nick_name, ''), COALESCE(alias, '')
            FROM contact
            WHERE delete_flag = 0
            ORDER BY id
            """
        ).fetchall()
    finally:
        connection.close()

    contacts: list[ContactRecord] = []
    for username, remark, nick_name, alias in rows:
        display_name = next(
            (value for value in (remark, nick_name, alias, username) if value),
            username,
        )
        contacts.append(
            ContactRecord(
                username=username,
                display_name=display_name,
                remark=remark,
                nick_name=nick_name,
                alias=alias,
            )
        )
    return contacts


def load_contact_map(paths: AccountPaths) -> dict[str, ContactRecord]:
    return {contact.username: contact for contact in load_contacts(paths)}


def load_sessions(paths: AccountPaths) -> list[SessionRecord]:
    contact_map = load_contact_map(paths)
    connection = _connect_sqlite(get_session_db(paths))
    try:
        rows = connection.execute(
            """
            SELECT username, COALESCE(summary, ''), last_timestamp, unread_count
            FROM SessionTable
            WHERE is_hidden = 0
            ORDER BY sort_timestamp DESC, last_timestamp DESC
            """
        ).fetchall()
    finally:
        connection.close()

    sessions: list[SessionRecord] = []
    for username, summary, last_timestamp, unread_count in rows:
        contact = contact_map.get(username)
        display_name = contact.display_name if contact else username
        sessions.append(
            SessionRecord(
                username=username,
                display_name=display_name,
                summary=summary,
                last_timestamp=int(last_timestamp or 0),
                unread_count=int(unread_count or 0),
            )
        )
    return sessions


def list_sessions(
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
    keyword: str | None = None,
) -> list[SessionRecord]:
    paths = ensure_prepared(account_dir=account_dir, output_base=output_base)
    sessions = load_sessions(paths)
    if not keyword:
        return sessions

    normalized = keyword.lower()
    return [session for session in sessions if normalized in session.search_blob]


def find_contacts(
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
    query: str | None = None,
) -> list[ContactRecord]:
    paths = ensure_prepared(account_dir=account_dir, output_base=output_base)
    contacts = load_contacts(paths)
    if not query:
        return contacts

    normalized = query.lower()
    return [contact for contact in contacts if normalized in contact.search_blob]


def resolve_contact(
    paths: AccountPaths,
    query: str,
) -> ContactRecord:
    contacts = load_contacts(paths)
    exact_matches = [
        contact
        for contact in contacts
        if query in (contact.username, contact.display_name, contact.remark, contact.nick_name, contact.alias)
    ]
    if len(exact_matches) == 1:
        return exact_matches[0]
    if len(exact_matches) > 1:
        raise AmbiguousContactError(query, exact_matches)

    normalized = query.lower()
    fuzzy_matches = [contact for contact in contacts if normalized in contact.search_blob]
    if not fuzzy_matches:
        raise ChatlogError(f"no contact matched: {query}")
    if len(fuzzy_matches) > 1:
        raise AmbiguousContactError(query, fuzzy_matches[:20])
    return fuzzy_matches[0]


def message_table_name(username: str) -> str:
    return f"Msg_{hashlib.md5(username.encode('utf-8')).hexdigest()}"


def table_exists(connection, table_name: str) -> bool:
    row = connection.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return bool(row and row[0])


def load_message_name_map(paths: AccountPaths) -> dict[int, str]:
    mapping: dict[int, str] = {}

    for message_db in iter_message_dbs(paths):
        connection = _connect_sqlite(message_db)
        try:
            if not table_exists(connection, "Name2Id"):
                continue
            rows = connection.execute(
                """
                SELECT rowid, user_name
                FROM Name2Id
                """
            ).fetchall()
        finally:
            connection.close()
        for rowid, user_name in rows:
            mapping[int(rowid)] = str(user_name)
        if mapping:
            break

    return mapping


def iter_contact_messages(
    paths: AccountPaths, contact: ContactRecord
) -> list[tuple[int, int, int, int, int, str, str, object]]:
    table_name = message_table_name(contact.username)
    rows: list[tuple[int, int, int, int, int, str, str, object]] = []

    for message_db in iter_message_dbs(paths):
        connection = _connect_sqlite(message_db)
        try:
            if not table_exists(connection, table_name):
                continue
            db_rows = connection.execute(
                f"""
                SELECT local_id, local_type, create_time, status, real_sender_id,
                       COALESCE(message_content, ''),
                       COALESCE(compress_content, ''),
                       packed_info_data
                FROM [{table_name}]
                ORDER BY create_time ASC, local_id ASC
                """
            ).fetchall()
        finally:
            connection.close()
        rows.extend((int(a), int(b), int(c), int(d), int(e), f, g, h) for a, b, c, d, e, f, g, h in db_rows)

    rows.sort(key=lambda row: (row[2], row[0]))
    return rows


def message_base_type(local_type: int) -> int:
    return int(local_type) & 0xFFFFFFFF


def _value_to_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return str(value)


def extract_message_links(*values: object) -> tuple[str, ...]:
    links: list[str] = []
    for value in values:
        text = _value_to_text(value)
        if not text:
            continue
        links.extend(match.group(0).rstrip(".,;:") for match in URL_RE.finditer(text))
    return tuple(dict.fromkeys(links))


def render_message(local_type: int, message_content: str, compress_content: str, packed_info_data: object = None) -> str:
    content = message_content or compress_content or ""
    base_type = message_base_type(local_type)
    placeholders = {
        3: "图片消息",
        34: "语音消息",
        43: "视频消息",
        47: "表情消息",
        49: "链接/分享消息",
    }

    content = _value_to_text(content)
    links = extract_message_links(message_content, compress_content, packed_info_data)

    if content.startswith("b'(") or content.startswith('b"('):
        return links[0] if links else placeholders.get(base_type, f"消息类型 {base_type}")

    if base_type in (3, 34, 43, 47):
        return placeholders[base_type]

    cleaned = normalize_text_content(content)
    if _looks_binaryish(cleaned):
        return links[0] if links else placeholders.get(base_type, f"消息类型 {base_type}")
    if cleaned:
        return cleaned
    return links[0] if links else f"消息类型 {base_type}"


def _looks_binaryish(content: str) -> bool:
    if not content:
        return False

    suspicious = 0
    for character in content:
        codepoint = ord(character)
        if character in {"\x00", "\ufffd"}:
            suspicious += 3
        elif codepoint < 32 and character not in "\r\n\t":
            suspicious += 1

    return suspicious >= max(4, len(content) // 16)


def normalize_text_content(content: str) -> str:
    normalized = unicodedata.normalize("NFC", content).replace("\ufeff", "")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    cleaned_chars: list[str] = []
    for character in normalized:
        if character in {"\n", "\t"}:
            cleaned_chars.append(character)
            continue
        if unicodedata.category(character) == "Cc":
            continue
        cleaned_chars.append(character)
    return "".join(cleaned_chars).strip()


def is_outgoing_message(real_sender_username: str | None, account_username: str, status: int) -> bool:
    if real_sender_username:
        return real_sender_username == account_username
    if status == 2:
        return True
    if status == 3:
        return False
    return False


def resolve_account_username(
    account_dir_name: str,
    sender_name_map: dict[int, str],
    contact_username: str,
) -> str:
    usernames = set(sender_name_map.values())
    if account_dir_name in usernames:
        return account_dir_name

    candidates = sorted(
        (
            user_name
            for user_name in usernames
            if user_name != contact_username and account_dir_name.startswith(f"{user_name}_")
        ),
        key=len,
        reverse=True,
    )
    if candidates:
        return candidates[0]

    base_name, separator, _ = account_dir_name.rpartition("_")
    if separator and base_name:
        return base_name
    return account_dir_name


def resolve_sender(is_outgoing: bool, contact: ContactRecord, status: int) -> str:
    if is_outgoing:
        return "Me"
    if status in (2, 3):
        return contact.display_name
    return f"Unknown({status})"


def build_message_records(
    rows: Iterable[tuple[int, int, int, int, int, str, str, object]],
    contact: ContactRecord,
    account_username: str,
    sender_name_map: dict[int, str],
) -> list[MessageRecord]:
    messages: list[MessageRecord] = []
    type_display_map = {
        3: "image",
        43: "video",
        47: "emoji",
        49: "link",
    }
    for local_id, local_type, create_time, status, real_sender_id, message_content, compress_content, packed_info_data in rows:
        base_type = message_base_type(local_type)
        display_type = type_display_map.get(base_type, "text")
        links = extract_message_links(message_content, compress_content, packed_info_data)
        media_ids = _extract_hex_tokens(packed_info_data)
        sender_username = sender_name_map.get(real_sender_id)
        outgoing = is_outgoing_message(sender_username, account_username, status)
        messages.append(
            MessageRecord(
                local_id=local_id,
                local_type=local_type,
                base_type=base_type,
                create_time=create_time,
                status=status,
                is_outgoing=outgoing,
                sender=resolve_sender(outgoing, contact, status),
                text=render_message(local_type, message_content, compress_content, packed_info_data),
                display_type=display_type,
                media_available=False,
                media_id=media_ids[0] if media_ids else None,
                links=links,
            )
        )
    return messages


def _resolve_chat_resource_id(connection, username: str) -> int:
    row = connection.execute(
        "SELECT rowid FROM ChatName2Id WHERE user_name = ?",
        (username,),
    ).fetchone()
    if not row:
        raise ChatlogError(f"no resource mapping found for: {username}")
    return int(row[0])


def extract_resource_hash(packed_info: bytes | str | None) -> str | None:
    if not packed_info:
        return None
    raw = packed_info.encode("utf-8", "ignore") if isinstance(packed_info, str) else packed_info
    match = RESOURCE_HASH_RE.search(raw)
    if not match:
        return None
    return match.group(0).decode("ascii").lower()


def find_message_resource_hash(
    paths: AccountPaths,
    username: str,
    local_id: int,
    create_time: int | None = None,
) -> str:
    connection = _connect_sqlite(get_message_resource_db(paths))
    try:
        chat_id = _resolve_chat_resource_id(connection, username)
        if create_time is not None:
            rows = connection.execute(
                """
                SELECT packed_info
                FROM MessageResourceInfo
                WHERE chat_id = ? AND message_local_id = ?
                ORDER BY ABS(message_create_time - ?) ASC, message_id ASC
                """,
                (chat_id, local_id, create_time),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT packed_info
                FROM MessageResourceInfo
                WHERE chat_id = ? AND message_local_id = ?
                ORDER BY message_id ASC
                """,
                (chat_id, local_id),
            ).fetchall()
    finally:
        connection.close()

    for (packed_info,) in rows:
        resource_hash = extract_resource_hash(packed_info)
        if resource_hash:
            return resource_hash
    raise ChatlogError(f"no resource hash found for {username} local_id={local_id}")


def _chat_attach_root(account_dir: Path, username: str) -> Path:
    chat_hash = hashlib.md5(username.encode("utf-8")).hexdigest()
    return account_dir / "msg" / "attach" / chat_hash


def _chat_cache_root(account_dir: Path, username: str, create_time: int) -> Path | None:
    if create_time <= 0:
        return None
    chat_hash = hashlib.md5(username.encode("utf-8")).hexdigest()
    month_key = datetime.fromtimestamp(create_time).strftime("%Y-%m")
    return account_dir / "cache" / month_key / "Message" / chat_hash


def resolve_cached_image_candidates(
    account_dir: Path,
    username: str,
    local_id: int,
    create_time: int,
    variant: str,
) -> list[Path]:
    if variant not in MEDIA_VARIANT_CANDIDATES:
        raise ChatlogError(f"unsupported media variant: {variant}")

    cache_root = _chat_cache_root(account_dir, username, create_time)
    if cache_root is None or not cache_root.exists():
        return []

    if variant != "preview":
        return []

    thumb_dir = cache_root / "Thumb"
    if not thumb_dir.exists():
        return []

    ordered_patterns = [f"{local_id}_{create_time}_thumb.*", f"{local_id}_*_thumb.*"]
    candidates: list[Path] = []
    seen: set[Path] = set()
    for pattern in ordered_patterns:
        for candidate in sorted(thumb_dir.glob(pattern)):
            if not candidate.is_file() or candidate in seen:
                continue
            seen.add(candidate)
            candidates.append(candidate)
    return candidates


def resolve_image_candidates(
    account_dir: Path,
    username: str,
    create_time: int,
    resource_hash: str,
    variant: str,
) -> list[Path]:
    if variant not in MEDIA_VARIANT_CANDIDATES:
        raise ChatlogError(f"unsupported media variant: {variant}")

    attach_root = _chat_attach_root(account_dir, username)
    if not attach_root.exists():
        raise ChatlogError(f"attach directory not found for: {username}")

    file_names = [f"{resource_hash}{suffix}" for suffix in MEDIA_VARIANT_CANDIDATES[variant]]
    candidates: list[Path] = []

    if create_time > 0:
        month_key = datetime.fromtimestamp(create_time).strftime("%Y-%m")
        month_dir = attach_root / month_key / "Img"
        for file_name in file_names:
            candidate = month_dir / file_name
            if candidate.exists():
                candidates.append(candidate)

    if candidates:
        return candidates

    discovered: dict[str, Path] = {}
    for candidate in attach_root.rglob(f"{resource_hash}*.dat"):
        if candidate.parent.name != "Img":
            continue
        discovered.setdefault(candidate.name, candidate)

    ordered = [discovered[file_name] for file_name in file_names if file_name in discovered]
    if ordered:
        return ordered
    raise ChatlogError(f"no local image files found for resource: {resource_hash}")


def _detect_png_payload(data: bytes) -> tuple[int, int, str, str] | None:
    start = data.find(b"\x89PNG\r\n\x1a\n")
    if start < 0:
        return None

    cursor = start + 8
    while cursor + 8 <= len(data):
        chunk_size = int.from_bytes(data[cursor:cursor + 4], "big")
        chunk_type = data[cursor + 4:cursor + 8]
        cursor += 8
        cursor += chunk_size + 4
        if cursor > len(data):
            return None
        if chunk_type == b"IEND":
            return start, cursor, ".png", "image/png"
    return None


def _detect_jpeg_payload(data: bytes) -> tuple[int, int, str, str] | None:
    start = data.find(b"\xff\xd8\xff")
    while start >= 0:
        end_marker = data.find(b"\xff\xd9", start + 3)
        if end_marker >= 0:
            return start, end_marker + 2, ".jpg", "image/jpeg"
        start = data.find(b"\xff\xd8\xff", start + 1)
    return None


def _detect_gif_payload(data: bytes) -> tuple[int, int, str, str] | None:
    starts = [data.find(b"GIF87a"), data.find(b"GIF89a")]
    starts = [start for start in starts if start >= 0]
    if not starts:
        return None
    start = min(starts)
    end_marker = data.rfind(b"\x3b")
    if end_marker < start:
        return None
    return start, end_marker + 1, ".gif", "image/gif"


def _detect_bmp_payload(data: bytes) -> tuple[int, int, str, str] | None:
    start = data.find(b"BM")
    while start >= 0:
        if start + 54 > len(data):
            return None
        size = int.from_bytes(data[start + 2:start + 6], "little")
        reserved = data[start + 6:start + 10]
        pixel_offset = int.from_bytes(data[start + 10:start + 14], "little")
        dib_size = int.from_bytes(data[start + 14:start + 18], "little")
        width = int.from_bytes(data[start + 18:start + 22], "little", signed=True)
        height = int.from_bytes(data[start + 22:start + 26], "little", signed=True)
        planes = int.from_bytes(data[start + 26:start + 28], "little")
        bits_per_pixel = int.from_bytes(data[start + 28:start + 30], "little")
        compression = int.from_bytes(data[start + 30:start + 34], "little")
        if (
            size > 54
            and size <= len(data) - start
            and reserved == b"\x00\x00\x00\x00"
            and pixel_offset >= 14 + dib_size
            and pixel_offset < size
            and dib_size in (12, 16, 40, 52, 56, 108, 124)
            and width != 0
            and height != 0
            and abs(width) <= 50000
            and abs(height) <= 50000
            and planes == 1
            and bits_per_pixel in (1, 4, 8, 16, 24, 32)
            and compression in (0, 1, 2, 3, 6, 11, 12, 13)
        ):
            return start, start + size, ".bmp", "image/bmp"
        start = data.find(b"BM", start + 1)
    return None


def _detect_webp_payload(data: bytes) -> tuple[int, int, str, str] | None:
    start = data.find(b"RIFF")
    while start >= 0:
        if start + 12 <= len(data) and data[start + 8:start + 12] == b"WEBP":
            size = int.from_bytes(data[start + 4:start + 8], "little") + 8
            end = start + size if size > 0 else len(data)
            if end > start and end <= len(data):
                return start, end, ".webp", "image/webp"
        start = data.find(b"RIFF", start + 4)
    return None


def detect_plain_image_payload(data: bytes) -> tuple[int, int, str, str] | None:
    detections = [
        _detect_png_payload(data),
        _detect_jpeg_payload(data),
        _detect_gif_payload(data),
        _detect_bmp_payload(data),
        _detect_webp_payload(data),
    ]
    available = [item for item in detections if item is not None]
    if not available:
        return None
    available.sort(key=lambda item: item[0])
    return available[0]


def decode_xor_image_payload(data: bytes) -> tuple[bytes, str, str] | None:
    if not data:
        return None

    signatures: tuple[tuple[bytes, str, str], ...] = (
        (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
        (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
        (b"GIF87a", ".gif", "image/gif"),
        (b"GIF89a", ".gif", "image/gif"),
        (b"BM", ".bmp", "image/bmp"),
        (b"RIFF", ".webp", "image/webp"),
    )
    for signature, _, _ in signatures:
        xor_key = data[0] ^ signature[0]
        probe = bytes(byte ^ xor_key for byte in data[: len(signature)])
        if probe != signature:
            continue
        decoded = bytes(byte ^ xor_key for byte in data)
        detected = detect_plain_image_payload(decoded)
        if detected is None or detected[0] != 0:
            continue
        start, end, extension, mime_type = detected
        return decoded[start:end], extension, mime_type
    return None


def detect_image_payload(data: bytes) -> tuple[int, int, str, str] | None:
    return detect_plain_image_payload(data)


def _media_mime_from_path(path: Path) -> str:
    return MEDIA_SUFFIX_MIME.get(path.suffix.lower(), "application/octet-stream")


def _is_wechat_v4_image_container(data: bytes) -> bool:
    return len(data) >= 15 and data[:4] in WECHAT_V4_IMAGE_HEADERS


def _build_media_cache_stem(
    local_id: int,
    variant: str,
    source_path: Path,
    identity: str,
) -> str:
    stat = source_path.stat()
    fingerprint = hashlib.md5(
        "\n".join(
            [
                MEDIA_EXTRACTOR_VERSION,
                identity,
                source_path.name,
                str(stat.st_size),
                str(stat.st_mtime_ns),
            ]
        ).encode("utf-8")
    ).hexdigest()[:16]
    return f"{local_id}_{variant}_{fingerprint}"


def _get_cached_media_file(cache_dir: Path, cache_stem: str) -> MediaFileResult | None:
    cached_files = sorted(cache_dir.glob(f"{cache_stem}.*"))
    if not cached_files:
        return None
    cached_path = cached_files[0]
    return MediaFileResult(
        output_path=cached_path,
        mime_type=_media_mime_from_path(cached_path),
        source_path=cached_path,
    )


def extract_image_payload(source_path: Path, target_dir: Path, cache_stem: str) -> MediaFileResult:
    raw = source_path.read_bytes()
    detected = detect_image_payload(raw)
    if detected is not None:
        start, end, extension, mime_type = detected
        payload = raw[start:end]
    else:
        xor_decoded = decode_xor_image_payload(raw)
        if xor_decoded is not None:
            payload, extension, mime_type = xor_decoded
        else:
            if _is_wechat_v4_image_container(raw):
                raise ChatlogError(f"wechat 4.x encrypted image container is not directly extractable: {source_path.name}")
            raise ChatlogError(f"no supported image payload found in: {source_path.name}")
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{cache_stem}{extension}"
    target_path.write_bytes(payload)
    return MediaFileResult(output_path=target_path, mime_type=mime_type, source_path=source_path)


def get_message_media(
    username: str,
    local_id: int,
    create_time: int,
    variant: str = "preview",
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
) -> MediaFileResult:
    if variant not in MEDIA_VARIANT_CANDIDATES:
        raise ChatlogError(f"unsupported media variant: {variant}")

    paths = ensure_prepared(account_dir=account_dir, output_base=output_base)
    contact = resolve_contact(paths, username)
    cache_dir = paths.media_dir / safe_file_component(contact.username)
    errors: list[str] = []

    cached_candidates = resolve_cached_image_candidates(
        paths.account_dir,
        contact.username,
        local_id=local_id,
        create_time=create_time,
        variant=variant,
    )
    for candidate in cached_candidates:
        cache_stem = _build_media_cache_stem(
            local_id,
            variant,
            candidate,
            identity=f"thumb:{contact.username}:{create_time}",
        )
        cached_media = _get_cached_media_file(cache_dir, cache_stem)
        if cached_media is not None:
            return cached_media
        try:
            return extract_image_payload(candidate, cache_dir, cache_stem)
        except ChatlogError as exc:
            errors.append(str(exc))

    try:
        resource_hash = find_message_resource_hash(paths, contact.username, local_id, create_time=create_time)
    except ChatlogError as exc:
        reason = "; ".join(errors + [str(exc)]) if errors else str(exc)
        raise ChatlogError(f"failed to extract image for {contact.username} local_id={local_id}: {reason}") from exc

    candidates = resolve_image_candidates(
        paths.account_dir,
        contact.username,
        create_time=create_time,
        resource_hash=resource_hash,
        variant=variant,
    )
    for candidate in candidates:
        cache_stem = _build_media_cache_stem(local_id, variant, candidate, identity=resource_hash)
        cached_media = _get_cached_media_file(cache_dir, cache_stem)
        if cached_media is not None:
            return cached_media
        try:
            return extract_image_payload(candidate, cache_dir, cache_stem)
        except ChatlogError as exc:
            errors.append(str(exc))

    reason = "; ".join(errors) if errors else "unknown media extraction failure"
    raise ChatlogError(f"failed to extract image for {contact.username} local_id={local_id}: {reason}")


IMAGE_MAGIC_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
    (b"BM", ".bmp", "image/bmp"),
    (b"GIF87a", ".gif", "image/gif"),
    (b"GIF89a", ".gif", "image/gif"),
    (b"RIFF", ".webp", "image/webp"),
)


def _extract_hex_tokens(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, bytes):
        haystack = value.decode("latin1", "ignore")
    else:
        haystack = str(value)
    tokens = re.findall(r"(?<![0-9a-fA-F])([0-9a-fA-F]{32})(?![0-9a-fA-F])", haystack)
    return list(dict.fromkeys(token.lower() for token in tokens))


def _image_month_dir(create_time: int) -> str:
    if create_time > 0:
        return datetime.fromtimestamp(create_time).strftime("%Y-%m")
    return datetime.now().strftime("%Y-%m")


def _candidate_image_paths(
    paths: AccountPaths,
    contact: ContactRecord,
    resource_hash: str,
    create_time: int,
    variant: str,
) -> list[Path]:
    chat_hash = hashlib.md5(contact.username.encode("utf-8")).hexdigest()
    image_dir = paths.account_dir / "msg" / "attach" / chat_hash / _image_month_dir(create_time) / "Img"
    suffixes = ["_h.dat", ".dat", "_t.dat"] if variant == "best" else ["_t.dat", ".dat", "_h.dat"]
    return [image_dir / f"{resource_hash}{suffix}" for suffix in suffixes]


def _scan_image_payload(raw: bytes) -> tuple[bytes, str, str] | None:
    matches: list[tuple[int, bytes, str, str]] = []
    for signature, extension, mime_type in IMAGE_MAGIC_SIGNATURES:
        offset = raw.find(signature)
        if offset >= 0:
            matches.append((offset, signature, extension, mime_type))
    if not matches:
        return None

    offset, signature, extension, mime_type = min(matches, key=lambda item: item[0])
    payload = raw[offset:]
    if signature == b"BM" and len(payload) >= 6:
        declared_size = int.from_bytes(payload[2:6], "little", signed=False)
        if 0 < declared_size <= len(payload):
            payload = payload[:declared_size]
    elif signature == b"\x89PNG\r\n\x1a\n":
        end = payload.find(b"IEND")
        if end >= 0 and end + 8 <= len(payload):
            payload = payload[: end + 8]
    elif signature == b"\xff\xd8\xff":
        end = payload.find(b"\xff\xd9")
        if end >= 0:
            payload = payload[: end + 2]
    elif signature == b"RIFF" and len(payload) >= 12 and payload[8:12] == b"WEBP":
        declared_size = int.from_bytes(payload[4:8], "little", signed=False) + 8
        if 0 < declared_size <= len(payload):
            payload = payload[:declared_size]
        else:
            return None
    return payload, extension, mime_type


def _read_extractable_image(source_path: Path) -> tuple[bytes, str, str]:
    raw = source_path.read_bytes()
    scanned = _scan_image_payload(raw)
    if scanned is None:
        raise ChatlogError(f"image payload not found in resource file: {source_path.name}")
    return scanned


def _resource_hashes_for_message(
    paths: AccountPaths,
    contact: ContactRecord,
    local_id: int,
    create_time: int | None,
) -> list[str]:
    connection = _connect_sqlite(get_message_resource_db(paths))
    try:
        chat_row = connection.execute(
            "SELECT rowid FROM ChatName2Id WHERE user_name = ?",
            (contact.username,),
        ).fetchone()
        if not chat_row:
            return []
        chat_id = int(chat_row[0])
        params: list[object] = [chat_id, int(local_id)]
        time_filter = ""
        if create_time is not None and create_time > 0:
            time_filter = " AND message_create_time = ?"
            params.append(int(create_time))
        info_rows = connection.execute(
            f"""
            SELECT message_id, packed_info
            FROM MessageResourceInfo
            WHERE chat_id = ? AND message_local_id = ?{time_filter}
            ORDER BY message_id DESC
            """,
            params,
        ).fetchall()

        hashes: list[str] = []
        for message_id, packed_info in info_rows:
            hashes.extend(_extract_hex_tokens(packed_info))
            detail_rows = connection.execute(
                """
                SELECT data_index, packed_info
                FROM MessageResourceDetail
                WHERE message_id = ?
                ORDER BY type ASC, size DESC
                """,
                (int(message_id),),
            ).fetchall()
            for data_index, detail_packed_info in detail_rows:
                hashes.extend(_extract_hex_tokens(data_index))
                hashes.extend(_extract_hex_tokens(detail_packed_info))
        return list(dict.fromkeys(hashes))
    finally:
        connection.close()


def get_message_media_file(
    username: str,
    local_id: int,
    create_time: int | None = None,
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
    variant: str = "preview",
    media_id: str | None = None,
) -> MediaFileResult:
    if variant == "video":
        return get_message_video_file(
            username=username,
            local_id=local_id,
            create_time=create_time,
            account_dir=account_dir,
            output_base=output_base,
            media_id=media_id,
        )
    return get_message_media(
        username=username,
        local_id=local_id,
        create_time=int(create_time or 0),
        variant=variant,
        account_dir=account_dir,
        output_base=output_base,
    )


def _video_candidate_roots(account_dir: Path, username: str, create_time: int | None) -> list[Path]:
    attach_root = _chat_attach_root(account_dir, username)
    video_root = account_dir / "msg" / "video"

    roots: list[Path] = []
    if create_time:
        month_key = datetime.fromtimestamp(create_time).strftime("%Y-%m")
        month_root = attach_root / month_key
        roots.extend(
            [
                video_root / month_key,
                month_root / "Rec",
                month_root / "Video",
                month_root / "File",
                month_root,
            ]
        )
    roots.extend([video_root, attach_root])
    return [root for root in dict.fromkeys(roots) if root.exists()]


def _verify_account_media_path(account_dir: Path, media_path: Path) -> Path:
    resolved_account = account_dir.resolve()
    resolved_media = media_path.resolve()
    if resolved_account == resolved_media or resolved_account in resolved_media.parents:
        return resolved_media
    raise ChatlogError(f"refusing to serve media outside account directory: {resolved_media}")


def normalize_media_ids(items: Iterable[str | None]) -> list[str]:
    normalized: list[str] = []
    for item in items:
        if not item:
            continue
        candidate = str(item).strip().lower()
        if not re.fullmatch(r"[0-9a-f]{32}", candidate):
            continue
        normalized.append(candidate)
    return list(dict.fromkeys(normalized))


def find_message_packed_media_ids(
    paths: AccountPaths,
    contact: ContactRecord,
    local_id: int,
    create_time: int | None = None,
) -> list[str]:
    table_name = message_table_name(contact.username)
    media_ids: list[str] = []
    for message_db in iter_message_dbs(paths):
        connection = _connect_sqlite(message_db)
        try:
            if not table_exists(connection, table_name):
                continue
            if create_time is not None:
                row = connection.execute(
                    f"""
                    SELECT packed_info_data
                    FROM [{table_name}]
                    WHERE local_id = ? AND create_time = ?
                    LIMIT 1
                    """,
                    (local_id, create_time),
                ).fetchone()
            else:
                row = connection.execute(
                    f"""
                    SELECT packed_info_data
                    FROM [{table_name}]
                    WHERE local_id = ?
                    LIMIT 1
                    """,
                    (local_id,),
                ).fetchone()
        finally:
            connection.close()
        if row:
            media_ids.extend(_extract_hex_tokens(row[0]))
    return normalize_media_ids(media_ids)


def find_video_file(
    account_dir: Path,
    username: str,
    local_id: int,
    create_time: int | None,
    media_ids: Iterable[str] = (),
) -> Path:
    roots = _video_candidate_roots(account_dir, username, create_time)
    if not roots:
        raise ChatlogError(f"video attachment directory not found for: {username}")

    clean_media_ids = normalize_media_ids(media_ids)
    exact_names = [f"{local_id}{suffix}" for suffix in VIDEO_SUFFIX_MIME]
    for media_id in clean_media_ids:
        exact_names.extend(f"{media_id}{suffix}" for suffix in VIDEO_SUFFIX_MIME)

    for root in roots:
        for file_name in exact_names:
            for candidate in root.rglob(file_name):
                if candidate.is_file():
                    return _verify_account_media_path(account_dir, candidate)

    for root in roots:
        for candidate in root.rglob("*"):
            if not candidate.is_file() or candidate.suffix.lower() not in VIDEO_SUFFIX_MIME:
                continue
            if clean_media_ids and any(media_id in candidate.name.lower() for media_id in clean_media_ids):
                return _verify_account_media_path(account_dir, candidate)

    raise ChatlogError(f"no local video file found for {username} local_id={local_id}")


def get_message_video_file(
    username: str,
    local_id: int,
    create_time: int | None = None,
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
    media_id: str | None = None,
) -> MediaFileResult:
    paths = ensure_prepared(account_dir=account_dir, output_base=output_base)
    contact = resolve_contact(paths, username)
    media_ids = normalize_media_ids(
        [
            media_id,
            *find_message_packed_media_ids(paths, contact, local_id, create_time),
            *_resource_hashes_for_message(paths, contact, local_id, create_time),
        ]
    )
    media_path = find_video_file(
        paths.account_dir,
        contact.username,
        local_id,
        create_time,
        media_ids,
    )
    return MediaFileResult(
        output_path=media_path,
        mime_type=VIDEO_SUFFIX_MIME.get(media_path.suffix.lower(), "application/octet-stream"),
        source_path=media_path,
    )


def safe_file_component(value: str) -> str:
    invalid = '<>:"/\\|?*\r\n\t'
    sanitized = "".join(character if character not in invalid else "_" for character in value).strip(" ._")
    return sanitized or "chat"


def get_chat_messages(
    query: str,
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
    limit: int | None = None,
    before_create_time: int | None = None,
    before_local_id: int | None = None,
) -> ChatMessagesResult:
    paths = ensure_prepared(account_dir=account_dir, output_base=output_base)
    contact = resolve_contact(paths, query)
    rows = iter_contact_messages(paths, contact)
    sender_name_map = load_message_name_map(paths)
    account_username = resolve_account_username(paths.account_dir.name, sender_name_map, contact.username)

    total_messages = len(rows)
    start_index = 0
    end_index = total_messages
    has_more = False
    next_before_create_time: int | None = None
    next_before_local_id: int | None = None

    if limit is not None and limit > 0:
        if before_create_time is not None and before_local_id is not None:
            end_index = next(
                (
                    index
                    for index, row in enumerate(rows)
                    if row[2] == before_create_time and row[0] == before_local_id
                ),
                total_messages,
            )
        start_index = max(0, end_index - limit)
        has_more = start_index > 0
        rows = rows[start_index:end_index]
        if has_more and rows:
            next_before_create_time = rows[0][2]
            next_before_local_id = rows[0][0]
    truncated = has_more

    return ChatMessagesResult(
        contact=contact,
        messages=build_message_records(rows, contact, account_username, sender_name_map),
        total_messages=total_messages,
        truncated=truncated,
        has_more=has_more,
        next_before_create_time=next_before_create_time,
        next_before_local_id=next_before_local_id,
    )


def export_chat(
    query: str,
    account_dir: Path | None = None,
    output_base: Path = DEFAULT_OUTPUT_BASE,
) -> ExportResult:
    resolved_account_dir = resolve_account_dir(account_dir)
    paths = build_account_paths(resolved_account_dir, output_base=output_base)
    chat = get_chat_messages(query, account_dir=resolved_account_dir, output_base=output_base)
    contact = chat.contact

    exported_at = datetime.now()
    stamp = exported_at.strftime("%Y%m%d-%H%M%S")
    file_name = (
        f"{stamp}__{safe_file_component(contact.display_name)}__"
        f"{safe_file_component(contact.username)}.txt"
    )
    paths.exports_dir.mkdir(parents=True, exist_ok=True)
    output_path = paths.exports_dir / file_name

    lines = [
        f"Chat: {contact.display_name}",
        f"Username: {contact.username}",
        f"Exported At: {exported_at.strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]
    for message in chat.messages:
        timestamp = datetime.fromtimestamp(message.create_time).strftime("%Y-%m-%d %H:%M:%S")
        extra_links = [link for link in message.links if link not in message.text]
        link_suffix = f" {' '.join(extra_links)}" if extra_links else ""
        lines.append(f"[{timestamp}] {message.sender}: {message.text}{link_suffix}")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    return ExportResult(contact=contact, output_path=output_path, message_count=chat.total_messages)
