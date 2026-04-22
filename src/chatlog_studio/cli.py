from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from .core import (
    AmbiguousContactError,
    ChatlogError,
    DEFAULT_OUTPUT_BASE,
    export_chat,
    find_contacts,
    list_sessions,
    prepare_data,
    resolve_account_dir,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Chat log tool for your own local WeChat desktop data."
    )
    parser.add_argument(
        "--account-dir",
        type=Path,
        help="Optional account directory under Documents\\xwechat_files.",
    )
    parser.add_argument(
        "--output-base",
        type=Path,
        default=DEFAULT_OUTPUT_BASE,
        help="Root directory where per-account decrypted databases, exports and extracted media are written.",
    )

    subparsers = parser.add_subparsers(dest="command")

    prepare_parser = subparsers.add_parser("prepare", help="Decrypt required databases into the local cache.")
    prepare_parser.add_argument("--pages", type=int, default=3, help="How many database pages to verify.")
    prepare_parser.add_argument(
        "--max-candidates",
        type=int,
        default=256,
        help="Maximum unique in-memory key candidates to scan.",
    )
    prepare_parser.add_argument(
        "--force",
        action="store_true",
        help="Clear derived cache first and rebuild from local WeChat data.",
    )

    list_parser = subparsers.add_parser("list", help="List recent chats or filter by a keyword.")
    list_parser.add_argument("keyword", nargs="?", help="Optional keyword for display name / username / summary.")

    export_parser = subparsers.add_parser("export", help="Export one chat to a UTF-8 text file.")
    export_parser.add_argument("query", help="Contact display name, remark, alias or username.")

    return parser


def format_timestamp(value: int) -> str:
    if value <= 0:
        return "-"
    return datetime.fromtimestamp(value).strftime("%Y-%m-%d %H:%M:%S")


def print_sessions(rows) -> None:
    if not rows:
        print("No chats matched.")
        return

    print(f"Found {len(rows)} chat(s):")
    for index, row in enumerate(rows, start=1):
        print(
            f"{index:>3}. {row.display_name} | {row.username} | "
            f"{format_timestamp(row.last_timestamp)} | {row.summary}"
        )


def print_contacts(rows) -> None:
    if not rows:
        print("No contacts matched.")
        return

    print(f"Found {len(rows)} contact(s):")
    for index, row in enumerate(rows, start=1):
        print(
            f"{index:>3}. {row.display_name} | username={row.username} | "
            f"remark={row.remark or '-'} | nick={row.nick_name or '-'} | alias={row.alias or '-'}"
        )


def run_prepare(args: argparse.Namespace) -> int:
    result = prepare_data(
        account_dir=args.account_dir,
        output_base=args.output_base,
        pages=args.pages,
        max_candidates=args.max_candidates,
        force=args.force,
    )
    print("Prepare completed.")
    print(f"Account: {result.paths.account_dir}")
    print(f"Output:  {result.paths.output_root}")
    print(f"Decrypted databases: {len(result.decrypted_files)}")
    print(f"Used cache:          {'yes' if result.used_cache else 'no'}")
    print(f"Validated variant:   {result.validation.variant.name if result.validation else 'cache'}")
    return 0


def run_list(args: argparse.Namespace) -> int:
    rows = list_sessions(
        account_dir=args.account_dir,
        output_base=args.output_base,
        keyword=args.keyword,
    )
    print_sessions(rows)
    return 0


def run_export(args: argparse.Namespace) -> int:
    try:
        result = export_chat(
            query=args.query,
            account_dir=args.account_dir,
            output_base=args.output_base,
        )
    except AmbiguousContactError as exc:
        print(f"Multiple contacts matched: {exc.query}")
        print_contacts(exc.matches)
        return 2

    print("Export completed.")
    print(f"Contact: {result.contact.display_name} ({result.contact.username})")
    print(f"Messages: {result.message_count}")
    print(f"File: {result.output_path}")
    return 0


def run_interactive_menu(parser: argparse.ArgumentParser) -> int:
    while True:
        print()
        print("Chat Log Tool")
        print("1. Prepare local chat data")
        print("2. List chats")
        print("3. Export one chat")
        print("4. Exit")
        choice = input("> ").strip()

        if choice == "1":
            args = parser.parse_args(["prepare"])
            code = run_command(args)
            if code != 0:
                return code
        elif choice == "2":
            keyword = input("Keyword (optional): ").strip()
            command = ["list"] + ([keyword] if keyword else [])
            args = parser.parse_args(command)
            code = run_command(args)
            if code != 0:
                return code
        elif choice == "3":
            query = input("Contact name / alias / username: ").strip()
            if not query:
                print("A contact query is required.")
                continue
            args = parser.parse_args(["export", query])
            code = run_command(args)
            if code != 0:
                return code
        elif choice == "4":
            return 0
        else:
            print("Please choose 1, 2, 3 or 4.")


def run_command(args: argparse.Namespace) -> int:
    if args.command == "prepare":
        return run_prepare(args)
    if args.command == "list":
        return run_list(args)
    if args.command == "export":
        return run_export(args)
    raise ChatlogError(f"unknown command: {args.command}")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command is None:
            return run_interactive_menu(parser)

        resolve_account_dir(args.account_dir)
        return run_command(args)
    except (ChatlogError, FileNotFoundError, LookupError, OSError, RuntimeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
