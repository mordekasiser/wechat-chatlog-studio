# Chatlog Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D4.svg)](#requirements)

Local Windows tool for browsing and exporting your own WeChat desktop chat data.

[Quick Start](#quick-start) · [Usage](#usage) · [Project Layout](#project-layout) · [Chinese Guide](README.zh-CN.md)

---

## Why This Project Exists

Many new AI Skill projects use chat logs, photos, and personal notes to preserve or recreate someone's tone, memories, and communication style. In practice, WeChat and QQ data can be difficult to export cleanly, and manual copy-paste does not scale.

Chatlog Studio aims to make local chat data easier to export, organize, and maintain. It can be used as a data preparation tool for future AI Skill workflows, or simply as a way to preserve important conversations before device changes, migrations, or accidents cause data loss.

## What It Is

Chatlog Studio provides:
- a local web UI for browsing chats in the browser
- a CLI for preparing data, listing chats, and exporting a conversation
- a low-level key probe utility for Windows WeChat desktop databases

It is not a public online website.
It runs on your own Windows machine and opens a browser locally.

## Requirements

- Windows
- Python 3.10+
- WeChat desktop installed and logged in
- local WeChat data stored under an `xwechat_files` root directory

Common locations that Chatlog Studio can auto-discover include:
- `%USERPROFILE%\Documents\xwechat_files`
- `%OneDrive%\Documents\xwechat_files`

If your WeChat data lives somewhere else, the Web UI now lets you manually choose the WeChat data root directory, or you can pass `--account-dir` on the command line.

## Quick Start

Open PowerShell in the project root:

```powershell
python -m pip install .
chatlog-studio
```

Then:
1. wait for the browser to open
2. prepare or load local data from the Web UI
3. choose a chat on the left
4. export the current conversation if needed

## Usage

### Web UI

This is the recommended entrypoint for normal users:

```powershell
chatlog-studio
```

Inside the Web UI you can:
- switch the interface language between English and Chinese
- keep automatic discovery for common `xwechat_files` locations
- manually choose the WeChat data root when auto-discovery fails
- choose a custom output directory for decrypted data, exports, and extracted media

### CLI

Optional command line entrypoint:

```powershell
chatlog-studio-cli --help
```

Examples:

```powershell
chatlog-studio-cli --account-dir "%USERPROFILE%\Documents\xwechat_files" list
chatlog-studio-cli --account-dir "D:\WeChatData\xwechat_files" prepare --force
chatlog-studio-cli --account-dir "D:\WeChatData\xwechat_files\wxid_xxx" export "Contact Name"
```

### Low-Level Probe

Database/key probe entrypoint:

```powershell
wechat4-key-probe --help
```

## Source Checkout Scripts

If you are running directly from the source repository without installing the package, use the wrappers in [`scripts/`](scripts/):

```powershell
scripts\chatlog.bat
scripts\chatlog.bat install
scripts\chatlog.bat install --dev
scripts\chatlog.bat ui --no-browser
scripts\chatlog.bat cli --help
python scripts\chatlog_visual.py
python scripts\chatlog_tool.py
python scripts\wechat4_key_probe.py
```

These are repository-local helper scripts.
If you already ran `python -m pip install .`, prefer the installed commands:
- `chatlog-studio`
- `chatlog-studio-cli`
- `wechat4-key-probe`

If you want to choose a different output root, pass:

```powershell
chatlog-studio --output-base D:\ChatlogArchive
chatlog-studio-cli --output-base D:\ChatlogArchive export "Contact Name"
```

If you want to point the app at a specific WeChat data root or a single account directory, pass:

```powershell
chatlog-studio --account-dir "D:\WeChatData\xwechat_files"
chatlog-studio-cli --account-dir "D:\WeChatData\xwechat_files\wxid_xxx" list
```

The local web UI also lets you type or pick a folder as the output root. After switching, the selected root keeps each account under its own subdirectory and stores:
- `decrypted/`
- `exports/`
- `media/`

The same UI also supports:
- switching back to automatic WeChat root discovery
- manually selecting the `xwechat_files` root
- automatically preferring the currently logged-in WeChat account when a real match can be determined

## Output

Generated files are written under:

```text
%LOCALAPPDATA%\ChatlogStudio\<account-id>\
```

Common folders:
- `decrypted/`
- `exports/`
- `media/`

The actual layout is:

```text
<output-root>\<account-id>\
```

## Development

Install editable development dependencies:

```powershell
python -m pip install -e ".[dev]"
```

Run tests:

```powershell
python -m pytest
```

Build local distribution artifacts:

```powershell
python -m build
```

Repository-local helper script for development environments:

```powershell
scripts\chatlog.bat install --dev
```

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, verification steps, and repository hygiene rules.

This project is intended for exporting and browsing your own local WeChat desktop data on your own machine.

## Roadmap

- improve the WeChat export UI and browsing experience
- fix compatibility issues across WeChat versions and database layouts
- add support for QQ chat data export
- improve export formats for organization, search, and AI Skill data preparation

## Project Layout

```text
.
├── src/chatlog_studio/     # Python package
├── src/chatlog_studio/webui/ # Local web UI assets
├── scripts/                # Source-checkout helper scripts
├── pyproject.toml
├── requirements.txt
├── README.md
├── README.zh-CN.md
└── LICENSE
```

## License

MIT. See [LICENSE](LICENSE).
