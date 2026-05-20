import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["autoIcon", "lightIcon", "darkIcon", "currentIcon"];

  connect() {
    // 添加系统主题变化监听
    this.systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.systemThemeMediaQuery.addEventListener("change", this.handleSystemThemeChange.bind(this));
    this.#updateTheme(this.theme);

    document.addEventListener("turbo:load", () => {
      this.#updateTheme(this.theme);
    });
  }

  disconnect() {
    // 清理监听器
    this.systemThemeMediaQuery.removeEventListener("change", this.handleSystemThemeChange.bind(this));
  }

  handleSystemThemeChange() {
    if (this.theme == "auto") {
      this.#updateTheme(this.systemDark ? "dark" : "light");
    }
  }

  toggle(event) {
    const { mode } = event.params
    this.theme = mode;
    this.#updateTheme(mode);
  }

  get theme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme == "light" || savedTheme == "dark") {
      return savedTheme;
    }
    return "auto";
  }

  set theme(name) {
    if(name == "light" || name == "dark") {
      localStorage.setItem("theme", name);
    } else {
      localStorage.removeItem("theme");
    }
  }

  get systemDark() {
    return this.systemThemeMediaQuery.matches;
  }

  #updateTheme(name) {
    // 更新主题
    switch (name) {
      case "dark":
        this.element.dataset.theme = "dark";
        this.element.classList.add("dark");
        break;
      case "light":
        this.element.dataset.theme = "light";
        this.element.classList.remove("dark");
        break;
      default:
        const isDarkMode = this.systemDark;
        this.element.dataset.theme = isDarkMode ? "dark" : "light";
        this.element.classList.toggle("dark", isDarkMode);
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
