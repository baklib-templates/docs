import { Controller } from "@hotwired/stimulus";
import tippy from "tippy.js";
import { copyToClipboard } from "../utils/copyToClipboard";

export default class extends Controller {
  static targets = ["source"];
  static values = {
    success: {
      type: String,
      default: "复制成功！",
    },
    content: String,
  };

  copy(event) {
    event.preventDefault();
    let content, target;
    if (this.hasContentValue) {
      content = this.contentValue;
      target = this.element;
    } else if (this.hasSourceTarget) {
      content = this.sourceTarget.tagName === "INPUT" ? this.sourceTarget.value : this.sourceTarget.textContent;
      target = this.sourceTarget;
    } else {
      content = this.element.textContent;
      target = this.element;
    }

    content = (content || "").trim();
    if (!content) {
      return;
    }

    const tippyInstance = tippy(target.parentElement, {
      theme: 'material',
      content: this.successValue,
      trigger: "manual",
      arrow: true,
    });

    const hideTippy = () => {
      tippyInstance.hide();
      tippyInstance.destroy();
    };

    // console.log("copy", content)

    copyToClipboard(content)
      .then(() => {
        tippyInstance.setContent(this.successValue);
        tippyInstance.show();
        setTimeout(hideTippy, 800);
      })
      .catch(() => {
        tippyInstance.setContent("复制失败！");
        tippyInstance.show();
        setTimeout(hideTippy, 800);
      });
  }
}
