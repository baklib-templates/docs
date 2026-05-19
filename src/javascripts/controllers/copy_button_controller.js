import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = {
    content: String,
    copyLabel: { type: String, default: "Copy" },
    copiedLabel: { type: String, default: "Copied" },
    errorLabel: { type: String, default: "Failed" },
  };

  connect() {
    this.labelEl = this.element.querySelector(".code-copy-btn__label");
    this.#setLabel(this.copyLabelValue);
  }

  async copy(event) {
    event.preventDefault();
    const raw = this.hasContentValue ? this.contentValue : "";
    const content = decodeURIComponent(raw || "");
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      this.element.dataset.copyButtonState = "success";
      this.#setLabel(this.copiedLabelValue);
    } catch {
      this.element.dataset.copyButtonState = "error";
      this.#setLabel(this.errorLabelValue);
    }

    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => {
      delete this.element.dataset.copyButtonState;
      this.#setLabel(this.copyLabelValue);
    }, 1200);
  }

  #setLabel(text) {
    if (this.labelEl) this.labelEl.textContent = text;
  }
}
