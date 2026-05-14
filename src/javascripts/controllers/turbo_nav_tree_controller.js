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
    expand: { type: Boolean, default: false } // 是否默认展开下级
  }

  static targets = [
    "itemTemplate" // item 模板
  ]

  connect() {
    this.currentPath = this.#normalizePathname(
      this.hasCurrentPathValue ? this.currentPathValue : window.location.pathname,
    )
    this.menuContainer = this.rootContainer();
    if (!this.menuContainer) {
      console.log('turbo_nav_tree_controller: menuContainer null')
      return
    }

    this.boundSyncNavFromUrl = () => {
      if (!this.element?.isConnected || !this.menuContainer) return
      this.refreshActiveState()
    }
    document.addEventListener("turbo:load", this.boundSyncNavFromUrl)
    document.addEventListener("turbo:frame-load", this.boundSyncNavFromUrl)

    if (this.element.dataset.rendered === "true") {
      this.refreshActiveState();
      return;
    }

    this.element.dataset.rendered = "true";
    this.itemTemplate = this.hasItemTemplateTarget ? this.itemTemplateTarget.innerHTML.trim() : null

    // 渲染导航树
    this.renderTree(this.navTreeValue, this.depthValue || 0, this.element)
  }

  disconnect() {
    if (this.boundSyncNavFromUrl) {
      document.removeEventListener("turbo:load", this.boundSyncNavFromUrl)
      document.removeEventListener("turbo:frame-load", this.boundSyncNavFromUrl)
    }
  }

  /** 与当前地址栏同步高亮（模板不会重跑 Mustache，只靠 [active] + CSS） */
  refreshActiveState = () => {
    if (!this.menuContainer) return
    this.#syncCurrentPathFromWindow()

    const current = this.#normalizePathname(this.currentPath)
    const links = this.menuContainer.querySelectorAll("a[href]")
    let aDom = null
    for (const a of links) {
      if (this.#normalizePathname(a.getAttribute("href")) === current) {
        aDom = a
        break
      }
    }
    if (!aDom) return

    this.menuContainer.querySelectorAll('li[active]').forEach((li) => {
      li.querySelector("[turbo-nav-tree-children-container]")?.classList.remove('opacity-0')
    });

    this.getParents(aDom, "li", this.menuContainer).forEach((li) => {
      this.treeContainerToggle(li, true);
    });
    this.click({ currentTarget: aDom });
  };

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
        // 是否就是当前页（传给 Mustache 的 isActive，仅自定义模板使用；mint 高亮靠 [active] + CSS）
        const isCurrent = this.isPathActive(node, false)
        // expand：默认展开有子级的节点；路径上的分支也应展开
        const shouldOpen = this.expandValue || isOnPath || this.hasActiveChild(node)
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
          this.appendTurboFrame(childrenContainer, node, depth + 1)
        }

        liDom.appendChild(childrenContainer)
        ul.appendChild(liDom)
      }, 50)
    })

    container.rendered = true
  }

  // 懒加载 turbo-frame
  appendTurboFrame(container, node, depth) {
    const tf = document.createElement("turbo-frame")
    tf.classList.add("w-full")
    const idPrefix = this.hasIdPrefixValue ? this.idPrefixValue : "nav_tree_frame_"
    tf.id = `${idPrefix}${node.path.replaceAll('/', '_')}`

    const urlBase = this.urlValue.split("?")[0]
    const params = new URLSearchParams()
    params.set("parent_path", node.path)
    params.set("depth", depth)
    tf.src = `${urlBase}?${params.toString()}`
    tf.loading = "lazy"

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
      childrenContainer.classList.remove("opacity-0");
    } else {
      childrenContainer.hidden = true;
      childrenContainer.classList.add("opacity-0");
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
    this.currentPath = this.#pathnameFromAnchor(target)

    const turboFrameTarget = target.getAttribute("data-turbo-frame")
    if (turboFrameTarget && turboFrameTarget !== "_top" && !document.getElementById(turboFrameTarget)) {
      // 当目标 frame 不存在时，降级为整页跳转，避免 Turbo frame mismatch 报错
      target.setAttribute("data-turbo-frame", "_top")
    }

    const li = target.closest("li")
    if (!li || !this.menuContainer) return

    this.menuContainer.querySelectorAll('[active]').forEach(el => {
      el.removeAttribute('active');
    })

    this.getParents(target, 'li', this.menuContainer).forEach(el => {
      el.setAttribute('active', '');
    })

    li.querySelector('[turbo-nav-tree-item]')?.setAttribute('active', '')

    this.treeContainerToggle(li, true);
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

  #syncCurrentPathFromWindow() {
    this.currentPath = this.#normalizePathname(window.location.pathname)
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

    return Mustache.render(template, {
      ...node,
      depth,
      padding: depth * 1.25,
      hasChildren,
      open,
      isActive,
      show_icon_column: showIconColumn,
      icon_url: this.#nodeIconUrl(node),
    })
  }

  // 激活判断
  isPathActive(node, isPrefix = true) {
    const current = this.#normalizePathname(this.currentPath)
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
