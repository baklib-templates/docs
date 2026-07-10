import { Controller } from "@hotwired/stimulus";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import markedFootnote from "marked-footnote";
import markedKatex from "marked-katex-extension";
import katex from "katex";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import python from "highlight.js/lib/languages/python";
import plaintext from "highlight.js/lib/languages/plaintext";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("python", python);
hljs.registerLanguage("plaintext", plaintext);

const baseRenderer = new marked.Renderer();
const highlightedCodeRenderer = baseRenderer.code.bind(baseRenderer);
const encodeDataValue = (value = "") => encodeURIComponent(value);

marked.setOptions({
  renderer: baseRenderer,
  gfm: true,
  breaks: true,
});

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    emptyLangClass: "hljs language-plaintext",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

marked.use(markedFootnote());
marked.use(markedKatex({ throwOnError: false, nonStandard: true, strict: true }));

marked.use({
  walkTokens(token) {
    if (token.type !== "code") return;
    if (token.lang && !hljs.getLanguage(token.lang)) {
      token.lang = "plaintext";
      return;
    }
    if (!token.lang) {
      token.lang = hljs.highlightAuto(token.text).language || "plaintext";
    }
  },
  renderer: {
    link({ href, title, text }) {
      if (!href || href.startsWith("javascript:") || href.startsWith("data:")) {
        return text;
      }
      const titleAttr = title ? ` title="${title}"` : "";
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    },
    code(codeToken) {
      const { text, lang } = codeToken;
      if (lang === "mermaid") {
        return `<div class="mermaid">${text}</div>`;
      }
      const highlighted = highlightedCodeRenderer(text, lang, codeToken.escaped);
      const label = lang ? String(lang).slice(0, 16) : "Plain Text";
      return `<div class="code-block">
        <div class="code-block__header">
          <span class="code-block__language">${label}</span>
          <button
            type="button"
            class="btn btn-ghost btn-xs gap-1 code-copy-btn"
            data-controller="copy-button"
            data-action="click->copy-button#copy"
            data-copy-button-content-value="${encodeDataValue(text)}"
            data-copy-button-copy-label-value="复制"
            data-copy-button-copied-label-value="已复制"
            data-copy-button-error-label-value="复制失败"
            aria-label="复制代码"
          >
            <i class="ri-file-copy-line text-base"></i>
            <span class="code-copy-btn__label">复制</span>
          </button>
        </div>
        <div class="code-block__content">${highlighted}</div>
      </div>`;
    },
    table(tableToken) {
      let headerHtml = "";
      for (let i = 0; i < tableToken.header.length; i += 1) {
        const cell = tableToken.header[i];
        const content = this.parser.parseInline(cell.tokens);
        const align = cell.align ? ` align="${cell.align}"` : "";
        headerHtml += `<th${align}>${content}</th>`;
      }

      let bodyHtml = "";
      for (let i = 0; i < tableToken.rows.length; i += 1) {
        const row = tableToken.rows[i];
        let rowHtml = "";
        for (let j = 0; j < row.length; j += 1) {
          const cell = row[j];
          const content = this.parser.parseInline(cell.tokens);
          const align = cell.align ? ` align="${cell.align}"` : "";
          rowHtml += `<td${align}>${content}</td>`;
        }
        bodyHtml += `<tr>${rowHtml}</tr>`;
      }

      return `<div class="table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
    },
  },
});

export default class extends Controller {
  static targets = ["content", "renderedContent"];

  connect() {
    // Skip empty sources: AI assistant bubbles pre-fill renderedContent with a
    // thinking/reading status before markdown source is available.
    const source = this.hasContentTarget
      ? this.contentTarget.textContent
      : this.element.textContent;
    if ((source || "").trim()) {
      this.renderContent();
    }
  }

  contentTargetConnected(element) {
    element.markdownObserver = new MutationObserver(() => this.renderContent());
    element.markdownObserver.observe(element, { childList: true, subtree: true });
  }

  contentTargetDisconnected(element) {
    element.markdownObserver?.disconnect();
  }

  renderContent() {
    if (this.rendering) return;
    this.rendering = true;
    const source = this.hasContentTarget ? this.contentTarget.textContent : this.element.textContent;
    const html = marked.parse(source || "");

    if (this.hasRenderedContentTarget) {
      this.renderedContentTarget.innerHTML = html;
    } else {
      this.element.innerHTML = html;
    }
    this.rendering = false;
  }
}
