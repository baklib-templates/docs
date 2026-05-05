import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["links", "content", "menu"];
  static values = {
    headerSelector: String,
    offset: Number,
    clipboardSuccess: String,
  };

  connect() {
    const validOptions = this.hasContentTarget && this.hasLinksTarget && this.hasMenuTarget;
    if (!validOptions) {
      if (this.hasMenuTarget) this.menuTarget.remove();
      return
    }

    this.#generateDirectory();

    const anchor = window.location.hash.replace('#', '');
    const targetElement = document.getElementById(anchor);
    targetElement?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  disconnect() {
    window.removeEventListener("scroll", this.#hightLightActiveLink.bind(this));

    if (this.hightLightTimer) clearTimeout(this.hightLightTimer);
  }

  #setTempNode(node) {
    node.setAttribute("data-toc-temp", '');
  }

  #clearTempNode() {
    this.element.querySelectorAll('[data-toc-temp]').forEach((el) => el.remove());
    this.linksTarget.replaceChildren();
  }

  #generateDirectory() {
    this.#clearTempNode()
    const directory = this.#buildDirectoryTree(this.headings);
    if (directory.children.length > 0) {
      this.#renderDirectory(directory, this.linksTarget);
      window.addEventListener("scroll", this.#hightLightActiveLink.bind(this));
      this.#hightLightActiveLink();
      this.element.classList.add("has-toc");
    } else {
      this.element.classList.remove("has-toc");
      this.menuTarget.style.display = 'none'
    }
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
      // heading.id = id;
      heading.style.position = "relative";
      // 解决锚点定位的问题（顶部为sticky时）
      const top = this.headerHeight + Number(this.offsetValue);

      // 创建用于定位的占位元素，并记录以便 later cleanup
      const posDiv = document.createElement('div');
      posDiv.setAttribute('js-position', '');
      posDiv.style.position = 'absolute';
      posDiv.style.top = `-${top}px`;
      posDiv.style.left = '0';
      posDiv.style.width = '0';
      posDiv.style.height = '0';
      posDiv.id = id;
      heading.appendChild(posDiv);
      this.#setTempNode(posDiv);

      // 创建命名锚点
      const anchorEl = document.createElement('a');
      anchorEl.name = id;
      heading.appendChild(anchorEl);
      this.#setTempNode(anchorEl);

      const node = { level, id, text: heading.textContent, children: [] };

      if (level > currentNode.level) {
        // 该节点是currentNode的子节点
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

  // 生成目录, 插入到页面
  #renderDirectory(directory, container, level = 0) {
    if (directory.children.length == 0) {
      return;
    }

    const ul = document.createElement("ul");

    // 创建dom元素
    directory.children.forEach((node) => {
      const li = document.createElement("li");
      const link = document.createElement("button");
      link.type = "button";
      link.textContent = node.text;
      link.dataset.action = "toc#navigateToAnchor";
      link.dataset.tocAnchorParam = node.id;

      li.appendChild(link);
      ul.appendChild(li);

      // 获取定位的节点
      const heading_pos = document.getElementById(node.id);
      if (!heading_pos) return;

      const heading = heading_pos.parentElement;
      if (!heading) return;

      // 保存原始内容并设置相对定位以便放置复制按钮
      heading.style.position = "relative";
      heading.classList.add('group');

      // 创建复制按钮容器
      const clipboardDiv = document.createElement('span');
      clipboardDiv.className = "inline-flex items-center align-middle ml-1";
      clipboardDiv.setAttribute('data-controller', 'clipboard');
      clipboardDiv.setAttribute('data-clipboard-success-value', this.clipboardSuccessValue);
      clipboardDiv.style.verticalAlign = "middle";

      const htmlStr = `
        <input type="hidden" value="${window.location.href.split('#')[0]}#${node.id}" data-clipboard-target="source" />
        <button type="button" data-action="clipboard#copy" data-clipboard-target="button" class="inline-flex ml-1 opacity-0 group-hover:opacity-100">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300 group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
      `;

      clipboardDiv.innerHTML = htmlStr;

      // 记录复制容器（其内部的 input/button 会随着容器一起被移除）
      this.#setTempNode(clipboardDiv);

      // 在最后一个子元素之后添加复制按钮
      // 这样可以确保按钮跟随文本，无论标题有多少行
      heading.appendChild(clipboardDiv);

      // 调整复制按钮与文本的对齐方式
      const lastTextNode = Array.from(heading.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE ||
          (node.nodeType === Node.ELEMENT_NODE &&
            !node.hasAttribute('data-controller') &&
            !node.hasAttribute('js-position')))
        .pop();

      if (lastTextNode) {
        // 如果找到了最后一个文本节点，将复制按钮移至其后
        if (lastTextNode.nextSibling) {
          heading.insertBefore(clipboardDiv, lastTextNode.nextSibling);
        }
      }

      if (node.children.length > 0) {
        const subList = this.#renderDirectory(node, li, level + 1);
        li.appendChild(subList);
      }
    });

    container.appendChild(ul);
    return ul;
  }

  #generateUniqueId(node, level, index) {
    return node.id || `heading-menu-h${level}-${index}`;
  }

  // 为当前标签设置高亮显示
  #hightLightActiveLink(event) {
    if (this.hightLightTimer) {
      clearTimeout(this.hightLightTimer);
    }
    this.hightLightTimer = setTimeout(() => {
      const links = Array.from(this.linksTarget.querySelectorAll("[data-toc-anchor-param]"));
      let activeLink = null;

      // 循环判断是否是activeLink
      for (let i = 0; i < this.headings.length; i++) {
        const heading = this.headings[i];

        const link = links.find(
          (link) => link.dataset.tocAnchorParam === heading.querySelector("[js-position]")?.id,
        );

        if (link && this.isHeadingInView(heading)) {
          activeLink = link;
          break;
        }
      }

      if (activeLink) {
        // 添加样式, 移除其他标签的active样式
        links.forEach((link) => link.classList.remove("text-primary", "font-bold"));
        activeLink.classList.add("text-primary", "font-bold");
        activeLink.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }, 1);
  }

  // 判断heading的边界是否在视图区域
  isHeadingInView(heading) {
    // 获取当前heading的位置信息
    const bounding = heading.getBoundingClientRect();

    // 判断heading的边界是否在视图区域
    return (
      bounding.top >= this.headerHeight &&
      bounding.left >= 0 &&
      bounding.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
      bounding.right <=
      (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  navigateToAnchor(event) {
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

      window.scrollBy(0, -headerHeight); // 先滚动到目标位置的上方
      window.scrollBy(scrollOptions); // 再滚动到目标位置
    }
  }

  fncAnimation = (callback) => {
    window.setTimeout(callback, 1000 / 60);
    return callback;
  };

  get headings() {
    return Array.from(this.contentTarget.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  }

  get headerHeight() {
    if (!this.hasHeaderSelectorValue || !this.headerSelectorValue) {
      return 0
    }

    // 动态获取header的高度，并且判断是否是固定
    const header = document.querySelector(this.headerSelectorValue);
    if (!header) {
      return 0;
    }
    return header.offsetHeight;

    // const styles = window.getComputedStyle(header);

    // let fixed = styles.getPropertyValue("position") === "fixed";
    // if (fixed) {
    //   return header.offsetHeight;
    // } else {
    //   return 0;
    // }
  }
}
