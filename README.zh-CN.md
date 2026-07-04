# Wiki Docs（`docs`）

[English](README.md) | 简体中文

Baklib **Wiki** 纯文档主题（`theme_scope`: `wiki`，版本 **1.2.1**）：侧栏导航、页内目录、搜索与 AI 问答侧栏、页面工具（含分享到 LLM）、反馈与 Turbo 导航，面向产品文档与 API 指南，而非通用帮助中心 / FAQ 门户。

## 特性

- **三套首页布局** — Class经典布局、Tree文档布局、Card文档布局（`index.liquid` / `index.tree.liquid` / `index.card.liquid`，对应 `template_style` 为空 / `tree` / `card`）；字段 ID 一致，后台配置可在变体间迁移
- **正文与首页同族** — `page.liquid` 按站点首页 `template_style`（空 / `tree` / `card`）复用对应片段
- **AI 与搜索** — AI 侧栏、搜索弹窗、可配置热门关键词与 AI 回答结束语
- **七种语言** — 前台文案（`*.json`）与主题编辑器文案（`*.schema.json`）
- **前端技术栈** — Tailwind CSS 4、daisyUI、Stimulus、Alpine.js、Turbo（由 `src/` 构建至 `assets/`）

## 环境要求

- Node.js（用于 `yarn build` / `yarn dev`）
- Baklib 站点使用 **Wiki** 范围并安装本主题

## 目录说明

| 路径 | 说明 |
| --- | --- |
| `config/settings_schema.json` | 主题元数据、全局设置、预览图路径 |
| `layout/` | 基础布局（`theme.liquid`、`error.liquid`） |
| `templates/` | 首页变体、内容页、反馈 Turbo Stream、搜索 |
| `snippets/` | 公共片段；`index/` 下为各变体首页/正文外壳及 AI、反馈片段 |
| `locales/` | 前台文案（`*.json`）与编辑器文案（`*.schema.json`） |
| `src/` | 源码 CSS/JS（Tailwind CLI、esbuild） |
| `assets/` | 构建产物与按语言存放的预览截图 |
| `statics/` | 可选静态 Liquid 端点 |

## 模板

### 首页

`templates/index.<variant>.liquid` — 在 Baklib 后台将其中一套设为站点首页模板。

| 模板 | 变体 | 说明 |
| --- | --- | --- |
| `index.liquid` | Class经典布局 | 渐变 Hero、频道入门卡片、推荐阅读；产品文档默认推荐 |
| `index.tree.liquid` | Tree文档布局 | Hero、快速指引卡片、推荐列表与底部求助/反馈横幅 |
| `index.card.liquid` | Card文档布局 | 左侧栏集成 Logo、搜索与全站导航；描边卡片与 Pill 搜索 |

**首页逻辑：** 填写 `home_page_path`（如 `/docs/getting-started`）可在 `/` 展示指定站内页面；留空则使用当前变体的默认首页区块（主标题、热门搜索、快速指引等）。子页面可在页面设置中勾选 **显示在首页快速指引**。

各变体片段位于 `snippets/index/<variant>/`；共用片段包括 `snippets/index/_ai_sidebar.liquid`、`_ai_chat_messages.liquid` 及首页反馈相关 partial。

### 内容页

`templates/page.liquid` — 文档正文页；布局随 `site.pages['/'].template_style` 与首页一致（空、`tree` 或 `card`）。

### 其他

| 文件 | 作用 |
| --- | --- |
| `templates/search.liquid` | 预留 |
| `templates/feedback_*_turbo_stream.liquid` | 页面反馈的 Turbo Stream 响应 |
| `statics/about.liquid` | 静态页示例 |
| `statics/page/nav_tree.liquid` | 导航树静态端点 |

## 支持的语言

前台与 schema 已包含：

`en` · `zh-CN` · `zh-TW` · `ko` · `ja` · `de` · `fr`

修改 `locales/<locale>.json`（前台）与 `locales/<locale>.schema.json`（编辑器）。新增语言请在 `config/settings_schema.json` 的 `theme_info.theme_languages` 中登记。

## 构建资源

```bash
yarn install
yarn build
```

开发监听（CSS/JS）：

```bash
yarn dev
```

可选：编辑 Liquid / 文案时自动刷新（需 Ruby，依赖见 `Gemfile`）：

```bash
bundle install
yarn livereload
```

## 预览图

**主题卡片缩略图**（全语言共用）：

```text
assets/images/theme/thumb-indigo.png
```

**按语言截图** — 放入 `assets/images/theme/<lang>/`：

```text
assets/images/theme/<lang>/
├── index.png
├── index-tree.png
├── index-card.png
├── page.png
└── page-ai.png
```

路径在 `config/settings_schema.json` 的 `theme_thumb_url`、`theme_preview_images` 中配置；`${lang}` 随后台界面语言解析。缺图时回退到站点默认语言目录。

## 文档

- 主题使用说明：<https://help.baklib.cn/themes/docs>
- 设置项参考：<https://help.baklib.cn/themes/docs/settings>
- 模板开发指南：<https://dev.baklib.cn/guide/git>

## 许可

见 [LICENSE](LICENSE)（若本目录无 LICENSE 文件，请以父仓库为准）。
