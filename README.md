# 🌌 VocabNet

[![English](https://img.shields.io/badge/Language-English-blue)](#english)
[![Chinese](https://img.shields.io/badge/Language-简体中文-red)](#chinese)

---

<a name="english"></a>
## 📖 The Story & Inspiration
VocabNet was born out of a personal struggle with **audiobooks**. While listening to complex literature or academic texts, I often encountered "speed bumps"—obscure vocabulary or idioms that hindered my immersion and understanding. 

I created this tool to **pre-process** books. It extracts the most difficult words and thematic entities (characters, locations, concepts) before you listen. By briefly reviewing the "Intelligence Nebula" and the localized lexicon, you can clear the mental hurdles before the first chapter begins, turning a difficult listen into a seamless experience.

## 🚀 Key Features
- **Thematic Intelligence Nebula**: A high-fidelity force-directed graph revealing character relationships and concept gravity.
- **Automated Lexicon Extraction**: Identifies C1/C2 level words, idioms, and phrasal verbs.
- **Context-Aware Study**: View every occurrence of a word across your entire archive.
- **Spaced Repetition (SM-2)**: Built-in vocabulary mastery tracking.
- **Anki Integration**: Export your findings directly to high-quality flashcard decks.

## 🛠️ Tech Stack
- **Frontend**: React 19, Vite, Framer Motion (Animations), D3.js (Graph Physics).
- **Backend**: FastAPI (Python 3.12), SQLModel (ORM), SQLite.
- **Intelligence**: spaCy (NLP), `wordfreq` (Zipf-based CEFR estimation).

## 🏁 Getting Started
1. **Install Requirements**:
   ```bash
   cd backend && pip install -r requirements.txt
   cd ../frontend && pnpm install
   ```
2. **Run the Project**:
   ```bash
   python run.py
   ```
   *The database will be initialized and migrated automatically on the first run.*

---

<a name="chinese"></a>
## 📖 项目故事与灵感 (Chinese)
VocabNet 的诞生源于我在听 **有声书 (Audiobooks)** 时的个人困扰。在阅读复杂的文学或学术作品时，偶尔出现的生僻词汇或习语总会打断心流，影响理解。

我开发了这个工具用于 **有声书预读**。它能在你开始聆听之前，自动提取书中最难的词汇和核心实体（人物、地点、概念）。通过预览“智能星云 (Intelligence Nebula)”和词汇表，你可以提前扫清语言障碍，让聆听过程变得行云流水。

## 🚀 核心功能
- **沉浸式知识图谱**: 揭示人物关系与概念引力的力导向图。
- **自动化词汇提取**: 智能识别 C1/C2 级难词、习语及短语动词。
- **跨卷上下文**: 查看同一个词在你整个个人档案馆中的所有出现位置。
- **间隔复习 (SM-2)**: 内置高效的词汇掌握追踪系统。
- **Anki 集成**: 支持一键导出高质量的 Anki 记忆卡片。

## 🛠️ 技术栈
- **前端**: React 19, Vite, Framer Motion (动画), D3.js (图谱物理引擎)。
- **后端**: FastAPI (Python 3.12), SQLModel (ORM), SQLite。
- **核心算法**: spaCy (NLP), `wordfreq` (基于 Zipf 频率的 CEFR 等级评估)。

## 🏁 快速开始

### 1. 安装依赖
```bash
# 后端
cd backend && pip install -r requirements.txt

# 前端
cd ../frontend && pnpm install
```

### 2. 运行项目 (一键启动)
VocabNet 提供了便捷的启动脚本，可同时运行后端和前端服务：

- **Windows 用户**: 直接双击运行 `run.bat` 或在终端执行 `.\run.bat`。
- **macOS / Linux 用户**: 执行 `./run.sh`（确保已赋予执行权限：`chmod +x run.sh`）。
- **手动启动**: 执行 `python run.py`。

*首次运行时，系统会自动创建并初始化数据库。*
