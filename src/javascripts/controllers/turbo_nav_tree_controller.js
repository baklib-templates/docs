// 结构为：
// <ul>
//  <li>
//    <div data-turbo-nav-tree-item>
//     item内容
//     <button>...</button>
//    </div>
//    <div data-turbo-nav-tree-children-container>
//     <ul>...</ul> (可选)
//     <turbo-frame>...</turbo-frame> (可选)
//    </div>
//  </li>
// </ul>

import { Controller } from "@hotwired/stimulus"
import Mustache from "mustache"

export default class extends Controller {
  static currentPathAttr = "data-turbo-nav-tree-current-path"

  static values = {
    navTree: Array,
    depth: Number,
    parentPath: String,
    url: String,
    currentPath: String,
    idPrefix: String,
    containerStyle: String,
    rootContainer: String, // 整个栏目树的容器是什么，class
    itemStyle: String,
    itemActiveClass: String,
    linkTurboFrame: String,
    linkTurboFrameAction: String,
    linkTurbo: Boolean, // 新增参数
    // expand: false | 0 — 仅路径相关展开；true | "all" — 全部展开；正整数 N — 展开 depth < N 的层级（0 起算）
    expand: { type: String, default: "false" },
  }

  static targets = [
    "itemTemplate" // item 模板
  ]

  connect() {
    this.menuContainer = this.rootContainer();
    if (!this.menuContainer) {
      console.log('turbo_nav_tree_controller: menuContainer null')
      return
    }

    if (!this.#getStoredCurrentPath()) {
      this.#setStoredCurrentPath(this.#initialCurrentPath())
    }

    if (this.element.dataset.rendered === "true") {
      return;
    }

    this.element.dataset.rendered = "true";
    this.itemTemplate = this.hasItemTemplateTarget ? this.itemTemplateTarget.innerHTML.trim() : null

    // 渲染导航树
    this.renderTree(this.navTreeValue, this.depthValue || 0, this.element)
  }

  disconnect() {
  }

  /** 去掉树上所有 [active]（含 li 与行容器），不触发导航 */
  #clearTreeActiveState() {
    this.menuContainer?.querySelectorAll("[active]").forEach((el) => {
      el.removeAttribute("active")
    })
  }

  /**
   * expand 配置：off | all | depth(N)
   * @returns {{ mode: 'off' | 'all' | 'depth', depth?: number }}
   */
  #expandConfig() {
    if (!this.hasExpandValue) return { mode: "off" }

    const raw = this.expandValue
    if (raw === true || raw === false) {
      return raw ? { mode: "all" } : { mode: "off" }
    }

    const v = String(raw).trim().toLowerCase()
    if (v === "" || v === "false" || v === "0" || v === "off") return { mode: "off" }
    if (v === "true" || v === "all" || v === "yes") return { mode: "all" }

    const n = Number.parseInt(v, 10)
    if (!Number.isNaN(n) && n > 0) return { mode: "depth", depth: n }

    return { mode: "off" }
  }

  /** 是否按 expand 规则在 depth 层默认展开（与当前 URL 路径无关） */
  #shouldExpandAtDepth(depth) {
    const cfg = this.#expandConfig()
    if (cfg.mode === "all") return true
    if (cfg.mode === "depth") return depth < cfg.depth
    return false
  }

  renderTree(nodes, depth, container) {
    if (container.rendered) return

    const ul = document.createElement("ul")
    ul.className = this.hasContainerStyleValue ? this.containerStyleValue : "w-full space-y-1"
    container.appendChild(ul)
    const showIconColumn = nodes.some((n) => this.#nodeHasIconUrl(n))
    nodes.forEach(node => {
      setTimeout(() => {
        const liDom = document.createElement("li")

        liDom.className = this.hasItemStyleValue ? this.itemStyleValue : ""

        // 是否在「当前 URL」的路径上（祖先或自身，用于展开分支、li[active]）
        const isOnPath = this.isPathActive(node)
        // 是否就是当前页（传给 Mustache 的 isActive，仅自定义模板使用；default 高亮靠 [active] + CSS）
        const isCurrent = this.isPathActive(node, false)
        // expand：可指定展开层数；路径上的分支始终展开
        const shouldOpen = this.#shouldExpandAtDepth(depth) || isOnPath || this.hasActiveChild(node)
        const useRenderChildren = node.children?.length > 0
        const useRenderTurboFrame = node.children?.length == 0 && node.children_count > 0 && this.hasUrlValue

        // --- item 内容 ---（Mustache 的 isActive 必须只对应当前页，不能与 expand 混用）
        const itemHtml = this.renderItem(node, depth, shouldOpen, isCurrent, showIconColumn)
        liDom.innerHTML = itemHtml
        const treeItem = liDom.children[0]
        treeItem.setAttribute('turbo-nav-tree-item', '')

        const childrenContainer = document.createElement("div")
        childrenContainer.setAttribute("turbo-nav-tree-children-container", "")
        childrenContainer.classList.add("transition-all", "duration-300")
        childrenContainer.hidden = !shouldOpen

        if (isOnPath) {
          liDom.setAttribute("active", "")
          if (isCurrent) {
            treeItem.setAttribute("active", "")
            requestAnimationFrame(() => {
              liDom.scrollIntoView({ behavior: "smooth", block: "center" })
            })
          }
        }

        // --- 有 children 数据，直接渲染 ---
        if (useRenderChildren) {
          this.renderTree(node.children, depth + 1, childrenContainer)
        }

        // --- 没有 children 数据，但 children_count > 0，使用 turbo-frame 懒加载 ---
        if (useRenderTurboFrame) {
          this.appendTurboFrame(childrenContainer, node, depth + 1, isOnPath)
        }

        liDom.appendChild(childrenContainer)
        ul.appendChild(liDom)
      }, 50)
    })

    container.rendered = true
  }

  // 懒加载 turbo-frame
  appendTurboFrame(container, node, depth, eager = false) {
    const tf = document.createElement("turbo-frame")
    tf.classList.add("w-full")
    const idPrefix = this.hasIdPrefixValue ? this.idPrefixValue : "nav_tree_frame_"
    tf.id = `${idPrefix}${node.path.replaceAll('/', '_')}`

    const urlBase = this.urlValue.split("?")[0]
    const params = new URLSearchParams()
    params.set("parent_path", node.path)
    params.set("depth", depth)
    const currentPath = this.#getCurrentPath()
    if (currentPath) {
      params.set("current_path", currentPath)
    }
    if (this.hasExpandValue) {
      params.set("expand", this.expandValue)
    }
    tf.src = `${urlBase}?${params.toString()}`
    tf.loading = eager ? "eager" : "lazy"

    tf.innerHTML = `
      <div class="flex items-center justify-center h-12 text-base-content/60">
        <span class="loading loading-spinner loading-sm"></span>
      </div>
    `
    container.appendChild(tf)
  }

  toggle(event) {
    // 行内链接点击会先走 #click 并展开；冒泡到外层时不要再用「当前 hidden」反折一遍，否则会把刚展开的面板关掉
    if (event.target?.closest?.("a[href]")) return

    const target = event.currentTarget
    let onlyOpen = false
    // 嵌套 click，外层收集toggle时，这时在内层不想点击关闭的元素上添加only-open属性
    if (target == event.target) {
      onlyOpen = event.params?.onlyOpen
    } else {
      onlyOpen = event.target.getAttribute('data-turbo-nav-tree-only-open-param') == 'true'
    }

    const li = target.closest("li")
    // 若点击的容器为a链接，在turbo时nav_tree不会重新加载，为了保持子项目一直展开就可以使用此属性
    // data-turbo-nav-tree-only-open-param="true"
    if (onlyOpen && li.hasAttribute('active')) return

    const childrenContainer = li.querySelector("[turbo-nav-tree-children-container]")
    this.treeContainerToggle(li, childrenContainer.hidden);
  }

  treeContainerToggle(li, status) {
    const childrenContainer = li.querySelector("[turbo-nav-tree-children-container]")
    if (!(childrenContainer && childrenContainer.children.length > 0)) return

    // 添加过渡动画
    if (status) {
      childrenContainer.hidden = false;
    } else {
      childrenContainer.hidden = true;
    }

    const itemTargetIcon = li.querySelector("[turbo-nav-tree-item-target-icon]");
    if (itemTargetIcon) {
      itemTargetIcon.classList.add("transition-transform", "duration-300", "peer-hover:text-primary");
      itemTargetIcon.classList.toggle("rotate-90", status);
    }
  }

  // 作用：点击 item 后，激活当前 item 和其所有祖先 item（高亮仅依赖 [active]，不依赖 Mustache 初次渲染）
  click(event) {
    const target = event.currentTarget
    this.#setStoredCurrentPath(this.#pathnameFromAnchor(target))

    const turboFrameTarget = target.getAttribute("data-turbo-frame")
    if (turboFrameTarget && turboFrameTarget !== "_top" && !document.getElementById(turboFrameTarget)) {
      // 当目标 frame 不存在时，降级为整页跳转，避免 Turbo frame mismatch 报错
      target.setAttribute("data-turbo-frame", "_top")
    }

    this.focusItem(target)
  }

  focusItem(target) {
    if (!this.menuContainer) return

    // 必须先清掉树上的 [active]：refreshActiveState 可能把「仅在外层分组 a 上」的链接交给本方法，此时没有 li，但仍要清树
    this.menuContainer.querySelectorAll("[active]").forEach((el) => {
      el.removeAttribute("active")
    })
    this.#clearTreeActiveState()

    const li = target.closest("li")
    if (!li) return

    this.getParents(target, "li", this.menuContainer).forEach((el) => {
      el.setAttribute("active", "")
    })

    li.querySelector("[turbo-nav-tree-item]")?.setAttribute("active", "")

    this.treeContainerToggle(li, true)
  }

  /** @param {string} path href 或 pathname */
  #normalizePathname(path) {
    if (path == null || path === "") return "/"
    try {
      const pathname = path.startsWith("http")
        ? new URL(path).pathname
        : path.startsWith("/")
          ? path
          : `/${path}`
      const trimmed = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
      return trimmed || "/"
    } catch {
      return "/"
    }
  }

  #pathnameFromAnchor(anchor) {
    return this.#normalizePathname(anchor?.getAttribute?.("href") || "")
  }

  #getStoredCurrentPath() {
    const container = this.menuContainer ?? this.rootContainer()
    if (!container) return null

    const stored = container.getAttribute(this.constructor.currentPathAttr)
    if (!stored?.trim()) return null
    return this.#normalizePathname(stored)
  }

  #setStoredCurrentPath(path) {
    const container = this.menuContainer ?? this.rootContainer()
    if (!container) return
    container.setAttribute(this.constructor.currentPathAttr, this.#normalizePathname(path))
  }

  /** 优先 rootContainer，其次 Liquid current_path，最后地址栏 */
  #initialCurrentPath() {
    const fromRoot = this.#getStoredCurrentPath()
    if (fromRoot) return fromRoot

    const fromValue = this.hasCurrentPathValue ? String(this.currentPathValue || "").trim() : ""
    if (fromValue) return this.#normalizePathname(fromValue)

    return this.#normalizePathname(window.location.pathname)
  }

  #getCurrentPath() {
    return this.#initialCurrentPath()
  }

  /** @param {Record<string, unknown>} node */
  #nodeIconUrl(node) {
    const s = node?.settings
    if (!s || typeof s !== "object") return ""
    const raw = /** @type {Record<string, unknown>} */ (s).icon
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : ""
  }

  /** @param {Record<string, unknown>} node */
  #nodeHasIconUrl(node) {
    return this.#nodeIconUrl(node).length > 0
  }

  /** @param {string} linkText */
  #parseMethodBadge(linkText) {
    if (!linkText || typeof linkText !== "string") return null
    const match = linkText.match(/^(GET|POST|PUT|PATCH|DELETE|DEL)\b\s*/i)
    if (!match) return null
    let type = match[1].toUpperCase()
    if (type === "DEL") type = "DELETE"
    return { type, title: linkText.slice(match[0].length).trim() || linkText }
  }

  // 单个 item 渲染；open：子级是否展开；isActive：是否为当前 URL 对应页（与 expand 无关）
  renderItem(node, depth, open = false, isActive = false, showIconColumn = false) {
    const hasChildren = this.hasUrlValue ? node.children_count : node.children?.length > 0

    // 动态拼接 a 标签属性
    let aAttrs = []
    if (this.hasLinkTurboFrameValue && this.linkTurboFrameValue) {
      aAttrs.push(`data-turbo-frame="${this.linkTurboFrameValue}"`)
    }
    if (this.hasLinkTurboFrameActionValue && this.linkTurboFrameActionValue) {
      aAttrs.push(`data-turbo-action="${this.linkTurboFrameActionValue}"`)
    }
    if (this.hasLinkTurboValue && this.linkTurboValue === false) {
      aAttrs = [`data-turbo="false"`]
    }

    let template = ""
    if (this.itemTemplate) {
      template = this.itemTemplate
    } else {
      template = `
        <div class="flex items-center">
          <a href="{{path}}"
            ${aAttrs.join(" ")}
            class="block hover:underline"
            style="padding-left: {{padding}}rem">
            {{link_text}}
          </a>
        </div>
      `
      if (hasChildren) {
        template = `
          <div class="flex items-center" data-action="click->turbo-nav-tree#toggle">
            <a href="{{path}}"
              ${aAttrs.join(" ")}
              class="block hover:underline"
              style="padding-left: {{padding}}rem">
              {{{link_text}}}
            </a>
            <!-- 有子节点时显示 toggle 按钮 -->
            <div turbo-nav-tree-item-target-icon class="inline-block ml-auto mr-1 ${open ? "rotate-90" : ""}">
              <svg class="w-4 h-4 text-primary/70 transition-transform duration-200"
                  fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </div>
          </div>
        `
      }
    }

    const methodBadge = this.#parseMethodBadge(node.link_text)
    const display_link_text = methodBadge?.title ?? node.link_text

    return Mustache.render(template, {
      ...node,
      depth,
      padding: depth * 1.25,
      hasChildren,
      open,
      isActive,
      show_icon_column: showIconColumn,
      show_nav_icon: showIconColumn && !methodBadge,
      icon_url: this.#nodeIconUrl(node),
      display_link_text,
      method_get: methodBadge?.type === "GET",
      method_post: methodBadge?.type === "POST",
      method_put: methodBadge?.type === "PUT",
      method_patch: methodBadge?.type === "PATCH",
      method_delete: methodBadge?.type === "DELETE",
    })
  }

  // 激活判断
  isPathActive(node, isPrefix = true) {
    const current = this.#getCurrentPath()
    const nodePath = this.#normalizePathname(node.path)
    if (!current) return false

    if (isPrefix) {
      const currentParts = current.split('/').filter(Boolean)
      const nodeParts = nodePath.split('/').filter(Boolean)

      if (nodeParts.length > currentParts.length) return false

      return nodeParts.every((part, idx) => currentParts[idx] === part)
    } else {
      return nodePath === current
    }
  }

  hasActiveChild(node) {
    if (!node.children || node.children.length === 0) return false
    return node.children.some(child => this.isPathActive(child) || this.hasActiveChild(child))
  }

  /**
   * 从元素向上查找所有符合 selector 的父级元素
   * @param {Element} el - 起始元素
   * @param {string} selector - 父元素选择器
   * @param {Element} [root=document.body] - 可选查找上限
   * @returns {Element[]} - 符合条件的父级元素数组，按从近到远顺序
  */
  getParents(el, selector, root = null) {
    if (!el) return [];
    const parents = [];
    let parent = el.parentElement;

    while (parent && parent !== root) {
      if (parent.matches(selector)) {
        parents.push(parent);
      }
      parent = parent.parentElement;
    }
    return parents;
  }

  rootContainer() {
    if (this.hasRootContainerValue) {
      return this.element.closest(this.rootContainerValue)
    } else {
      return this.getParents(this.element.querySelector('li'), 'ul')?.at(-1)
    }
  }
}
