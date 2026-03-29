# Claude Widget

> 一個輕量的 Windows 桌面小工具，即時顯示你的 Claude.ai 用量進度。
> A lightweight Windows desktop widget that shows your Claude.ai usage in real time.

[![Download](https://img.shields.io/github/v/release/wadewoo999/claude-widget?label=Download&logo=github)](https://github.com/wadewoo999/claude-widget/releases/latest)
![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 功能特色 / Features

| 功能 | 說明 |
|------|------|
| 📊 雙進度條 | **Current session**（5 小時視窗）+ **Weekly**（7 天累計） |
| 🎨 三色警示 | 藍色 < 75%、橘色 75–90%、紅色 ≥ 90% |
| ⏱ 自動刷新 | 每 60 秒自動更新，點 ↻ 可立即刷新 |
| 🌙 暗/亮主題 | 一鍵切換，設定自動記憶 |
| 📐 雙版面 | Wide（500×115px，並排）/ Tall（375×170px，上下堆疊） |
| 📌 永遠置頂 | 可選擇釘在所有視窗最上層 |
| 🖱 可拖曳 | 拖到任意位置，下次開啟自動回到上次位置 |
| 🔐 原生登入 | 透過內建 Chromium 視窗登入 claude.ai，無需手動貼 Token |

---

## 截圖 / Screenshots

> *(Wide 模式 — 暗色主題)*

```
┌─────────────────────────────────────── [▭] [🌙] [📌] [─] [✕]┐
│  Current session                                        9%   │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░  Resets in 3 hr 41 min     │
│ ──────────────────────────────────────────────────────────── │
│  Weekly · All models                                   14%   │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░  Resets Mon 10:00 AM        │
│                          Last updated: just now  [↻]         │
└──────────────────────────────────────────────────────────────┘
```

---

## 下載 / Download

> **一鍵使用（不需安裝 Node.js）**
>
> 前往 [Releases 頁面](https://github.com/wadewoo999/claude-widget/releases/latest) 下載 `Claude-Widget-v1.0.0-win32-x64.zip`，解壓縮後直接雙擊 `Claude Widget.exe` 即可。

---

## 從原始碼安裝 / Install from source

### 系統需求 / Requirements
- Windows 10 / 11
- [Node.js 20+](https://nodejs.org/)

### 從原始碼執行 / Run from source

```bash
git clone https://github.com/<your-username>/claude-widget.git
cd claude-widget
npm install
npm start
```

### 打包成獨立執行檔 / Build executable

```bash
npm run build
# 輸出位置 / Output: dist\Claude Widget-win32-x64\Claude Widget.exe
```

打包完成後，直接雙擊 `Claude Widget.exe` 即可使用，無需安裝 Node.js。

---

## 使用方式 / Usage

1. 啟動後，若尚未登入會顯示提示
2. 點擊 **Login** 按鈕，內建瀏覽器視窗開啟 claude.ai 登入頁
3. 登入完成後點擊「**✓ 已登入 Claude — 點此關閉**」藍色按鈕
4. Widget 自動開始顯示用量數據

---

## 技術棧 / Tech Stack

- **[Electron](https://www.electronjs.org/)** — 跨平台桌面應用框架
- **[@electron/packager](https://github.com/electron/packager)** — 打包成獨立 exe
- **Vanilla JS + HTML/CSS** — 無需任何前端框架或打包工具
- **Node.js built-in `fs`** — 設定持久化（不依賴任何第三方 storage 套件）

---

## 專案結構 / Project Structure

```
claude-widget/
├── main.js        # Electron 主程序：視窗管理、API 請求、IPC
├── preload.js     # contextBridge：安全橋接主程序與渲染層
├── index.html     # 全部 UI（HTML + CSS + JS 合一）
└── package.json   # 專案設定與建置腳本
```

---

## 授權 / License

MIT © 2026
