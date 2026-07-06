import { Controller } from "@hotwired/stimulus";
import tippy from "tippy.js";
import { copyToClipboard } from "../utils/copyToClipboard";

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
    "statusMessageTemplate",
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
    query: Object // 搜索查询参数
  };

  connect() {
    this.isStreaming = false;
    this.chatHistory = [];
    this.currentRound = null;
    this.#hydrateFromDom();
    this.syncSendButton();
    this.#syncClearButtonVisibility();
  }

  exportState() {
    const messagesEl =
      this.#messagesElForVariant("desktop") ||
      this.#messagesElForVariant("pip") ||
      this.messagesTargets[0];
    const hasMessages =
      messagesEl &&
      messagesEl.querySelector(".ai-chat-user-round, .ai-chat-assistant-round");
    return {
      chatId: this.chatIdValue || "",
      messagesHtml: messagesEl?.innerHTML || "",
      showEmptyHint: !hasMessages,
    };
  }

  importState({ chatId, messagesHtml, showEmptyHint }) {
    const targets = this.messagesTargets.length
      ? this.messagesTargets
      : [this.#messagesElForVariant("desktop")].filter(Boolean);

    if (chatId) this.chatIdValue = chatId;
    else this.chatIdValue = "";

    targets.forEach((el) => {
      if (el && messagesHtml != null) el.innerHTML = messagesHtml;
    });

    this.chatHistory = [];
    this.currentRound = null;
    this.#hydrateFromDom();
    this.#toggleEmptyHint(showEmptyHint ?? this.chatHistory.length === 0);
    this.#syncClearButtonVisibility();
    this.syncSendButton();
  }

  #messagesElForVariant(variant) {
    return (
      this.messagesTargets.find((el) => el.dataset.aiSearchVariant === variant) || null
    );
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
    if (this.isStreaming) return;
    const text = event.detail?.message?.trim();
    if (!text) return;
    this.sendMessage(text);
  }

  send(event) {
    event?.preventDefault();
    this.#sendUserMessage();
  }

  onInputKeydown(event) {
    if (this.isStreaming) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.#sendUserMessage();
    }
  }

  syncSendButton() {
    if (!this.hasSendTarget) return;
    const hasText = this.hasInputTarget
      ? this.inputTargets.some((el) => el.value.trim())
      : false;
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
    void this.#resendRound(idx);
  }

  async copyResponse(event) {
    event?.preventDefault();
    const text = this.#assistantTextForCopy(event.currentTarget);
    if (!text) return;

    const button = event.currentTarget;
    const successText = this.messagesValue?.copy_success;
    const errorText = this.messagesValue?.copy_error;
    if (!successText || !errorText) return;

    try {
      await copyToClipboard(text);
      this.#showCopyToast(button, successText);
    } catch {
      this.#showCopyToast(button, errorText);
    }
  }

  #showCopyToast(anchor, message) {
    if (!anchor || !message) return;

    this._copyTippy?.destroy();
    this._copyTippy = tippy(anchor, {
      theme: "material",
      content: message,
      trigger: "manual",
      arrow: true,
      placement: "top",
    });
    this._copyTippy.show();
    window.clearTimeout(this._copyTippyTimer);
    this._copyTippyTimer = window.setTimeout(() => {
      this._copyTippy?.hide();
      this._copyTippy?.destroy();
      this._copyTippy = null;
    }, 1200);
  }

  #assistantTextForCopy(triggerEl) {
    const roundEl = triggerEl?.closest?.(".ai-chat-assistant-round");
    if (!roundEl) return "";

    const idx = Number(roundEl.dataset.roundIdx);
    if (Number.isFinite(idx) && this.chatHistory[idx]?.ai) {
      return this.chatHistory[idx].ai.trim();
    }

    const contentEl = roundEl.querySelector("[data-markdown-target='content']");
    const fromPre = contentEl?.textContent?.trim();
    if (fromPre) return fromPre;

    return (
      roundEl.querySelector("[data-markdown-target='renderedContent']")?.innerText?.trim() || ""
    );
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
    this.#toggleEmptyHint(true);
    this.#syncClearButtonVisibility();
  }

  #delayAutoSubmit() {
    if (this.delayAutoSubmitTimer) clearTimeout(this.delayAutoSubmitTimer);
    this.delayAutoSubmitTimer = setTimeout(() => {
      if (this.messageValue && !this.isStreaming) this.sendMessage(this.messageValue);
    }, 500);
  }

  #sendUserMessage() {
    if (this.isStreaming) return;
    const message = (this.inputTargets.find((el) => el.value.trim())?.value || "").trim();
    if (!message) return;
    this.inputTargets.forEach((el) => {
      el.value = "";
    });
    this.syncSendButton();
    this.sendMessage(message);
  }

  sendMessage(message) {
    if (!message || !this.url || this.isStreaming) return;

    this.#toggleEmptyHint(false);

    this.currentRound = {
      user: message,
      ai: "",
      status: "streaming",
      retry: null,
      userMessageId: null,
      assistantMessageId: null,
    };
    this.chatHistory.push(this.currentRound);
    this.#syncClearButtonVisibility();
    this.appendUserMessage(message);
    this.appendAssistantMessage("", "streaming", this.chatHistory.length - 1);

    const idx = this.chatHistory.length - 1;
    this.#streamAssistant(message, idx);
  }

  async #streamAssistant(message, idx, { replaceLastAssistant = false, resendMessageId = null } = {}) {
    this.isStreaming = true;
    this.syncSendButton();
    this.currentRound.ai = "";
    this.currentRound.status = "streaming";
    if (!replaceLastAssistant) {
      this.updateCurrentAssistantMessage("", "streaming", idx);
    }

    await this.#ensureChatId();
    const streamUrl = this.#buildStreamUrl({ message, resendMessageId });
    this.eventSource = new EventSource(streamUrl);
    this.startTimeoutTimer();

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      data.message ||= "";

      if (data.chat_id) {
        this.chatIdValue = String(data.chat_id);
      }

      this.resetTimeoutTimer();

      if (data.status === "meta") {
        this.#assignMessageIdsFromSSE(data, idx);
        return;
      }

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
        this.#assignMessageIdsFromSSE(data, idx);
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
      void this.#resendRound(idx);
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
    let pendingUserEl = null;

    primary.querySelectorAll(".ai-chat-user-round, .ai-chat-assistant-round").forEach((el) => {
      if (el.matches(".ai-chat-user-round")) {
        pendingUser = el.querySelector(".ai-user-message")?.textContent?.trim() || "";
        pendingUserEl = el;
      } else if (el.matches(".ai-chat-assistant-round") && pendingUser != null) {
        const contentEl = el.querySelector("[data-markdown-target='content']");
        const ai = contentEl?.textContent?.trim() || "";
        const idx = rounds.length;
        el.dataset.roundIdx = String(idx);
        rounds.push({
          user: pendingUser,
          ai,
          status: "completed",
          retry: null,
          userMessageId: pendingUserEl?.dataset.userMessageId || null,
          assistantMessageId: el.dataset.assistantMessageId || null,
        });
        pendingUser = null;
        pendingUserEl = null;
      }
    });

    if (rounds.length === 0) return;
    this.chatHistory = rounds;
    this.#toggleEmptyHint(false);
    this.#syncClearButtonVisibility();
    this.#showAssistantActions(rounds.length - 1);
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
    const roundEl =
      node instanceof Element && node.matches(".ai-chat-assistant-round")
        ? node
        : node.querySelector?.(".ai-chat-assistant-round");
    if (roundEl) roundEl.dataset.roundIdx = String(idx);

    const markdownRoot = node.querySelector("[data-controller~='markdown']");
    const contentEl = node.querySelector("[data-markdown-target='content']");
    const renderedEl = node.querySelector("[data-markdown-target='renderedContent']");
    const enableMarkdownStyle = () => renderedEl?.classList.add("chat-message");
    const disableMarkdownStyle = () => renderedEl?.classList.remove("chat-message");

    if (status === "error") {
      roundEl?.classList.remove("ai-chat-assistant-round--loading");
      roundEl?.setAttribute("aria-busy", "false");
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

    const isLoading = status === "status" || (status === "streaming" && !content);
    roundEl?.classList.toggle("ai-chat-assistant-round--loading", isLoading);
    roundEl?.setAttribute("aria-busy", isLoading ? "true" : "false");

    if (status === "canceled" || status === "status") {
      if (contentEl) contentEl.textContent = "";
      if (renderedEl) {
        disableMarkdownStyle();
        renderedEl.innerHTML = this.#renderStatusHtml(content);
      }
      return;
    }

    if (content) {
      enableMarkdownStyle();
      if (contentEl) contentEl.textContent = content;
      this.#triggerMarkdown(markdownRoot);
    } else if (renderedEl) {
      disableMarkdownStyle();
      renderedEl.innerHTML = this.#renderStatusHtml(this.#defaultThinkingLabel());
    }
  }

  #defaultThinkingLabel() {
    return this.messagesValue?.thinking_status || this.messagesValue?.thinking || "";
  }

  #renderStatusHtml(text) {
    const label = (text || this.#defaultThinkingLabel()).trim();
    if (this.hasStatusMessageTemplateTarget) {
      const tpl = this.statusMessageTemplateTarget.content.cloneNode(true);
      const textEl = tpl.querySelector(".ai-chat-status-text");
      if (textEl) textEl.textContent = label;
      const mount = document.createElement("div");
      mount.appendChild(tpl);
      return mount.innerHTML;
    }

    return `<div class="ai-chat-status flex items-center gap-2 text-[0.875rem] leading-[1.65] text-base-content/60" role="status" aria-live="polite"><span class="loading loading-spinner loading-xs shrink-0 text-primary" aria-hidden="true"></span><span class="ai-chat-status-text">${this.escapeHTML(label)}</span></div>`;
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
    this.element.querySelectorAll(".style-one-ai-empty-hint").forEach((el) => {
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

  async #resendRound(idx) {
    const round = this.chatHistory[idx];
    if (!round?.user) return;
    if (this.isStreaming) this.stopStreaming();

    await this.#ensureChatId();

    const resendMessageId = round.assistantMessageId || round.userMessageId;
    round.ai = "";
    round.status = "streaming";
    round.assistantMessageId = null;
    this.#removeLastAssistantRound();
    this.appendAssistantMessage("", "streaming", idx);

    if (resendMessageId && this.chatIdValue) {
      this.#streamAssistant(null, idx, { replaceLastAssistant: true, resendMessageId });
      return;
    }

    this.#streamAssistant(round.user, idx, { replaceLastAssistant: true });
  }

  #buildStreamUrl({ message, resendMessageId }) {
    const base = (this.url || "").replace(/\/$/, "");
    const params = new URLSearchParams();
    const query = this.hasQueryValue ? this.queryValue : {};

    let streamUrl = base;
    if (this.chatIdValue) {
      streamUrl = `${base}/${this.chatIdValue}`;
    }

    if (resendMessageId) {
      params.append("message_id", String(resendMessageId));
    } else if (message) {
      params.append("message", message);
    }

    Object.entries(query).forEach(([key, value]) => {
      if (value != null && value !== "") params.append(`query[${key}]`, value);
    });

    const qs = params.toString();
    return qs ? `${streamUrl}?${qs}` : streamUrl;
  }

  #assignMessageIdsFromSSE(data, idx) {
    const round = this.chatHistory[idx];
    if (!round) return;

    if (data.user_message_id) round.userMessageId = String(data.user_message_id);
    if (data.assistant_message_id) round.assistantMessageId = String(data.assistant_message_id);
    if (!round.assistantMessageId && data.message_id) {
      round.assistantMessageId = String(data.message_id);
    }

    this.#syncRoundMessageIdsToDom(idx, round);
  }

  #syncRoundMessageIdsToDom(idx, round) {
    this.messagesTargets.forEach((container) => {
      const userRounds = container.querySelectorAll(".ai-chat-user-round");
      const assistantRounds = container.querySelectorAll(".ai-chat-assistant-round");
      const userEl = userRounds[idx];
      const assistantEl = assistantRounds[idx];

      if (userEl && round.userMessageId) {
        userEl.dataset.userMessageId = round.userMessageId;
      }
      if (assistantEl && round.assistantMessageId) {
        assistantEl.dataset.assistantMessageId = round.assistantMessageId;
      }
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
