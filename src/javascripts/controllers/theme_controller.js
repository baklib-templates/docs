import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["autoIcon", "lightIcon", "darkIcon", "currentIcon"];

  connect() {
    // Docs wiki 主题：强制浅色模式（禁用暗黑/自动模式）
    this.#updateTheme("light");
  }

  disconnect() {
  }

  handleSystemThemeChange() {
  }

  toggle(event) {
    event?.preventDefault?.();
    this.#updateTheme("light");
  }

  get theme() {
    return "light";
  }

  set theme(name) {
    localStorage.removeItem("theme");
  }

  get systemDark() {
    return false;
  }

  #updateTheme(name) {
    // 更新主题
    switch (name) {
      case "dark":
        this.element.dataset.theme = "dark";
        this.element.classList.add("dark");
        break;
      case "light":
      default:
        this.element.dataset.theme = "light";
        this.element.classList.remove("dark");
        break;
    }
    this.#updateIcons(name);
  }

  #updateIcons(mode) {
    let icon = null
    // 显示对应模式的图标
    switch (mode) {
      case "light":
        icon = this.hasLightIconTarget ? this.lightIconTarget : null;
        break;
      case "dark":
        icon = this.hasDarkIconTarget ? this.darkIconTarget : null;
        break;
      case "auto":
      default:
        icon = this.hasAutoIconTarget ? this.autoIconTarget : null;
        break;
    }
    if (!icon) {
      return;
    }

    // clone icon
    icon = icon.cloneNode(true);
    icon.setAttribute("data-theme-target", this.currentIconTarget.dataset.themeTarget);
    icon.setAttribute("class", this.currentIconTarget.classList);
    this.currentIconTarget.outerHTML = icon.outerHTML;
  }
}
