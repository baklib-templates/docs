# 纷享销客帮助中心 JSON-LD 结构说明

参考站点：<https://help.fxiaoke.com/>

站点形态：**门户首页** + **短 ID 栏目页**（如 `/5df3`、`/382a`）+ **子文档/指南**；另含常见问题、术语词典、开发者手册、更新日志等模块。

下文为各页面类型的 **Schema.org JSON-LD** 通用骨架，便于按页面数据动态填充后输出到 `<script type="application/ld+json">`（推荐单脚本内用 `@graph` 合并多块）。

---

## 全站通用块（建议多数内页附带）

用于品牌与站点级实体，便于搜索引擎理解发布方与站点关系。

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "{{ site_url }}#organization",
      "name": "{{ organization_name }}",
      "url": "{{ organization_url }}",
      "logo": { "@type": "ImageObject", "url": "{{ logo_url }}" },
      "sameAs": ["{{ official_social_or_wiki_urls }}"]
    },
    {
      "@type": "WebSite",
      "@id": "{{ site_url }}#website",
      "url": "{{ site_url }}",
      "name": "{{ site_name }}",
      "publisher": { "@id": "{{ site_url }}#organization" },
      "inLanguage": "zh-CN"
    }
  ]
}
```

---

## 1. 首页

在通用块上增加首页 `WebPage`；若存在固定站内搜索 URL，可增加 `SearchAction`。

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@id": "{{ site_url }}#organization", "...": "同「全站通用块」中的 Organization" },
    {
      "@id": "{{ site_url }}#website",
      "...": "同「全站通用块」中的 WebSite",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "{{ site_url }}/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "WebPage",
      "@id": "{{ page_canonical_url }}#webpage",
      "url": "{{ page_canonical_url }}",
      "name": "{{ page_title }}",
      "description": "{{ page_description }}",
      "isPartOf": { "@id": "{{ site_url }}#website" },
      "about": { "@id": "{{ site_url }}#organization" },
      "inLanguage": "zh-CN"
    }
  ]
}
```

无独立搜索页时删除 `potentialAction`。

---

## 2. 栏目 / 分类页（汇总子主题的列表页）

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@id": "{{ site_url }}#organization", "...": "…" },
    { "@id": "{{ site_url }}#website", "...": "…" },
    {
      "@type": "CollectionPage",
      "@id": "{{ page_canonical_url }}#webpage",
      "url": "{{ page_canonical_url }}",
      "name": "{{ section_title }}",
      "description": "{{ section_description }}",
      "isPartOf": { "@id": "{{ site_url }}#website" },
      "breadcrumb": { "@id": "{{ page_canonical_url }}#breadcrumb" },
      "inLanguage": "zh-CN",
      "hasPart": {
        "@type": "ItemList",
        "@id": "{{ page_canonical_url }}#itemlist",
        "numberOfItems": "{{ children_count }}",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "{{ child_title }}",
            "url": "{{ child_url }}"
          }
        ]
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "{{ page_canonical_url }}#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "首页", "item": "{{ site_url }}" },
        { "@type": "ListItem", "position": 2, "name": "{{ parent_section_title }}", "item": "{{ parent_section_url }}" },
        { "@type": "ListItem", "position": 3, "name": "{{ section_title }}", "item": "{{ page_canonical_url }}" }
      ]
    }
  ]
}
```

层级不足时删减中间 `ListItem`；`numberOfItems` 输出为数字类型。

---

## 3. 帮助文档 / 单篇正文页

偏产品帮助文档时使用 `TechArticle`；偏公告类可用 `Article`。

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@id": "{{ site_url }}#organization", "...": "…" },
    { "@id": "{{ site_url }}#website", "...": "…" },
    {
      "@type": "TechArticle",
      "@id": "{{ page_canonical_url }}#article",
      "headline": "{{ article_title }}",
      "description": "{{ article_description }}",
      "url": "{{ page_canonical_url }}",
      "inLanguage": "zh-CN",
      "isPartOf": { "@id": "{{ site_url }}#website" },
      "author": { "@type": "Organization", "name": "{{ organization_name }}" },
      "publisher": { "@id": "{{ site_url }}#organization" },
      "datePublished": "{{ iso8601_published }}",
      "dateModified": "{{ iso8601_modified }}",
      "articleSection": "{{ section_name }}",
      "keywords": ["{{ keyword_1 }}", "{{ keyword_2 }}"],
      "breadcrumb": { "@id": "{{ page_canonical_url }}#breadcrumb" },
      "mainEntityOfPage": { "@id": "{{ page_canonical_url }}#webpage" }
    },
    {
      "@type": "WebPage",
      "@id": "{{ page_canonical_url }}#webpage",
      "url": "{{ page_canonical_url }}",
      "name": "{{ article_title }}",
      "isPartOf": { "@id": "{{ site_url }}#website" },
      "primaryImageOfPage": {
        "@type": "ImageObject",
        "url": "{{ hero_or_og_image_url }}"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "{{ page_canonical_url }}#breadcrumb",
      "itemListElement": []
    }
  ]
}
```

无头图时删除 `primaryImageOfPage`。

---

## 4. FAQ 页（页内多问答）

仅当页面上真实展示对应问答时使用。

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@id": "{{ site_url }}#organization", "...": "…" },
    {
      "@type": "FAQPage",
      "@id": "{{ page_canonical_url }}#faqpage",
      "url": "{{ page_canonical_url }}",
      "name": "{{ page_title }}",
      "breadcrumb": { "@id": "{{ page_canonical_url }}#breadcrumb" },
      "mainEntity": [
        {
          "@type": "Question",
          "name": "{{ q1_title }}",
          "acceptedAnswer": { "@type": "Answer", "text": "{{ q1_plain_text_or_html }}" }
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "@id": "{{ page_canonical_url }}#breadcrumb",
      "itemListElement": []
    }
  ]
}
```

---

## 5. 术语词典（单词条页）

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "DefinedTerm",
      "@id": "{{ page_canonical_url }}#term",
      "name": "{{ term_name }}",
      "description": "{{ term_definition_plain }}",
      "url": "{{ page_canonical_url }}",
      "inDefinedTermSet": {
        "@type": "DefinedTermSet",
        "name": "术语词典",
        "url": "{{ glossary_index_url }}"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "{{ page_canonical_url }}#breadcrumb",
      "itemListElement": []
    }
  ]
}
```

多词索引页可用 `CollectionPage` + `ItemList`（同栏目页模式）。

---

## 6. 更新日志 / 单条版本说明

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "{{ page_canonical_url }}#release",
      "headline": "{{ version_title }}",
      "url": "{{ page_canonical_url }}",
      "datePublished": "{{ release_date }}",
      "articleSection": "更新日志",
      "publisher": { "@id": "{{ site_url }}#organization" }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "{{ page_canonical_url }}#breadcrumb",
      "itemListElement": []
    }
  ]
}
```

版本列表索引页仍可用「栏目页」的 `CollectionPage` + `ItemList`。

---

## 7. 开发者手册 / API 文档页

与正文页类似，以 `TechArticle` 为主；可选 `about` 指向技术主题或文档枢纽 URL。

```json
"about": { "@type": "Thing", "name": "Open API", "url": "{{ dev_hub_url }}" }
```

---

## 实施约定速查

| 项目 | 说明 |
|------|------|
| `@id` | 全站唯一，常用 `{canonical}#webpage`、`#article`、`#breadcrumb` 等后缀 |
| `url` | 与页面 canonical 一致 |
| `BreadcrumbList` | 与页面可见面包屑一致 |
| `FAQPage` | 勿堆砌与页面内容不符的问答 |
| `dateModified` | CMS 有则填 ISO 8601 |
| 输出方式 | 多类型合并为单个 `@graph`，减少重复引用 |

---

*文档根据对 help.fxiaoke.com 的公开页面结构整理，具体 URL 与搜索参数以实际站点为准。*
