import { Controller } from "@hotwired/stimulus";

/**
 * LinkTargetController v1.0.0
 *
 * 作用：
 * - 扫描当前容器内所有带 href 的 a 标签。
 * - 可统一关闭 Turbo 导航（data-turbo="false"）。
 * - 可将外部链接设置为新窗口打开，并补充安全属性 rel。
 *
 * 参数（Stimulus Values）：
 * - external(Boolean, 默认 true)
 *   是否将外部链接设置为新窗口打开（target="_blank" + rel="noopener noreferrer"）。
 * - disableTurboLink(Boolean, 默认 true)
 *   是否给链接添加 data-turbo="false"，禁用 Turbo 接管跳转。
 *
 * 使用示例：
 * <div data-controller="link-target"
 *      data-link-target-external-value="true"
 *      data-link-target-disable-turbo-link-value="true"></div>
 */
export default class extends Controller {
  static values = {
    external: { type: Boolean, default: true }, // 是否外部打开
    disableTurboLink: { type: Boolean, default: true } // 禁用Turbo链接; 因为如果链接是内部其他页面，然后其他页面又是一个需要权限验证，返回的时候会导致页面加载异常
  };

  connect() {
    const anchors = this.element.querySelectorAll("a[href]");
    anchors.forEach(a => {
      if (this.disableTurboLinkValue) {
        a.setAttribute("data-turbo", "false");
      }

      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      // 判断是否为绝对地址
      const isAbsolute = /^https?:\/\//i.test(href);
      let isExternal = false;

      if (isAbsolute) {
        try {
          const url = new URL(href, window.location.origin);
          isExternal = url.hostname !== window.location.hostname;
        } catch (e) {
          // 忽略解析错误
        }
      }

      // 如果 externalValue 为 true，且是外部链接，则设置为新窗口打开
      if (this.externalValue && isExternal) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
      // 如果 externalValue 为 false，移除 target
      if (!this.externalValue) {
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    });
  }
}
