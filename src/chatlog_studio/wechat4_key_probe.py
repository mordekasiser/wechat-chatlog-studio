from __future__ import annotations

import argparse
import ctypes
import hashlib
import hmac
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Sequence

PACKAGE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_ROOT.parent.parent

try:
    from Cryptodome.Cipher import AES
except ImportError:
    from Crypto.Cipher import AES  # type: ignore

from wdecipher.utils.win32_process import (  # type: ignore
    MEMORY_BASIC_INFORMATION,
    close_handle,
    get_current_processes,
    open_process,
    query_addr,
    read_memory,
)


PROCESS_NAME = "Weixin.exe"
PROCESS_ACCESS = 0x0400 | 0x0010
PAGE_SIZE = 4096
DEFAULT_PAGES_TO_CHECK = 3
DEFAULT_MAX_CANDIDATES = 256
HEX_CANDIDATE_RE = re.compile(rb"x'([0-9A-Fa-f]{64})([0-9A-Fa-f]{32})'")
DEFAULT_DB_ROOT = Path.home() / "Documents" / "xwechat_files"
DEFAULT_DB_PATTERN = "*/db_storage/message/message_0.db"


@dataclass(frozen=True)
class Candidate:
    pid: int
    address: int
    key: bytes
    salt: bytes
    literal: str


@dataclass(frozen=True)
class Variant:
    name: str
    reserve: int
    hmac_hash: str
    hmac_size: int
    kdf_hash: str
    kdf_iter: int
    raw_key: bool
    use_candidate_salt: bool
    pgno_little_endian: bool
    hmac_kdf_iter: int = 2


@dataclass(frozen=True)
class ValidationResult:
    candidate: Candidate
    variant: Variant
    derived_key: bytes
    derived_salt: bytes
    pages_checked: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only Windows probe for WeChat 4.x xwechat SQLCipher/WCDB keys."
    )
    parser.add_argument(
        "--db",
        type=Path,
        help="Target encrypted database path. If omitted, try to auto-discover message_0.db.",
    )
    parser.add_argument(
        "--decrypt-out",
        type=Path,
        help="Optional output path for a decrypted copy of the single target database.",
    )
    parser.add_argument(
        "--reveal-key",
        action="store_true",
        help="Print the full key only when a working candidate is found.",
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=DEFAULT_PAGES_TO_CHECK,
        help="Number of pages to HMAC-check per candidate.",
    )
    parser.add_argument(
        "--max-candidates",
        type=int,
        default=DEFAULT_MAX_CANDIDATES,
        help="Stop scanning after this many unique x'<64hex><32hex>' candidates.",
    )
    return parser.parse_args()


def mask_hex(data: bytes, reveal: bool) -> str:
    hex_text = data.hex()
    if reveal or len(hex_text) <= 16:
        return hex_text
    return f"{hex_text[:12]}...{hex_text[-8:]}"


def discover_default_db() -> Path | None:
    if not DEFAULT_DB_ROOT.exists():
        return None
    matches = sorted(DEFAULT_DB_ROOT.glob(DEFAULT_DB_PATTERN), key=lambda path: path.stat().st_mtime, reverse=True)
    return matches[0] if matches else None


def resolve_db_path(db_path: Path | None) -> Path:
    if db_path is not None:
        return db_path.resolve()
    discovered = discover_default_db()
    if discovered is None:
        raise FileNotFoundError("no database specified and message_0.db auto-discovery failed")
    return discovered.resolve()


def get_weixin_pids() -> list[int]:
    return [pid for pid, name in get_current_processes() if name == PROCESS_NAME]


def iter_readable_regions(process_handle) -> Iterator[tuple[int, int]]:
    mbi = MEMORY_BASIC_INFORMATION()
    address = 0
    max_address = 0x7FFFFFFFFFFFFFFF if sys.maxsize > 2**32 else 0x7FFF0000
    allowed_protections = {0x02, 0x04, 0x10, 0x20, 0x40}
    while address < max_address:
        if query_addr(process_handle, address, ctypes.byref(mbi), ctypes.sizeof(mbi)) == 0:
            break
        region_base = int(mbi.BaseAddress or 0)
        region_size = int(mbi.RegionSize or 0)
        if region_size > 0 and mbi.State == 0x1000 and mbi.Protect in allowed_protections:
            yield region_base, region_size
        address = region_base + max(region_size, 0x1000)


def read_region(process_handle, base_address: int, size: int) -> bytes:
    c_buffer = ctypes.create_string_buffer(size)
    c_read = ctypes.c_size_t()
    ok = read_memory(
        process_handle,
        ctypes.c_void_p(base_address),
        c_buffer,
        size,
        ctypes.byref(c_read),
    )
    if ok == 0 or c_read.value == 0:
        return b""
    return c_buffer.raw[: c_read.value]


def scan_process_candidates(pid: int, max_candidates: int) -> list[Candidate]:
    handle = open_process(PROCESS_ACCESS, False, pid)
    if not handle:
        raise OSError(f"failed to open process {pid}")
    seen: set[str] = set()
    results: list[Candidate] = []
    try:
        for base_address, region_size in iter_readable_regions(handle):
            region = read_region(handle, base_address, region_size)
            if not region:
                continue
            for match in HEX_CANDIDATE_RE.finditer(region):
                literal = match.group(0).decode("ascii")
                if literal in seen:
                    continue
                seen.add(literal)
                results.append(
                    Candidate(
                        pid=pid,
                        address=base_address + match.start(),
                        key=bytes.fromhex(match.group(1).decode("ascii")),
                        salt=bytes.fromhex(match.group(2).decode("ascii")),
                        literal=literal,
                    )
                )
                if len(results) >= max_candidates:
                    return results
    finally:
        close_handle(handle)
    return results


def scan_all_candidates(max_candidates: int) -> list[Candidate]:
    all_candidates: list[Candidate] = []
    seen_literals: set[str] = set()
    for pid in get_weixin_pids():
        for candidate in scan_process_candidates(pid, max_candidates=max_candidates):
            if candidate.literal in seen_literals:
                continue
            seen_literals.add(candidate.literal)
            all_candidates.append(candidate)
            if len(all_candidates) >= max_candidates:
                return all_candidates
    return all_candidates


def read_db_pages(db_path: Path, pages_to_check: int) -> tuple[bytes, list[bytes]]:
    if pages_to_check < 1:
        raise ValueError("pages must be >= 1")
    with db_path.open("rb") as fp:
        first_page = fp.read(PAGE_SIZE)
        if len(first_page) < PAGE_SIZE:
            raise ValueError(f"database is too small for a {PAGE_SIZE}-byte page: {db_path}")
        db_salt = first_page[:16]
        pages = [first_page[16:]]
        for _ in range(1, pages_to_check):
            page = fp.read(PAGE_SIZE)
            if len(page) != PAGE_SIZE:
                break
            pages.append(page)
    return db_salt, pages


def derive_main_key(candidate: Candidate, variant: Variant, db_salt: bytes) -> tuple[bytes, bytes]:
    salt = candidate.salt if variant.use_candidate_salt else db_salt
    if variant.raw_key:
        return candidate.key, salt
    derived = hashlib.pbkdf2_hmac(
        variant.kdf_hash,
        password=candidate.key,
        salt=salt,
        iterations=variant.kdf_iter,
        dklen=32,
    )
    return derived, salt


def derive_hmac_key(main_key: bytes, salt: bytes, variant: Variant) -> bytes:
    mac_salt = bytes(byte ^ 0x3A for byte in salt)
    return hashlib.pbkdf2_hmac(
        variant.kdf_hash,
        password=main_key,
        salt=mac_salt,
        iterations=variant.hmac_kdf_iter,
        dklen=32,
    )


def page_number_bytes(page_number: int, little_endian: bool) -> bytes:
    return page_number.to_bytes(4, byteorder="little" if little_endian else "big")


def verify_page_hmac(page_data: bytes, page_number: int, hmac_key: bytes, variant: Variant) -> bool:
    if len(page_data) != PAGE_SIZE and page_number > 1:
        return False
    reserve = variant.reserve
    hmac_size = variant.hmac_size
    if len(page_data) <= reserve or reserve < hmac_size + 16:
        return False

    cipher_and_iv = page_data[:-hmac_size]
    actual_hmac = page_data[-hmac_size:]
    digestmod = getattr(hashlib, variant.hmac_hash)
    mac = hmac.new(hmac_key, cipher_and_iv, digestmod)
    mac.update(page_number_bytes(page_number, variant.pgno_little_endian))
    return hmac.compare_digest(mac.digest(), actual_hmac)


def build_variants() -> list[Variant]:
    variants: list[Variant] = []
    for raw_key in (True, False):
        for use_candidate_salt in (False, True):
            for little_endian in (True, False):
                variants.append(
                    Variant(
                        name=(
                            f"sqlcipher4-{'raw' if raw_key else 'pbkdf2'}-"
                            f"{'dbsalt' if not use_candidate_salt else 'candsalt'}-"
                            f"{'le' if little_endian else 'be'}"
                        ),
                        reserve=80,
                        hmac_hash="sha512",
                        hmac_size=64,
                        kdf_hash="sha512",
                        kdf_iter=256000,
                        raw_key=raw_key,
                        use_candidate_salt=use_candidate_salt,
                        pgno_little_endian=little_endian,
                    )
                )
    return variants


def validate_candidate(
    candidate: Candidate,
    db_salt: bytes,
    pages: Sequence[bytes],
    variants: Sequence[Variant],
) -> ValidationResult | None:
    ordered_variants = sorted(
        variants,
        key=lambda item: (
            candidate.salt != db_salt if item.use_candidate_salt else False,
            not item.raw_key,
            not item.pgno_little_endian,
            item.reserve,
        ),
    )
    for variant in ordered_variants:
        main_key, salt = derive_main_key(candidate, variant, db_salt)
        hmac_key = derive_hmac_key(main_key, salt, variant)
        pages_checked = 0
        ok = True
        for index, page_data in enumerate(pages, start=1):
            if not verify_page_hmac(page_data, index, hmac_key, variant):
                ok = False
                break
            pages_checked += 1
        if ok and pages_checked:
            return ValidationResult(
                candidate=candidate,
                variant=variant,
                derived_key=main_key,
                derived_salt=salt,
                pages_checked=pages_checked,
            )
    return None


def find_working_key(
    db_path: Path,
    pages: int = DEFAULT_PAGES_TO_CHECK,
    max_candidates: int = DEFAULT_MAX_CANDIDATES,
) -> ValidationResult:
    resolved_db_path = db_path.resolve()
    if not resolved_db_path.exists():
        raise FileNotFoundError(f"database not found: {resolved_db_path}")
    pids = get_weixin_pids()
    if not pids:
        raise RuntimeError(f"no running {PROCESS_NAME} processes found")

    db_salt, db_pages = read_db_pages(resolved_db_path, pages)
    variants = build_variants()
    for candidate in scan_all_candidates(max_candidates):
        result = validate_candidate(candidate, db_salt, db_pages, variants)
        if result is not None:
            return result
    raise LookupError("no working SQLCipher4/WCDB candidate matched the checked pages")


def decrypt_database(db_path: Path, out_path: Path, result: ValidationResult) -> None:
    resolved_db_path = db_path.resolve()
    resolved_out_path = out_path.resolve()
    if resolved_out_path == resolved_db_path:
        raise ValueError("out_path must not overwrite the source database")

    reserve = result.variant.reserve
    key = result.derived_key
    resolved_out_path.parent.mkdir(parents=True, exist_ok=True)
    with resolved_db_path.open("rb") as src, resolved_out_path.open("wb") as dst:
        header_page = src.read(PAGE_SIZE)
        if len(header_page) < PAGE_SIZE:
            raise ValueError(f"database is too small for a {PAGE_SIZE}-byte page: {resolved_db_path}")

        dst.write(b"SQLite format 3\x00")
        first_payload = header_page[16:]
        dst.write(AES.new(key, AES.MODE_CBC, first_payload[-reserve:-reserve + 16]).decrypt(first_payload[:-reserve]))
        dst.write(first_payload[-reserve:])

        while True:
            page = src.read(PAGE_SIZE)
            if not page:
                break
            if len(page) != PAGE_SIZE:
                raise ValueError(f"encountered truncated page while decrypting {resolved_db_path}")
            dst.write(AES.new(key, AES.MODE_CBC, page[-reserve:-reserve + 16]).decrypt(page[:-reserve]))
            dst.write(page[-reserve:])


def summarize_candidates(candidates: Sequence[Candidate], reveal: bool) -> None:
    print(f"found {len(candidates)} unique memory candidates")
    for index, candidate in enumerate(candidates[:10], start=1):
        print(
            f"[{index}] pid={candidate.pid} addr=0x{candidate.address:016X} "
            f"key={mask_hex(candidate.key, reveal)} salt={mask_hex(candidate.salt, reveal)}"
        )
    if len(candidates) > 10:
        print(f"... {len(candidates) - 10} more candidates omitted")


def main() -> int:
    args = parse_args()
    try:
        db_path = resolve_db_path(args.db)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    pids = get_weixin_pids()
    if not pids:
        print(f"no running {PROCESS_NAME} processes found", file=sys.stderr)
        return 3

    print(f"target db: {db_path}")
    print(f"running {PROCESS_NAME} pids: {', '.join(str(pid) for pid in pids)}")

    try:
        db_salt, pages = read_db_pages(db_path, args.pages)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(f"db salt: {mask_hex(db_salt, args.reveal_key)}")

    candidates = scan_all_candidates(args.max_candidates)
    summarize_candidates(candidates, reveal=False)
    if not candidates:
        print("no x'<64hex><32hex>' candidates found in memory", file=sys.stderr)
        return 4

    variants = build_variants()
    best: ValidationResult | None = None
    for candidate in candidates:
        best = validate_candidate(candidate, db_salt, pages, variants)
        if best is not None:
            break

    if best is None:
        print("no working SQLCipher4/WCDB candidate matched the checked pages", file=sys.stderr)
        return 5

    print(
        "match found: "
        f"pid={best.candidate.pid} "
        f"variant={best.variant.name} "
        f"pages_checked={best.pages_checked} "
        f"key={mask_hex(best.derived_key, args.reveal_key)} "
        f"salt={mask_hex(best.derived_salt, args.reveal_key)}"
    )
    if args.reveal_key:
        print(f"full candidate literal: {best.candidate.literal}")

    if args.decrypt_out:
        out_path = args.decrypt_out.resolve()
        if out_path.exists():
            if out_path.is_dir():
                print(f"--decrypt-out points to an existing directory: {out_path}", file=sys.stderr)
                return 7
            backup_path = out_path.with_suffix(out_path.suffix + ".bak")
            shutil.copyfile(out_path, backup_path)
        try:
            decrypt_database(db_path, out_path, best)
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 6
        print(f"decrypted copy written to: {out_path}")

    return 0


__all__ = [
    "Candidate",
    "ValidationResult",
    "decrypt_database",
    "find_working_key",
    "mask_hex",
    "scan_all_candidates",
]


if __name__ == "__main__":
    raise SystemExit(main())
