import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["input", "metaKeyEl"];
  static values = { searchUrl: String };

  connect() {
    this._onKeydown = this._onKeydown.bind(this);
    document.addEventListener("keydown", this._onKeydown);
    this.#syncMetaKeyLabel();
  }

  disconnect() {
    document.removeEventListener("keydown", this._onKeydown);
  }

  #syncMetaKeyLabel() {
    if (!this.hasMetaKeyElTarget) return;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const platform =
      typeof navigator !== "undefined" && navigator.platform ? navigator.platform : "";
    const isMac =
      /Mac|iPhone|iPod|iPad/i.test(platform) ||
      /Mac OS/i.test(ua);
    this.metaKeyElTarget.textContent = isMac ? "⌘" : "Ctrl";
  }

  _onKeydown(event) {
    if (event.key !== "k" && event.key !== "K") return;
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.altKey || event.shiftKey) return;

    const el = event.target;
    const tag = el && el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
      return;
    }

    event.preventDefault();
    this.focusOrNavigate();
  }

  focusOrNavigate() {
    if (this.hasInputTarget && this.#isVisible(this.inputTarget)) {
      this.inputTarget.focus();
      return;
    }
    if (this.hasSearchUrlValue && this.searchUrlValue) {
      window.location.assign(this.searchUrlValue);
    }
  }

  #isVisible(element) {
    return !!(element.offsetParent || element.getClientRects().length);
  }
}
