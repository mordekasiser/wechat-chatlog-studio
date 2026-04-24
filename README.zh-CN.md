# Chatlog Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D4.svg)](#使用前提)

本地 Windows 工具，用于浏览和导出你自己的微信桌面版聊天数据。

[快速开始](#快速开始) · [使用方式](#使用方式) · [项目结构](#项目结构) · [English](README.md)

---

## 为什么做这个项目

很多新的 AI Skill 项目开始尝试基于聊天记录、照片和个人描述来还原一个人的说话方式与记忆片段，但微信和 QQ 的数据并不容易整理出来，手动复制粘贴也很低效。

Chatlog Studio 的目标是把这些本地聊天数据更方便地导出、整理和维护。它既可以作为后续 AI Skill 数据准备的一环，也可以帮助用户保存自己珍视的对话记录，避免因为设备、迁移或误操作而丢失重要聊天。

## 这是什么

Chatlog Studio 提供：
- 一个本地网页界面，用浏览器查看聊天记录
- 一个命令行工具，用来准备数据、列出会话和导出聊天
- 一个底层探测工具，用于 Windows 微信桌面数据库检查

它不是公网在线网站。
程序运行在你自己的 Windows 电脑上，启动后会在本机打开浏览器页面。

## 使用前提

- Windows
- Python 3.10 及以上
- 已安装并登录微信桌面版
- 本地微信数据位于某个 `xwechat_files` 根目录下

程序会自动扫描这些常见位置：
- `%USERPROFILE%\Documents\xwechat_files`
- `%OneDrive%\Documents\xwechat_files`

如果你的微信数据不在这些默认位置，现在也可以在网页界面里手动选择微信文件根目录，或者通过命令行传入 `--account-dir`。

## 快速开始

在项目根目录打开 PowerShell：

```powershell
python -m pip install .
chatlog-studio
```

然后：
1. 等浏览器自动打开
2. 点击 `使用本地缓存 / 准备数据`
3. 在左侧选择一个会话
4. 需要导出时点击 `导出当前会话`

## 使用方式

### 网页界面

普通用户推荐使用这个入口：

```powershell
chatlog-studio
```

网页界面现在支持：
- 自动发现常见的 `xwechat_files` 目录
- 自动发现失败时手动选择微信文件根目录
- 手动切换导出输出目录

### 命令行

可选命令行入口：

```powershell
chatlog-studio-cli --help
```

示例：

```powershell
chatlog-studio-cli --account-dir "C:\Users\you\Documents\xwechat_files" list
chatlog-studio-cli --account-dir "D:\WeChatData\xwechat_files" prepare --force
chatlog-studio-cli --account-dir "D:\WeChatData\xwechat_files\wxid_xxx" export "联系人名"
```

### 底层探测工具

数据库和密钥探测入口：

```powershell
wechat4-key-probe --help
```

## 源码仓库里的脚本

如果你是直接运行源码仓库，还没有安装包，可以使用 [`scripts/`](scripts/) 里的辅助脚本：

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

这些脚本只适合源码仓库本地运行。
如果已经执行过 `python -m pip install .`，优先使用安装后的正式命令：
- `chatlog-studio`
- `chatlog-studio-cli`
- `wechat4-key-probe`

如果想指定输出根目录，可以在命令行追加：

```powershell
chatlog-studio --output-base D:\ChatlogArchive
chatlog-studio-cli --output-base D:\ChatlogArchive export "联系人名"
```

如果想显式指定微信文件根目录或单个账号目录，也可以传：

```powershell
chatlog-studio --account-dir "D:\WeChatData\xwechat_files"
chatlog-studio-cli --account-dir "D:\WeChatData\xwechat_files\wxid_xxx" list
```

网页界面里也可以直接输入或选择一个文件夹作为输出根目录。切换后，该目录下会按账号创建子目录，并统一存放：
- `decrypted/`
- `exports/`
- `media/`

同一个网页界面还支持：
- 恢复自动发现微信目录
- 手动选择 `xwechat_files` 根目录
- 在能够真实匹配时优先选择当前已登录的微信账号

## 输出目录

生成的文件默认写到：

```text
%LOCALAPPDATA%\ChatlogStudio\<account-id>\
```

常见目录：
- `decrypted/`
- `exports/`
- `media/`

实际结构是：

```text
<输出根目录>\<account-id>\
```

## 开发

安装开发依赖：

```powershell
python -m pip install -e ".[dev]"
```

运行测试：

```powershell
python -m pytest
```

构建本地发布产物：

```powershell
python -m build
```

如果你直接在源码仓库里开发，也可以先运行：

```powershell
scripts\chatlog.bat install --dev
```

## 贡献说明

欢迎提交 issue 和 PR。开发环境、验证步骤和仓库卫生要求见 [CONTRIBUTING.md](CONTRIBUTING.md)。

本项目只面向用户在自己电脑上浏览和导出自己的微信桌面版本地数据。

## 后续计划

- 优化微信聊天导出的界面和体验
- 修复不同微信版本和数据结构带来的兼容问题
- 增加 QQ 聊天数据导出的适配
- 改进导出格式，方便后续整理、检索和作为 AI Skill 数据源

## 项目结构

```text
.
├── src/chatlog_studio/       # Python 主程序包
├── src/chatlog_studio/webui/ # 本地网页界面资源
├── scripts/                  # 源码运行辅助脚本
├── pyproject.toml
├── requirements.txt
├── README.md
├── README.zh-CN.md
└── LICENSE
```

## 开源协议

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
