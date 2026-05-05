import { Controller } from "@hotwired/stimulus";
import { copyToClipboard } from "../utils/copyToClipboard";

export default class extends Controller {
  static targets = ["buttonLabel"];
  static values = {
    defaultText: { type: String, default: "复制页面" },
    copyingText: { type: String, default: "复制中、、、" },
    successText: { type: String, default: "已复制" },
    failedText: { type: String, default: "复制失败" },
    resetDelay: { type: Number, default: 2400 },
    markdownUrl: String,
  };

  connect() {
    this.isCopying = false;
    this.resetTimer = null;
    this.updateButtonLabel(this.defaultTextValue);
  }

  disconnect() {
    this.clearResetTimer();
  }

  async copyPage(event) {
    event?.preventDefault();
    if (this.isCopying) return;

    this.isCopying = true;
    this.clearResetTimer();
    this.updateButtonLabel(this.copyingTextValue);

    try {
      const response = await fetch(this.markdownUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const markdown = await response.text();
      await copyToClipboard(markdown);
      this.updateButtonLabel(this.successTextValue);
    } catch (_error) {
      this.updateButtonLabel(this.failedTextValue);
    } finally {
      this.isCopying = false;
      this.resetTimer = setTimeout(() => {
        this.updateButtonLabel(this.defaultTextValue);
      }, this.resetDelayValue);
    }
  }

  get markdownUrl() {
    if (this.hasMarkdownUrlValue && this.markdownUrlValue) {
      return this.markdownUrlValue;
    }

    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.pathname = `${url.pathname.replace(/\/$/, "")}.md`;
    return url.toString();
  }

  updateButtonLabel(text) {
    if (this.hasButtonLabelTarget) {
      this.buttonLabelTarget.textContent = text;
    }
  }

  clearResetTimer() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}
