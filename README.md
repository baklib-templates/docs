# Wiki Docs (`docs`)

English | [简体中文](README.zh-CN.md)

Baklib **Wiki** documentation theme (`theme_scope`: `wiki`, version **1.2.1**): product docs with sidebar navigation, in-page TOC, search, AI Q&A sidebar, page tools (including share-to-LLM), feedback, and Turbo-driven navigation—not a generic help-center or FAQ portal.

## Features

- **Three home layouts** — Classic, Tree docs, and Card docs (`index.liquid` / `index.tree.liquid` / `index.card.liquid`, `template_style` blank / `tree` / `card`); shared setting field IDs so admin data carries across variants
- **Unified article chrome** — `page.liquid` reuses the same layout family as the site home (blank / `tree` / `card`)
- **AI & search** — AI sidebar, search modal, configurable hot keywords and post-AI completion text
- **Seven locales** — Runtime UI (`*.json`) and theme-editor copy (`*.schema.json`)
- **Frontend stack** — Tailwind CSS 4, daisyUI, Stimulus, Alpine.js, Turbo (built from `src/` into `assets/`)

## Requirements

- Node.js (for `yarn build` / `yarn dev`)
- Baklib site on **Wiki** scope with this theme installed

## Project layout

| Path | Purpose |
| --- | --- |
| `config/settings_schema.json` | Theme metadata, global settings, preview image paths |
| `layout/` | Base layouts (`theme.liquid`, `error.liquid`) |
| `templates/` | Home variants, article page, feedback Turbo Streams, search |
| `snippets/` | Shared chrome; `index/` holds per-variant home & page shells and AI/feedback partials |
| `locales/` | Storefront strings (`*.json`) and editor labels (`*.schema.json`) |
| `src/` | Source CSS/JS (Tailwind CLI, esbuild) |
| `assets/` | Built stylesheets, scripts, and localized preview screenshots |
| `statics/` | Optional static Liquid endpoints |

## Templates

### Home

`templates/index.<variant>.liquid` — pick one as the site home template in Baklib.

| Template | Variant | At a glance |
| --- | --- | --- |
| `index.liquid` | Classic layout | Gradient hero, channel entry cards, recommended list; the safest default for product docs |
| `index.tree.liquid` | Tree docs layout | Hero, quick-guide cards, recommended list, and bottom help / feedback banner |
| `index.card.liquid` | Card docs layout | Left sidebar with logo, search, and site nav; outline cards and pill-style search |

**Home behavior:** set `home_page_path` to a site page path (e.g. `/docs/getting-started`) to show that page at `/`, or leave it empty to render the variant’s default home sections (hero, hot keywords, quick guide, etc.). Pages can join the home quick guide via **Show on home quick guide** in page settings.

Variant-specific markup lives under `snippets/index/<variant>/`. Shared pieces include `snippets/index/_ai_sidebar.liquid`, `_ai_chat_messages.liquid`, and home feedback modals.

### Article

`templates/page.liquid` — documentation content pages; layout follows `site.pages['/'].template_style` (blank, `tree`, or `card`).

### Other

| File | Role |
| --- | --- |
| `templates/search.liquid` | Reserved |
| `templates/feedback_*_turbo_stream.liquid` | Turbo Stream responses for in-page feedback |
| `statics/about.liquid` | Example static page |
| `statics/page/nav_tree.liquid` | Nav tree static endpoint |

## Locales

Shipped for storefront and schema:

`en` · `zh-CN` · `zh-TW` · `ko` · `ja` · `de` · `fr`

Edit `locales/<locale>.json` (UI) and `locales/<locale>.schema.json` (editor). Register new languages under `theme_info.theme_languages` in `config/settings_schema.json`.

## Build

```bash
yarn install
yarn build
```

Development (watch CSS/JS):

```bash
yarn dev
```

Optional live reload for Liquid/locale edits (Ruby + `guard-livereload` from `Gemfile`):

```bash
bundle install
yarn livereload
```

## Preview images

**Theme card thumbnail** (all languages):

```text
assets/images/theme/thumb-indigo.png
```

**Per-locale screenshots** — place under `assets/images/theme/<lang>/`:

```text
assets/images/theme/<lang>/
├── index.png
├── index-tree.png
├── index-card.png
├── page.png
└── page-ai.png
```

Configured in `config/settings_schema.json` (`theme_thumb_url`, `theme_preview_images`). The `${lang}` segment is resolved from the admin UI language. Missing files fall back to the site default language directory.

## Documentation

- Theme guide: <https://help.baklib.cn/themes/docs>
- Settings reference: <https://help.baklib.cn/themes/docs/settings>
- Template development: <https://dev.baklib.cn/guide/git>

## License

See [LICENSE](LICENSE) (or the parent repository if no `LICENSE` file is present).
