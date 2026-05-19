import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = [
    "messages",
    "messagesScroll",
    "error",
    "input",
    "send",
    "clearButton",
    "userMessageTemplate",
    "assistantMessageTemplate",
    "retryButton",
  ];
  static classes = ["hidden"];
  static values = {
    url: String,
    chatsUrl: String,
    chatId: String,
    timeout: Number,
    autoSubmit: { type: Boolean, default: false },
    message: String,
    messages: Object,
    query: Object,
  };

  connect() {
    this.isStreaming = false;
    this.chatHistory = [];
    this.currentRound = null;
    this.#hydrateFromDom();
    this.syncSendButton();
    this.#syncClearButtonVisibility();
  }

  disconnect() {
    this.stopStreaming();
  }

  messageValueChanged() {
    if (this.autoSubmitValue && this.messageValue) {
      this.#delayAutoSubmit();
    }
  }

  chatIdValueChanged() {
    this.#syncClearButtonVisibility();
  }

  sendFromWindow(event) {
    const text = event.detail?.message?.trim();
    if (!text) return;
    this.sendMessage(text);
  }

  send(event) {
    event?.preventDefault();
    this.#sendUserMessage();
  }

  onInputKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.#sendUserMessage();
    }
  }

  syncSendButton() {
    if (!this.hasSendTarget || !this.hasInputTarget) return;
    const hasText = this.inputTargets.some((el) => el.value.trim());
    this.sendTargets.forEach((btn) => {
      btn.disabled = !hasText || this.isStreaming;
    });
  }

  retryFromButton(event) {
    const idx = Number(event.currentTarget.dataset.idx);
    const round = this.chatHistory[idx];
    if (round?.retry) round.retry();
  }

  retryLastResponse() {
    const idx = this.chatHistory.length - 1;
    const round = this.chatHistory[idx];
    if (!round?.user) return;
    if (this.isStreaming) this.stopStreaming();
    round.ai = "";
    round.status = "streaming";
    this.#removeLastAssistantRound();
    this.appendAssistantMessage("", "streaming", idx);
    this.#streamAssistant(round.user, idx, { replaceLastAssistant: true });
  }

  async copyLastResponse() {
    const idx = this.chatHistory.length - 1;
    const text = this.chatHistory[idx]?.ai;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  async clearChat() {
    if (this.isStreaming) this.stopStreaming();

    if (this.chatIdValue && this.chatsUrlValue) {
      try {
        await fetch(`${this.chatsUrlValue}/${this.chatIdValue}`, {
          method: "DELETE",
          headers: this.#jsonHeaders(),
          credentials: "same-origin",
        });
      } catch {
        /* ignore network errors, still clear UI */
      }
    }

    this.chatHistory = [];
    this.currentRound = null;
    this.messagesTargets.forEach((el) => {
      el.innerHTML = "";
    });
    this.chatIdValue = "";
    this.urlValue = this.urlValue.replace(/\/\d+$/, "");
    this.#toggleEmptyHint(true);
    this.#syncClearButtonVisibility();
  }

  #delayAutoSubmit() {
    if (this.delayAutoSubmitTimer) clearTimeout(this.delayAutoSubmitTimer);
    this.delayAutoSubmitTimer = setTimeout(() => {
      if (this.messageValue) this.sendMessage(this.messageValue);
    }, 500);
  }

  #sendUserMessage() {
    const message = (this.inputTargets.find((el) => el.value.trim())?.value || "").trim();
    if (!message) return;
    this.inputTargets.forEach((el) => {
      el.value = "";
    });
    this.syncSendButton();
    this.sendMessage(message);
  }

  sendMessage(message) {
    if (!message || !this.url) return;

    if (this.isStreaming) {
      this.updateCurrentAssistantMessage(
        this.currentRound.ai,
        "canceled",
        this.chatHistory.length - 1
      );
      this.stopStreaming();
    }

    this.#toggleEmptyHint(false);

    this.currentRound = {
      user: message,
      ai: "",
      status: "streaming",
      retry: null,
    };
    this.chatHistory.push(this.currentRound);
    this.#syncClearButtonVisibility();
    this.appendUserMessage(message);
    this.appendAssistantMessage("", "streaming", this.chatHistory.length - 1);

    const idx = this.chatHistory.length - 1;
    this.#streamAssistant(message, idx);
  }

  async #streamAssistant(message, idx, { replaceLastAssistant = false } = {}) {
    this.isStreaming = true;
    this.syncSendButton();
    this.currentRound.ai = "";
    this.currentRound.status = "streaming";
    if (!replaceLastAssistant) {
      this.updateCurrentAssistantMessage("", "streaming", idx);
    }

    const params = new URLSearchParams({ message });
    await this.#ensureChatId();
    if (this.chatIdValue) {
      params.append("chat_id", this.chatIdValue);
    }
    const query = this.hasQueryValue ? this.queryValue : {};
    Object.entries(query).forEach(([key, value]) => {
      if (value != null && value !== "") params.append(`query[${key}]`, value);
    });

    this.eventSource = new EventSource(`${this.url}?${params.toString()}`);
    this.startTimeoutTimer();

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      data.message ||= "";

      if (data.chat_id) {
        this.chatIdValue = String(data.chat_id);
      }

      this.resetTimeoutTimer();

      if (data.status === "started" || data.status === "reading") {
        this.updateCurrentAssistantMessage(this.messagesValue.reading, "status", idx);
        return;
      }

      if (data.status === "thinking") {
        this.updateCurrentAssistantMessage(this.messagesValue.thinking_status, "status", idx);
        return;
      }

      if (data.status === "system") {
        this.currentRound.ai = data.message;
        this.currentRound.status = "system";
        this.updateCurrentAssistantMessage(this.currentRound.ai, "system", idx);
        return;
      }

      if (data.status === "streaming") {
        if (this.currentRound.status !== "streaming") {
          this.currentRound.ai = "";
        }
        this.currentRound.status = "streaming";
        this.currentRound.ai += data.message;
        this.updateCurrentAssistantMessage(this.currentRound.ai, "streaming", idx);
        return;
      }

      if (data.status === "completed") {
        this.currentRound.ai += data.message;
        if (this.messagesValue.completed) {
          this.currentRound.ai = this.#appendCompletionText(
            this.currentRound.ai,
            this.messagesValue.completed
          );
        }
        this.currentRound.status = "completed";
        this.#finishStreaming(idx);
        this.updateCurrentAssistantMessage(this.currentRound.ai, "completed", idx);
        this.#showAssistantActions(idx);
        return;
      }

      if (data.status === "error") {
        this.#handleStreamError(data.message, idx);
      }
    };

    this.eventSource.onerror = () => {
      this.#handleStreamError(this.messagesValue.network_error, idx);
    };
  }

  #handleStreamError(message, idx) {
    this.currentRound.ai = message;
    this.currentRound.status = "error";
    this.#finishStreaming(idx);
    this.currentRound.retry = () => {
      this.currentRound.status = "streaming";
      this.currentRound.ai = "";
      this.#removeLastAssistantRound();
      this.appendAssistantMessage("", "streaming", idx);
      this.#streamAssistant(this.currentRound.user, idx, { replaceLastAssistant: true });
    };
    this.updateCurrentAssistantMessage(
      this.currentRound.ai,
      "error",
      idx,
      this.currentRound.retry
    );
  }

  #finishStreaming() {
    this.eventSource?.close();
    this.isStreaming = false;
    this.clearTimeoutTimer();
    this.syncSendButton();
  }

  stopStreaming() {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        /* ignore */
      }
    }
    this.isStreaming = false;
    this.clearTimeoutTimer();
    this.syncSendButton();
    if (this.hasErrorTarget) {
      this.errorTarget.classList.add(...this.hiddenClasses);
    }
  }

  #hydrateFromDom() {
    const primary = this.messagesTargets[0];
    if (!primary || primary.children.length === 0) return;

    const rounds = [];
    let pendingUser = null;

    primary.querySelectorAll(".ai-chat-user-round, .ai-chat-assistant-round").forEach((el) => {
      if (el.matches(".ai-chat-user-round")) {
        pendingUser = el.querySelector(".ai-user-message")?.textContent?.trim() || "";
      } else if (el.matches(".ai-chat-assistant-round") && pendingUser != null) {
        const contentEl = el.querySelector("[data-markdown-target='content']");
        const ai = contentEl?.textContent?.trim() || "";
        rounds.push({ user: pendingUser, ai, status: "completed", retry: null });
        pendingUser = null;
      }
    });

    if (rounds.length === 0) return;
    this.chatHistory = rounds;
    this.#toggleEmptyHint(false);
    this.#syncClearButtonVisibility();
  }

  appendUserMessage(content) {
    if (!this.hasUserMessageTemplateTarget) return;
    this.messagesTargets.forEach((container) => {
      const tpl = this.userMessageTemplateTarget.content.cloneNode(true);
      const node = tpl.querySelector(".ai-user-message");
      if (node) node.textContent = content;
      container.appendChild(tpl);
    });
    this.scrollToBottom(true);
  }

  appendAssistantMessage(content, status, idx, retryFn) {
    if (!this.hasAssistantMessageTemplateTarget) return;
    this.messagesTargets.forEach((container) => {
      const tpl = this.assistantMessageTemplateTarget.content.cloneNode(true);
      this.#fillAssistantNode(tpl, content, status, idx, retryFn);
      container.appendChild(tpl);
    });
    if (status === "completed") this.#showAssistantActions(idx);
    this.scrollToBottom(status !== "streaming");
  }

  updateCurrentAssistantMessage(content, status, idx, retryFn) {
    this.messagesTargets.forEach((container) => {
      const rounds = container.querySelectorAll(".ai-chat-assistant-round");
      const node = rounds[rounds.length - 1];
      if (!node) return;
      this.#fillAssistantNode(node, content, status, idx, retryFn);
    });
    this.scrollToBottom();
  }

  #fillAssistantNode(node, content, status, idx, retryFn) {
    const markdownRoot = node.querySelector("[data-controller~='markdown']");
    const contentEl = node.querySelector("[data-markdown-target='content']");
    const renderedEl = node.querySelector("[data-markdown-target='renderedContent']");
    const enableMarkdownStyle = () => renderedEl?.classList.add("chat-message");
    const disableMarkdownStyle = () => renderedEl?.classList.remove("chat-message");

    if (status === "error") {
      const button = this.retryButton.cloneNode(true);
      button.dataset.idx = String(idx);
      button.classList.remove("hidden");
      button.classList.add("shrink-0");
      if (renderedEl) {
        disableMarkdownStyle();
        renderedEl.innerHTML = `<div class="flex items-center gap-2 text-error"><span>${this.escapeHTML(content)}</span></div>`;
      }
      renderedEl?.querySelector("div")?.appendChild(button);
      if (retryFn) {
        button.addEventListener("click", (e) => {
          e.preventDefault();
          retryFn();
        });
      }
      return;
    }

    if (status === "canceled" || status === "status") {
      if (contentEl) contentEl.textContent = "";
      if (renderedEl) {
        disableMarkdownStyle();
        renderedEl.innerHTML = `<span class="text-base-content/50">${this.escapeHTML(content)}</span>`;
      }
      return;
    }

    if (content) {
      enableMarkdownStyle();
      if (contentEl) contentEl.textContent = content;
      this.#triggerMarkdown(markdownRoot);
    } else if (renderedEl) {
      disableMarkdownStyle();
      renderedEl.innerHTML = `<span class="text-base-content/50">${this.messagesValue.thinking}</span>`;
    }
  }

  #triggerMarkdown(markdownRoot) {
    if (!markdownRoot || !window.Stimulus) return;
    const ctrl = window.Stimulus.getControllerForElementAndIdentifier(markdownRoot, "markdown");
    ctrl?.renderContent();
  }

  #showAssistantActions(idx) {
    this.messagesTargets.forEach((container) => {
      const rounds = container.querySelectorAll(".ai-chat-assistant-round");
      rounds.forEach((el, i) => {
        const actions = el.querySelector(".ai-message-actions");
        if (!actions) return;
        actions.classList.toggle("hidden", i !== idx);
      });
    });
  }

  #toggleEmptyHint(show) {
    this.element.querySelectorAll(".mint-ai-empty-hint").forEach((el) => {
      el.classList.toggle("hidden", !show);
    });
    this.messagesScrollTargets
      .filter((el) => el.dataset.aiSearchVariant === "mobile")
      .forEach((el) => el.classList.toggle("hidden", show));
  }

  #removeLastAssistantRound() {
    this.messagesTargets.forEach((container) => {
      const rounds = container.querySelectorAll(".ai-chat-assistant-round");
      rounds[rounds.length - 1]?.remove();
    });
  }

  async #ensureChatId() {
    if (this.chatIdValue || !this.chatsUrlValue) return this.chatIdValue;
    try {
      const response = await fetch(this.chatsUrlValue, {
        method: "POST",
        headers: this.#jsonHeaders(),
        credentials: "same-origin",
      });
      if (!response.ok) return this.chatIdValue;
      const data = await response.json();
      if (data?.id) this.chatIdValue = String(data.id);
    } catch {
      /* ignore network errors, fallback to server auto chat */
    }
    return this.chatIdValue;
  }

  #jsonHeaders() {
    const headers = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };
    const token = this.#csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    return headers;
  }

  #csrfToken() {
    return document.querySelector("meta[name='csrf-token']")?.getAttribute("content") || "";
  }

  #syncClearButtonVisibility() {
    if (!this.hasClearButtonTarget) return;
    const historySize = Array.isArray(this.chatHistory) ? this.chatHistory.length : 0;
    const hasChat = Boolean(this.chatIdValue) || historySize > 0;
    this.clearButtonTargets.forEach((btn) => {
      btn.classList.toggle("hidden", !hasChat);
    });
  }

  #appendCompletionText(content, completionText) {
    const base = (content || "").trimEnd();
    const tail = (completionText || "").trim();
    if (!tail) return base;
    if (!base) return tail;
    return `${base}\n\n${tail}`;
  }

  escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  startTimeoutTimer() {
    if (!this.hasTimeoutValue) return;
    this.timeoutTimer = setTimeout(() => {
      if (!this.currentRound) return;
      const idx = this.chatHistory.length - 1;
      this.#handleStreamError(this.messagesValue.timeout_error, idx);
    }, this.timeoutValue * 1000);
  }

  clearTimeoutTimer() {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
  }

  resetTimeoutTimer() {
    this.clearTimeoutTimer();
    this.startTimeoutTimer();
  }

  scrollToBottom(force = false) {
    const scrollEls = this.hasMessagesScrollTarget
      ? this.messagesScrollTargets
      : this.messagesTargets;
    scrollEls.forEach((el) => {
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (force || isAtBottom) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  get url() {
    return this.hasUrlValue ? this.urlValue : null;
  }

  get retryButton() {
    if (this.hasRetryButtonTarget) return this.retryButtonTarget;
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "btn btn-ghost btn-xs btn-square align-middle text-base-content/70";
    button.innerHTML = '<i class="ri-refresh-line leading-none" aria-hidden="true"></i>';
    return button;
  }
}
