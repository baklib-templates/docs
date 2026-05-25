# Wiki Docs (`docs`)

English | [简体中文](README.zh-CN.md)

Baklib **Wiki** theme focused on **product documentation** (Mintlify-inspired): a docs-first layout with sidebar navigation, in-page TOC, search, AI-assisted answers, share-to-LLM tools, and Turbo-powered navigation—not a generic support or FAQ portal.

## Requirements

- Node.js (for asset builds)
- Baklib site using the **Wiki** scope with this theme installed (`theme_scope`: `wiki` in `config/settings_schema.json`)

## Repository layout

| Path                          | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `config/settings_schema.json` | Theme metadata, languages, and editor settings                          |
| `layout/`                     | Base layouts                                                            |
| `templates/`                  | Page templates (9 Mintlify-inspired home variants, directory list, article page, search, tag, video, export, …) |
| `snippets/`                   | Partials (header, footer, sidebar, page tools, feedback, `index_themes/*`, …) |
| `locales/`                    | Runtime UI strings (`*.json`) and theme-editor labels (`*.schema.json`) |
| `src/`                        | Source CSS/JS (Tailwind, esbuild)                                       |
| `assets/`                     | Compiled stylesheets, scripts, and theme preview images                 |
| `statics/`                    | Static custom HTML examples                                             |

## Home templates (Mintlify-inspired)

`templates/index.<theme>.liquid` provides nine home-page variants modelled after [Mintlify themes](https://www.mintlify.com/docs/customize/themes). They share the same field IDs (so admin data carries over) and only differ in layout density, hero shape, and decorative backdrop driven by the `.theme-<name>` marker class in [`src/stylesheets/themes.css`](src/stylesheets/themes.css).

| Template              | Variant       | At a glance                                                                                  |
| --------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `index.mint.liquid`   | Mint          | Classic 3-column gradient cards; the safest default and the spiritual successor to `index.docs`. |
| `index.maple.liquid`  | Maple         | Outline cards + pill search, geared toward AI/SaaS docs.                                     |
| `index.palm.liquid`   | Palm          | Sober mesh background, serif headings, 2-column enterprise feel.                             |
| `index.willow.liquid` | Willow        | Distraction-free; plain text cards, no decoration, latest/hottest off by default.            |
| `index.linden.liquid` | Linden        | Retro terminal: monospace + grid backdrop + dashed borders.                                  |
| `index.almond.liquid` | Almond        | Warm gradient with rounded cards; all sections enabled.                                      |
| `index.aspen.liquid`  | Aspen         | Contour-line backdrop, 4-tile getting-started grid for SDK references.                       |
| `index.sequoia.liquid`| Sequoia       | Spacious 4-column grid for large-scale API and platform docs.                                |
| `index.luma.liquid`   | Luma          | Lightest variant: minimal decoration, 2-column flat cards.                                   |

Shared partials live in [`snippets/index_themes/`](snippets/index_themes/) (`_decoration`, `_hero_search`, `_channels_grid`, `_topic_grid`, `_recent_list`, `_hottest_list`, `_features_html`). Add a new variant by creating one more `index.<theme>.liquid` that renders the same partials with different parameters and a `.theme-<theme>` wrapper class.

## Supported locales

Runtime translations and theme-editor (schema) translations ship for:

- `en`, `zh-CN`, `zh-TW`, `ko`, `ja`, `de`, `fr`

Add or edit keys in `locales/<locale>.json` (UI) and `locales/<locale>.schema.json` (theme-editor labels). When introducing a new locale, register it under `theme_info.theme_languages` in [`config/settings_schema.json`](config/settings_schema.json).

## Build assets

```bash
yarn install
yarn build
```

During development:

```bash
yarn dev
```

Optional live reload (requires Ruby + livereload browser extension):

```bash
bundle install
bundle exec guard
```

## Per-language preview images

The theme card and screenshots in the Baklib admin are resolved by language. Drop localized previews into `assets/images/theme/<lang>/` so admins see them in their UI language:

```text
assets/images/theme/<lang>/
├── thumb.png            # theme card thumbnail
├── index.png            # primary preview
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

The `${lang}` placeholder used in `config/settings_schema.json` is resolved automatically:

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

> Initial commit ships the same placeholder image for every theme; replace each `index-<theme>.png` with a real screenshot when ready.

If a localized image is missing, Baklib falls back to the default language directory.

## Documentation

- Theme guide: <https://help.baklib.cn/themes/docs>
- Settings reference: <https://help.baklib.cn/themes/docs/settings>
- Baklib template development guide: <https://dev.baklib.cn/guide/git>

## License

See [LICENSE](LICENSE) (or the parent repository if no `LICENSE` file is present).
