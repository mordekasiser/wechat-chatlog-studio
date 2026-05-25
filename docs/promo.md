# Chatlog Studio 推广文案

本页用于复制到社区、博客和社交平台。项目仍处于早期测试阶段，发布时请保留测试阶段和隐私边界说明。

项目地址：https://github.com/mordekasiser/wechat-chatlog-studio

## 一句话介绍

Chatlog Studio 是一个在 Windows 本机运行的微信桌面版聊天记录浏览和导出工具，适合用来保存重要对话、整理本地聊天数据，或为私有 AI Skill 实验准备数据。

## 中文短帖

我做了一个开源小工具 Chatlog Studio，用来在 Windows 本机浏览和导出自己的微信桌面版聊天数据。

它不是在线网站，数据处理在本机完成，目前支持本地网页界面、命令行导出、手动选择 `xwechat_files` 目录和自定义输出目录。

项目还在早期测试阶段，不同微信版本和数据目录可能会有兼容性问题。欢迎试用、提 Issue，反馈时最好附上微信版本、Windows 版本、错误信息和复现步骤。

GitHub：https://github.com/mordekasiser/wechat-chatlog-studio

如果你也需要整理或备份自己的聊天记录，欢迎 star/watch 关注后续更新。

## 中文长帖

最近做了一个开源工具 Chatlog Studio，主要解决一个很具体的问题：微信桌面版聊天数据不好整理，手动复制粘贴效率很低。

这个工具目前支持：

- 在本机启动网页界面浏览聊天
- 自动发现常见的 `xwechat_files` 目录
- 自动发现失败时手动选择微信数据根目录
- 自定义导出输出目录
- 通过 CLI 列出会话和导出指定聊天

我做它的初衷是方便保存重要对话，也方便把自己的本地聊天记录整理成后续可检索、可维护的数据。它不是公网服务，不会要求上传数据，运行后是在自己的 Windows 电脑上打开本地页面。

目前项目仍处于早期测试阶段，微信版本、系统环境和本地数据结构差异都可能带来 bug。欢迎大家试用和反馈，尤其是兼容性问题。反馈时请尽量附上微信版本、Windows 版本、错误信息和复现步骤。

项目地址：https://github.com/mordekasiser/wechat-chatlog-studio

如果觉得方向有用，欢迎 star/watch，后续会继续修复 bug、改进导出体验，并尝试扩展更多聊天数据来源。

## English Short Post

I built Chatlog Studio, an open-source local Windows tool for browsing and exporting your own WeChat desktop chat data.

It runs on your machine, opens a local web UI, and supports common `xwechat_files` discovery, manual folder selection, custom output folders, and a CLI for listing/exporting conversations.

The project is still in an early testing stage, so compatibility feedback is very welcome. If you try it, please report your WeChat version, Windows version, error message, and reproduction steps when something breaks.

GitHub: https://github.com/mordekasiser/wechat-chatlog-studio

Stars/watches are appreciated if you want to follow future fixes and updates.

## 标题备选

- 我做了一个本地微信聊天记录浏览和导出工具
- Chatlog Studio：在 Windows 本机整理自己的微信聊天数据
- 开源试用：微信桌面版聊天记录本地导出工具
- Local-first WeChat desktop chat export tool for Windows

## 适合发布的地方

- V2EX：分享创造 / 程序员 / Windows
- 知乎：工具介绍、数据备份、个人知识库相关话题
- 小众软件：Windows 工具、备份工具
- GitHub 中文社区：开源项目介绍
- Reddit：r/opensource、r/selfhosted、r/DataHoarder，注意说明 WeChat 场景较垂直

## 发布注意

- 不要承诺完全兼容所有微信版本。
- 不要暗示可以导出他人数据。
- 不要上传真实聊天截图。
- 建议配合测试数据截图或打码后的界面截图。
