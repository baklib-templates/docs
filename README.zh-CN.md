# Wiki Docs（`docs`）

[English](README.md) | 简体中文

面向 Baklib **Wiki**、对标 **Mintlify** 思路的 **纯文档** 主题：侧栏导航、页内目录、搜索与 AI 辅助、分享到 LLM、Turbo 导航——不包含「帮助中心 / FAQ 首页」等非文档模板。

## 环境要求

- Node.js（用于构建前端资源）
- Baklib 站点使用 **Wiki** 范围并启用本主题（`config/settings_schema.json` 中 `theme_scope` 为 `wiki`）

## 目录说明

| 路径                            | 说明                                       |
| ----------------------------- | ---------------------------------------- |
| `config/settings_schema.json` | 主题元数据、可选语言与编辑器配置项                        |
| `layout/`                     | 基础布局                                     |
| `templates/`                  | 页面模板（9 套对标 Mintlify 的首页变体、目录列表、文章详情、搜索、标签、视频、导出等）  |
| `snippets/`                   | 片段（页头、页脚、侧栏、页面工具、反馈、`index_themes/*` 等）   |
| `locales/`                    | 前台文案（`*.json`）与主题编辑器文案（`*.schema.json`）  |
| `src/`                        | 源码 CSS/JS（Tailwind、esbuild）              |
| `assets/`                     | 构建后的样式、脚本与主题预览图                          |
| `statics/`                    | 自定义静态 HTML 示例                            |

## 首页模板（对标 Mintlify）

`templates/index.<theme>.liquid` 提供 9 套对标 [Mintlify themes](https://www.mintlify.com/docs/customize/themes) 的首页变体，所有 schema 字段 ID 完全一致（后台已配置数据可平滑迁移），差异仅在布局密度、Hero 形态、装饰背景，由 [`src/stylesheets/themes.css`](src/stylesheets/themes.css) 中 `.theme-<name>` marker 类驱动。

| 模板                    | 变体          | 一句话说明                                                       |
| --------------------- | ----------- | ----------------------------------------------------------- |
| `index.mint.liquid`   | Mint        | 经典 3 列渐变卡片；最稳的默认款，原 `index.docs` 由它替代。                       |
| `index.maple.liquid`  | Maple       | 描边卡片 + Pill 搜索，适合 AI / SaaS 文档。                              |
| `index.palm.liquid`   | Palm        | 冷峻 mesh 背景 + 衬线标题 + 两列大卡，企业 / 金融取向。                          |
| `index.willow.liquid` | Willow      | 极简零干扰，纯文字卡片，默认关闭最新 / 热门。                                    |
| `index.linden.liquid` | Linden      | 复古终端：等宽字体 + 网格背景 + 虚线描边。                                    |
| `index.almond.liquid` | Almond      | 暖色渐变 + 大圆角卡片，所有板块默认开启。                                      |
| `index.aspen.liquid`  | Aspen       | 等高线背景 + 4 格入门 tile，面向 SDK / AI 工程文档。                          |
| `index.sequoia.liquid`| Sequoia     | 大留白 4 列，适合体量庞大的 API 与开发者平台文档。                                |
| `index.luma.liquid`   | Luma        | 最克制的一款：装饰极少，2 列扁平卡片。                                        |

公共片段位于 [`snippets/index_themes/`](snippets/index_themes/)（`_decoration` / `_hero_search` / `_channels_grid` / `_topic_grid` / `_recent_list` / `_hottest_list` / `_features_html`）。新增主题只需再写一个 `index.<theme>.liquid`，渲染同样的 partial 但传不同参数，并加上 `.theme-<theme>` 包裹类。

> **迁移提示**：原 `index.docs.liquid` 已被 `index.mint.liquid` 取代。如果某个 Baklib 站点仍绑定旧模板，请在后台首页模板下拉中改选 **Mint**。schema 字段 ID 不变，已配置的 slogan、hero 颜色、热门标签等会原样沿用。

## 支持的语言

前台与 schema 已包含：

- `en`、`zh-CN`、`zh-TW`、`ko`、`ja`、`de`、`fr`

新增/修改文案请编辑 `locales/<locale>.json`（前台）与 `locales/<locale>.schema.json`（主题编辑器）。新增语言时请在 [`config/settings_schema.json`](config/settings_schema.json) 的 `theme_info.theme_languages` 中登记。

## 构建资源

```bash
yarn install
yarn build
```

开发监听：

```bash
yarn dev
```

本地浏览器自动刷新（需要本地 Ruby 环境 + 浏览器 livereload 插件）：

```bash
bundle install
bundle exec guard
```

## 按语言切换的预览图

主题卡片与后台示意图按语言解析。请把不同语言的截图放到 `assets/images/theme/<lang>/`，后台会自动按当前语言加载：

```text
assets/images/theme/<lang>/
├── thumb.png            # 主题卡缩略图
├── index.png            # 主预览图
├── index-mint.png
├── index-maple.png
├── index-palm.png
├── index-willow.png
├── index-linden.png
├── index-almond.png
├── index-aspen.png
├── index-sequoia.png
├── index-luma.png
├── index-list.png
└── page.png
```

`config/settings_schema.json` 中的 `${lang}` 占位会被自动替换：

```json
"theme_thumb_url": "images/theme/${lang}/thumb.png",
"theme_preview_images": [
  "images/theme/${lang}/index.png",
  "images/theme/${lang}/index-mint.png",
  "images/theme/${lang}/index-maple.png",
  "images/theme/${lang}/index-palm.png",
  "images/theme/${lang}/index-willow.png",
  "images/theme/${lang}/index-linden.png",
  "images/theme/${lang}/index-almond.png",
  "images/theme/${lang}/index-aspen.png",
  "images/theme/${lang}/index-sequoia.png",
  "images/theme/${lang}/index-luma.png",
  "images/theme/${lang}/index-list.png",
  "images/theme/${lang}/page.png"
]
```

若某语言下缺图，Baklib 会回退到默认语言目录。首版会把同一张占位图复制为 9 个 theme 的预览，后续逐一替换为真实截图。

## 文档

- 主题使用说明：<https://help.baklib.cn/themes/docs>
- 设置项参考：<https://help.baklib.cn/themes/docs/settings>
- Baklib 模板开发指南：<https://dev.baklib.cn/guide/git>

## 许可

见 [LICENSE](LICENSE)（若本目录无 LICENSE 文件，请以父仓库为准）。
