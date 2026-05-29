import { Controller } from "@hotwired/stimulus";
import { Application } from "@hotwired/stimulus";
import AiSearchCompletionController from "./ai_search_completion_controller";
import MarkdownController from "./markdown_controller";

export default class extends Controller {
  static targets = ["openButton", "panel", "placeholder", "shellTemplate"];
  static values = {
    unsupportedMessage: String,
    dockLabel: String,
    popOutLabel: String,
  };

  connect() {
    this.pipWindow = null;
    this.pipApplication = null;
    this.#syncOpenButton();
    if (window.documentPictureInPicture) {
      documentPictureInPicture.addEventListener("pagehide", this.#onDocumentPipPageHide);
    }
  }

  disconnect() {
    this.#closePip({ restore: true });
    if (window.documentPictureInPicture) {
      documentPictureInPicture.removeEventListener("pagehide", this.#onDocumentPipPageHide);
    }
  }

  #onDocumentPipPageHide = () => {
    if (this.pipWindow) this.#closePip({ restore: true });
  };

  open(event) {
    event?.preventDefault();
    if (!window.documentPictureInPicture) {
      if (this.unsupportedMessageValue) window.alert(this.unsupportedMessageValue);
      return;
    }
    if (this.pipWindow) {
      this.pipWindow.focus();
      return;
    }
    void this.#openPip();
  }

  dock(event) {
    event?.preventDefault();
    this.#closePip({ restore: true });
  }

  async #openPip() {
    const mainAi = this.#mainAiSearchController();
    if (!mainAi || !this.hasShellTemplateTarget) return;

    if (mainAi.isStreaming) mainAi.stopStreaming();

    const width = Math.min(420, Math.max(340, this.panelTarget?.offsetWidth || 380));
    const pipWindow = await documentPictureInPicture.requestWindow({
      width,
      height: Math.min(720, Math.round(window.innerHeight * 0.85)),
    });

    this.pipWindow = pipWindow;
    this.#copyDocumentBasics(pipWindow);
    this.#copyStyles(pipWindow);

    const shell = this.shellTemplateTarget.content.firstElementChild.cloneNode(true);
    this.#copyAiSearchConfig(this.#aiSearchContainer(), shell);
    pipWindow.document.body.appendChild(shell);
    pipWindow.document.body.classList.add(
      "bg-base-100",
      "text-base-content",
      "m-0",
      "overflow-hidden"
    );

    this.pipApplication = new Application(pipWindow.document.documentElement);
    this.pipApplication.register("ai-search", AiSearchCompletionController);
    this.pipApplication.register("markdown", MarkdownController);
    this.pipApplication.start();

    const pipAi = this.pipApplication.getControllerForElementAndIdentifier(shell, "ai-search");
    pipAi?.importState(mainAi.exportState());

    shell.querySelector("[data-ai-pip-dock]")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#closePip({ restore: true });
    });

    pipWindow.addEventListener("pagehide", () => {
      if (this.pipWindow === pipWindow) this.#closePip({ restore: true });
    });

    this.panelTarget.classList.add("hidden");
    this.placeholderTarget.classList.remove("hidden");
    this.#syncOpenButton();
    this.dispatch("open");
  }

  #closePip({ restore } = {}) {
    if (!this.pipWindow && !this.pipApplication) {
      if (this.hasPanelTarget) this.panelTarget.classList.remove("hidden");
      if (this.hasPlaceholderTarget) this.placeholderTarget.classList.add("hidden");
      this.#syncOpenButton();
      return;
    }

    const pipWindow = this.pipWindow;
    const pipRoot = pipWindow?.document.body?.querySelector("[data-controller~='ai-search']");

    if (restore && pipRoot && this.pipApplication) {
      const pipAi = this.pipApplication.getControllerForElementAndIdentifier(pipRoot, "ai-search");
      const mainAi = this.#mainAiSearchController();
      if (pipAi?.isStreaming) pipAi.stopStreaming();
      if (pipAi && mainAi) mainAi.importState(pipAi.exportState());
    }

    if (this.pipApplication) {
      this.pipApplication.stop();
      this.pipApplication = null;
    }

    if (pipWindow && !pipWindow.closed) {
      try {
        pipWindow.close();
      } catch {
        /* ignore */
      }
    }
    this.pipWindow = null;

    if (this.hasPanelTarget) this.panelTarget.classList.remove("hidden");
    if (this.hasPlaceholderTarget) this.placeholderTarget.classList.add("hidden");
    this.#syncOpenButton();
    this.dispatch("close");
  }

  #copyDocumentBasics(pipWindow) {
    const pipDoc = pipWindow.document;
    pipDoc.documentElement.lang = document.documentElement.lang || "";
    pipDoc.documentElement.className = document.documentElement.className;
    if (document.documentElement.dataset.theme) {
      pipDoc.documentElement.dataset.theme = document.documentElement.dataset.theme;
    }

    const csrf = document.querySelector("meta[name='csrf-token']");
    if (csrf) {
      const meta = pipDoc.createElement("meta");
      meta.name = "csrf-token";
      meta.content = csrf.content;
      pipDoc.head.appendChild(meta);
    }
  }

  #copyStyles(pipWindow) {
    const pipHead = pipWindow.document.head;
    document.querySelectorAll("link[rel='stylesheet']").forEach((link) => {
      pipHead.appendChild(link.cloneNode(true));
    });
  }

  #copyAiSearchConfig(fromEl, toEl) {
    if (!fromEl || !toEl) return;
    [...fromEl.attributes].forEach((attr) => {
      if (attr.name.startsWith("data-ai-search")) {
        toEl.setAttribute(attr.name, attr.value);
      }
    });
  }

  #aiSearchContainer() {
    return this.element.closest("[data-controller~='ai-search']");
  }

  #mainAiSearchController() {
    const container = this.#aiSearchContainer();
    if (!container || !this.application) return null;
    return this.application.getControllerForElementAndIdentifier(container, "ai-search");
  }

  #syncOpenButton() {
    if (!this.hasOpenButtonTarget) return;
    const supported = Boolean(window.documentPictureInPicture);
    this.openButtonTarget.classList.toggle("hidden", !supported);
    this.openButtonTarget.disabled = Boolean(this.pipWindow);
    this.openButtonTarget.setAttribute(
      "aria-label",
      this.pipWindow ? this.dockLabelValue : this.popOutLabelValue
    );
    const icon = this.openButtonTarget.querySelector("i");
    if (icon) {
      icon.className = this.pipWindow
        ? "ri-layout-left-line icon-thin text-base text-base-content/60 group-hover:text-base-content leading-none"
        : "ri-picture-in-picture-2-line icon-thin text-base text-base-content/60 group-hover:text-base-content leading-none";
    }
  }
}
