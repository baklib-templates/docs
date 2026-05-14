import { Controller } from "@hotwired/stimulus";
import { buildUrl } from "../utils/index.js";

/**
 * 顶栏搜索：⌘/Ctrl+K 打开弹层、`<dialog class="modal">` 开关；ESC 关闭弹层（文档级监听，含焦点在热门词等控件上）。
 * 有关键词时展开结果区（Turbo 预览 + 热门词）与底部 AI 区，无关键词时仅保留搜索框。键盘 ↑/↓ 切换选中、Enter 跳转。
 * 弹层显隐由原生 dialog + DaisyUI（modal-box + modal-backdrop 表单）负责。
 */
export default class extends Controller {
  static targets = [
    "input", // 可选：旧版顶栏内联搜索框（有则 ⌘K 优先 focus）
    "metaKeyEl",
    "modal",
    "modalInput",
    "resultsScroll",
    "previewFrame",
    "hotSection",
    "aiSection",
    "aiLink",
  ];
  static values = {
    searchUrl: String,
    previewUrl: String,
    debounceMs: { type: Number, default: 220 },
  };

  connect() {
    this._onDocKeydown = (event) => this.#onDocKeydown(event);
    document.addEventListener("keydown", this._onDocKeydown);
    this.#syncMetaKeyLabel();

    this._onDialogClose = () => {
      // 延后到下一帧再改弹层内部 DOM，避免关闭瞬间仍可见时先被清空再消失造成「闪一下」
      setTimeout(() => this.#resetModalState(), 200);
    };
    if (this.hasModalTarget) {
      this.modalTarget.addEventListener("close", this._onDialogClose);
    }

    if (this.hasPreviewFrameTarget) {
      this._onPreviewFrameLoad = (event) => {
        if (event.target === this.previewFrameTarget) this.#afterPreviewFrameLoad();
      };
      this.previewFrameTarget.addEventListener("turbo:frame-load", this._onPreviewFrameLoad);
      // Turbo 注入的链接上没有 Stimulus action，在 frame 上做 mouseover 委托高亮
      this._onPreviewMouseOver = (event) => this.#onPreviewMouseOver(event);
      this.previewFrameTarget.addEventListener("mouseover", this._onPreviewMouseOver);
    }

    this.debounceTimer = null;
    this.selectedIndex = null;
  }

  disconnect() {
    document.removeEventListener("keydown", this._onDocKeydown);
    if (this.hasModalTarget) {
      this.modalTarget.removeEventListener("close", this._onDialogClose);
    }
    if (this.hasPreviewFrameTarget && this._onPreviewFrameLoad) {
      this.previewFrameTarget.removeEventListener("turbo:frame-load", this._onPreviewFrameLoad);
    }
    if (this.hasPreviewFrameTarget && this._onPreviewMouseOver) {
      this.previewFrameTarget.removeEventListener("mouseover", this._onPreviewMouseOver);
    }
    this.#clearDebounce();
  }

  /** 打开弹层：清空预览、滚回顶部、同步结果区/AI 显隐，下一帧聚焦输入 */
  openModal(event) {
    event?.preventDefault();
    if (!this.hasModalTarget) return;
    this.#clearDebounce();
    this.#clearPreviewFrame();
    this.selectedIndex = null;
    if (this.hasResultsScrollTarget) this.resultsScrollTarget.scrollTop = 0;
    this.modalTarget.showModal();
    this.#syncSearchPanelsVisibility();
    this.#updateAiLink();
    requestAnimationFrame(() => this.modalInputTarget?.focus());
  }

  closeModal() {
    if (!this.hasModalTarget) return;
    if (this.modalTarget.open) this.modalTarget.close();
  }

  /**
   * 预览在 openModal、以及输入框删空关键词（#loadPreview）时再清。
   */
  #resetModalState() {
    this.#clearDebounce();
    if (this.hasModalInputTarget) this.modalInputTarget.value = "";
    this.selectedIndex = null;
    this.#syncSearchPanelsVisibility();
    this.#updateAiLink();
  }

  #clearPreviewFrame() {
    if (!this.hasPreviewFrameTarget) return;
    this.previewFrameTarget.removeAttribute("src");
    this.previewFrameTarget.innerHTML = "";
  }

  onModalInput() {
    this.#syncSearchPanelsVisibility();
    this.#debouncedLoadPreview();
    this.#updateAiLink();
  }

  /** Enter 跳转；↑/↓ 在结果列表中循环切换选中（无结果时不拦截） */
  onModalKeydown(event) {
    if (event.key === "Enter") {
      const href = this.#selectedHref();
      if (!href) return;
      event.preventDefault();
      this.#visitUrl(href);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const n = this.previewFrameTarget?.querySelectorAll("[data-search-item]").length ?? 0;
    if (n === 0) return;

    event.preventDefault();

    if (this.selectedIndex == null) {
      this.selectedIndex = event.key === "ArrowDown" ? 0 : n - 1;
    } else if (event.key === "ArrowDown") {
      this.selectedIndex = (this.selectedIndex + 1) % n;
    } else {
      this.selectedIndex = (this.selectedIndex - 1 + n) % n;
    }

    this.#paintSelection();
    this.#scrollSelectedIntoView();
  }

  #onPreviewMouseOver(event) {
    if (!this.hasPreviewFrameTarget) return;
    const row = event.target.closest?.("[data-search-item]");
    if (!row || !this.previewFrameTarget.contains(row)) return;
    const idx = Number(row.dataset.index);
    if (!Number.isFinite(idx)) return;
    this.selectedIndex = idx;
    this.#paintSelection();
  }

  /** 鼠标离开结果列表区域：取消选中（与「仅键盘时默认第一条」配合） */
  clearListSelection() {
    this.selectedIndex = null;
    this.#paintSelection();
  }

  /** 鼠标重新进入列表且无选中时，回到第一条 */
  resultsEnter() {
    const n = this.previewFrameTarget?.querySelectorAll("[data-search-item]").length ?? 0;
    if (this.selectedIndex == null && n > 0) {
      this.selectedIndex = 0;
      this.#paintSelection();
    }
  }

  applyHotKeyword(event) {
    const kw = event.currentTarget.dataset.kw;
    if (!kw || !this.hasModalInputTarget) return;
    this.modalInputTarget.value = kw;
    this.modalInputTarget.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * ⌘/Ctrl+K：有弹层则打开；否则若有可见内联 input 则聚焦；否则跳整页搜索。
   */
  focusOrNavigate() {
    if (this.hasModalTarget) {
      this.openModal();
      return;
    }
    if (this.hasInputTarget) {
      const el = this.inputTarget;
      if (el.offsetParent || el.getClientRects().length) {
        el.focus();
        return;
      }
    }
    if (this.hasSearchUrlValue && this.searchUrlValue) {
      window.location.assign(this.searchUrlValue);
    }
  }

  #onDocKeydown(event) {
    // 弹层打开时 ESC 一律关闭（焦点在输入框外的按钮上时，输入框上的 keydown 监听收不到）
    if (event.key === "Escape" && !event.isComposing) {
      if (this.hasModalTarget && this.modalTarget.open) {
        event.preventDefault();
        this.closeModal();
      }
      return;
    }

    if (event.key !== "k" && event.key !== "K") return;
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.altKey || event.shiftKey) return;

    const el = event.target;
    const tag = el && el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
      if (this.hasModalTarget && this.modalTarget.open && this.modalTarget.contains(el)) {
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();
    this.focusOrNavigate();
  }

  /** 桌面快捷键提示：Mac 显示 ⌘，其它显示 Ctrl */
  #syncMetaKeyLabel() {
    if (!this.hasMetaKeyElTarget) return;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const platform =
      typeof navigator !== "undefined" && navigator.platform ? navigator.platform : "";
    const isMac = /Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS/i.test(ua);
    this.metaKeyElTarget.textContent = isMac ? "⌘" : "Ctrl";
  }

  #debouncedLoadPreview() {
    this.#clearDebounce();
    this.debounceTimer = window.setTimeout(() => this.#loadPreview(), this.debounceMsValue);
  }

  #clearDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** 通过修改 turbo-frame 的 src 触发预览请求；空关键词则清空 frame */
  #loadPreview() {
    if (!this.hasPreviewUrlValue || !this.previewUrlValue || !this.hasPreviewFrameTarget) return;
    const q = (this.modalInputTarget?.value || "").trim();
    if (!q) {
      this.#clearPreviewFrame();
      this.selectedIndex = null;
      this.#paintSelection();
      this.#syncSearchPanelsVisibility();
      return;
    }
    this.previewFrameTarget.src = buildUrl(this.previewUrlValue, { q });
  }

  /** 预览 HTML 替换进 frame 后：默认选中第一条 */
  #afterPreviewFrameLoad() {
    const n = this.previewFrameTarget?.querySelectorAll("[data-search-item]").length ?? 0;
    this.selectedIndex = n > 0 ? 0 : null;
    this.#paintSelection();
  }

  #selectedHref() {
    if (this.selectedIndex == null || !this.hasPreviewFrameTarget) return null;
    const rows = this.previewFrameTarget.querySelectorAll("[data-search-item]");
    return rows[this.selectedIndex]?.getAttribute("href") || null;
  }

  #paintSelection() {
    if (!this.hasPreviewFrameTarget) return;
    this.previewFrameTarget.querySelectorAll("[data-search-item]").forEach((el) => {
      const idx = Number(el.dataset.index);
      const on = this.selectedIndex != null && idx === this.selectedIndex;
      el.toggleAttribute("data-search-item-selected", on);
      el.classList.toggle("bg-base-200", on);
      el.classList.toggle("ring-1", on);
      el.classList.toggle("ring-base-300/70", on);
      const chev = el.querySelector(".search-modal__chev");
      if (chev) chev.classList.toggle("opacity-100", on);
    });
  }

  /** 键盘移动选中项时，保证当前项在可滚动结果区内可见 */
  #scrollSelectedIntoView() {
    if (!this.hasPreviewFrameTarget || this.selectedIndex == null) return;
    const rows = this.previewFrameTarget.querySelectorAll("[data-search-item]");
    rows[this.selectedIndex]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  #visitUrl(url) {
    if (this.hasModalTarget && this.modalTarget.open) this.modalTarget.close();
    this.#resetModalState();
    if (window.Turbo?.visit) {
      window.Turbo.visit(url, { action: "advance" });
    } else {
      window.location.assign(url);
    }
  }

  /**
   * 无关键词：隐藏结果滚动区（热门词 + turbo 预览）与底部 AI 区；有关键词时展开。
   * 热门词：仅当配置了热词且尚未输入时可见；输入后隐藏（与原先一致）。
   */
  #syncSearchPanelsVisibility() {
    const q = (this.modalInputTarget?.value || "").trim();
    const hasQuery = !!q;

    if (this.hasResultsScrollTarget) {
      this.resultsScrollTarget.classList.toggle("hidden", !hasQuery);
    }
    if (this.hasAiSectionTarget) {
      this.aiSectionTarget.classList.toggle("hidden", !hasQuery);
    }

    if (this.hasHotSectionTarget) {
      const hasHot = !!this.hotSectionTarget.querySelector("[data-kw]");
      this.hotSectionTarget.classList.toggle("hidden", !hasHot || hasQuery);
    }
  }

  /** 底部「Ask AI」链到搜索页并带上当前 q，文案中的关键词同步 */
  #updateAiLink() {
    if (!this.hasAiLinkTarget || !this.hasSearchUrlValue) return;
    const q = (this.modalInputTarget?.value || "").trim();
    const u = new URL(this.searchUrlValue, window.location.href);
    u.searchParams.set("q", q);
    this.aiLinkTarget.href = u.toString();
    const strong = this.aiLinkTarget.querySelector(".search-modal-ai-q");
    if (strong) strong.textContent = q || "…";
  }
}
