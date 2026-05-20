import { Controller } from "@hotwired/stimulus";
import Mustache from "mustache";

/** 未提供 `<template data-toc-target="itemTemplate">` 时使用的默认片段（递归 partial 名固定为 `item`） */
const DEFAULT_ITEM_TEMPLATE = `
<li>
  <a
    href="#{{id}}"
    class="block py-[0.15rem] text-base-content/60 hover:text-base-content hover:underline"
    data-turbo="false"
    data-action="click->toc#navigateToAnchor"
    data-toc-anchor-param="{{id}}"
  >{{text}}</a>
  {{#hasChildren}}
  <ul class="mt-1 space-y-1 border-l border-base-200 pl-3">
    {{#children}}
      {{> item}}
    {{/children}}
  </ul>
  {{/hasChildren}}
</li>
`.trim();

/** 未提供 `<template data-toc-target="rootTemplate">` 时使用的默认根模板（`items` 为一级节点数组） */
const DEFAULT_ROOT_TEMPLATE = `
<nav
  class="border-l border-base-200 pl-4"
  data-toc-nav
  {{#ariaLabel}}aria-label="{{ariaLabel}}"{{/ariaLabel}}
>
  <ul class="space-y-2 text-base-content/60">
    {{#items}}
      {{> item}}
    {{/items}}
  </ul>
</nav>
`.trim();

export default class extends Controller {
  static targets = ["links", "content", "menu", "rootTemplate", "itemTemplate"];
  static values = {
    headerSelector: String,
    offset: Number,
    clipboardSuccess: String,
    title: { type: String, default: "" },
  };

  connect() {
    const validOptions = this.hasContentTarget && this.hasLinksTarget && this.hasMenuTarget;
    if (!validOptions) {
      if (this.hasMenuTarget) this.menuTarget.remove();
      return;
    }

    this.#generateDirectory();

    const anchor = window.location.hash.replace("#", "");
    const targetElement = document.getElementById(anchor);
    targetElement?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  disconnect() {
    if (this.scrollListener) {
      window.removeEventListener("scroll", this.scrollListener);
      this.scrollListener = null;
    }
    if (this.hightLightTimer) clearTimeout(this.hightLightTimer);
  }

  #setTempNode(node) {
    node.setAttribute("data-toc-temp", "");
  }

  #clearTempNode() {
    this.element.querySelectorAll("[data-toc-temp]").forEach((el) => el.remove());
    this.linksTarget.replaceChildren();
  }

  #generateDirectory() {
    this.#clearTempNode();
    const directory = this.#buildDirectoryTree(this.headings);
    if (directory.children.length > 0) {
      this.#renderTocWithMustache(directory);
      this.#attachClipboardToHeadings(directory);
      this.scrollListener = () => this.#hightLightActiveLink();
      window.addEventListener("scroll", this.scrollListener, { passive: true });
      this.#hightLightActiveLink();
      this.element.classList.add("has-toc");
    } else {
      this.element.classList.remove("has-toc");
      this.menuTarget.style.display = "none";
    }
  }

  #itemTemplateSource() {
    if (this.hasItemTemplateTarget) {
      return this.itemTemplateTarget.innerHTML.trim();
    }
    return DEFAULT_ITEM_TEMPLATE;
  }

  #rootTemplateSource() {
    if (this.hasRootTemplateTarget) {
      return this.rootTemplateTarget.innerHTML.trim();
    }
    return DEFAULT_ROOT_TEMPLATE;
  }

  // 生成目录树
  // { level: 0, children: [ {level: 1, id: '', text: '', children: [], parent: []} ] }
  #buildDirectoryTree(headings) {
    const root = { level: 0, children: [] };

    let currentNode = root;

    headings.forEach((heading, index) => {
      if (heading.textContent.trim() === "") {
        return;
      }

      const level = parseInt(heading.tagName.substr(1), 10);
      const id = this.#generateUniqueId(heading, level, index);
      heading.style.position = "relative";
      const top = this.headerHeight + Number(this.offsetValue);

      const posDiv = document.createElement("div");
      posDiv.setAttribute("js-position", "");
      posDiv.style.position = "absolute";
      posDiv.style.top = `-${top}px`;
      posDiv.style.left = "0";
      posDiv.style.width = "0";
      posDiv.style.height = "0";
      posDiv.id = id;
      heading.appendChild(posDiv);
      this.#setTempNode(posDiv);

      const anchorEl = document.createElement("a");
      anchorEl.name = id;
      heading.appendChild(anchorEl);
      this.#setTempNode(anchorEl);

      const node = { level, id, text: heading.textContent.trim(), children: [] };

      if (level > currentNode.level) {
        currentNode.children.push(node);
      } else {
        while (level <= currentNode.level && currentNode !== root) {
          currentNode = currentNode.parent;
        }
        currentNode.children.push(node);
      }

      node.parent = currentNode;
      currentNode = node;
    });

    return root;
  }

  #serializeNode(node) {
    return {
      id: node.id,
      text: node.text,
      level: node.level,
      hasChildren: node.children.length > 0,
      children: node.children.map((c) => this.#serializeNode(c)),
    };
  }

  #renderTocWithMustache(directory) {
    const rootTpl = this.#rootTemplateSource();
    const itemTpl = this.#itemTemplateSource();
    const view = {
      items: directory.children.map((n) => this.#serializeNode(n)),
    };
    if (this.titleValue) {
      view.ariaLabel = this.titleValue;
    }
    const html = Mustache.render(rootTpl, view, { item: itemTpl });
    this.linksTarget.innerHTML = html;
  }

  #walkDirectoryNodes(nodes, fn) {
    nodes.forEach((node) => {
      fn(node);
      if (node.children.length > 0) {
        this.#walkDirectoryNodes(node.children, fn);
      }
    });
  }

  #attachClipboardToHeadings(directory) {
    this.#walkDirectoryNodes(directory.children, (node) => {
      const heading_pos = document.getElementById(node.id);
      if (!heading_pos) return;

      const heading = heading_pos.parentElement;
      if (!heading) return;

      heading.style.position = "relative";
      heading.classList.add("group");

      const clipboardDiv = document.createElement("span");
      clipboardDiv.className = "inline-flex items-center align-middle ml-1";
      clipboardDiv.setAttribute("data-controller", "clipboard");
      clipboardDiv.setAttribute("data-clipboard-success-value", this.clipboardSuccessValue);
      clipboardDiv.style.verticalAlign = "middle";

      const linkUrl = `${window.location.href.split("#")[0]}#${node.id}`;

      const htmlStr = `
        <input type="hidden" value="${linkUrl.replace(/"/g, "&quot;")}" data-clipboard-target="source" />
        <button type="button" data-action="clipboard#copy" data-clipboard-target="button" class="inline-flex ml-1 opacity-0 group-hover:opacity-100">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/30 group-hover:text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
      `;

      clipboardDiv.innerHTML = htmlStr;
      this.#setTempNode(clipboardDiv);
      heading.appendChild(clipboardDiv);

      const lastTextNode = Array.from(heading.childNodes)
        .filter(
          (n) =>
            n.nodeType === Node.TEXT_NODE ||
            (n.nodeType === Node.ELEMENT_NODE &&
              !n.hasAttribute("data-controller") &&
              !n.hasAttribute("js-position")),
        )
        .pop();

      if (lastTextNode) {
        if (lastTextNode.nextSibling) {
          heading.insertBefore(clipboardDiv, lastTextNode.nextSibling);
        }
      }
    });
  }

  #generateUniqueId(node, level, index) {
    return node.id || `heading-menu-h${level}-${index}`;
  }

  #hightLightActiveLink() {
    if (this.hightLightTimer) {
      clearTimeout(this.hightLightTimer);
    }
    this.hightLightTimer = setTimeout(() => {
      const links = Array.from(this.linksTarget.querySelectorAll("[data-toc-anchor-param]"));
      let activeLink = null;

      for (let i = 0; i < this.headings.length; i++) {
        const heading = this.headings[i];

        const link = links.find(
          (l) => l.dataset.tocAnchorParam === heading.querySelector("[js-position]")?.id,
        );

        if (link && this.isHeadingInView(heading)) {
          activeLink = link;
          break;
        }
      }

      links.forEach((link) => link.classList.remove("is-toc-active"));
      if (activeLink) {
        activeLink.classList.add("is-toc-active");
        activeLink.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }, 1);
  }

  isHeadingInView(heading) {
    const bounding = heading.getBoundingClientRect();

    return (
      bounding.top >= this.headerHeight &&
      bounding.left >= 0 &&
      bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  navigateToAnchor(event) {
    if (typeof event?.preventDefault === "function") {
      event.preventDefault();
    }
    const { anchor } = event.params;
    const targetElement = document.getElementById(anchor);

    if (targetElement) {
      const headerHeight = this.headerHeight;
      const targetPosition = targetElement.getBoundingClientRect().top;
      const scrollToPosition = targetPosition - headerHeight;

      const scrollOptions = {
        top: scrollToPosition,
        behavior: "smooth",
      };

      window.scrollBy(0, -headerHeight);
      window.scrollBy(scrollOptions);
    }
  }

  get headings() {
    return Array.from(this.contentTarget.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  }

  get headerHeight() {
    if (!this.hasHeaderSelectorValue || !this.headerSelectorValue) {
      return 0;
    }

    const header = document.querySelector(this.headerSelectorValue);
    if (!header) {
      return 0;
    }
    return header.offsetHeight;
  }
}
