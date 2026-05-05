import { marked } from "marked";
import { Controller } from "@hotwired/stimulus";

// 配置 marked 使所有链接在新窗口打开
marked.setOptions({
  renderer: new marked.Renderer(),
});

marked.use({
  renderer: {
    link({ href, text }) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
  }
});

export default class extends Controller {
  static targets = [
    "messages", "error", "input", "send",
    "userMessageTemplate", "assistantMessageTemplate",
    "retryButton"
  ];
  static classes = ["hidden"];
  static values = {
    url: String,
    timeout: Number,
    autoSubmit: { type: Boolean, default: false },
    message: String,
    messages: Object
  };

  connect() {
    console.log('[AIChat] connect');
    this.isStreaming = false;
    this.chatHistory = [];
    this.currentRound = null;
    this.renderChatHistoryOnce();
  }

  disconnect() {
    console.log('[AIChat] disconnect');
    this.stopStreaming();
  }

  inputTargetConnected(element) {
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        console.log('[AIChat] inputTargetConnected: Enter pressed');
        this.#sendUserMessage();
      }
    });
  }

  sendTargetConnected(element) {
    element.addEventListener("click", (event) => {
      console.log('[AIChat] sendTargetConnected: click');
      this.#sendUserMessage();
    });
  }

  messageValueChanged() {
    this.autoSubmitValue && this.messageValue && this.#delayAutoSubmit();
  }

  #delayAutoSubmit() {
    if (this.delayAutoSubmitTimer) {
      clearTimeout(this.delayAutoSubmitTimer);
    }
    this.delayAutoSubmitTimer = setTimeout(() => {
      if (this.messageValue) {
        this.sendMessage(this.messageValue);
      }
    }, 500);
  }

  #sendUserMessage() {
    const message = this.inputTarget.value;
    console.log('[AIChat] #sendUserMessage', message);
    if (!message) {
      return;
    }
    this.inputTarget.value = "";
    this.sendMessage(message);
  }

  async chat(event) {
    const { message } = event.params;
    this.sendMessage(message);
  }

  addUserMessage(message) {
    console.log('[AIChat] addUserMessage', message);
    this.currentRound = {
      user: message,
      ai: '',
      status: 'streaming',
      retry: null
    };
    this.chatHistory.push(this.currentRound);
    this.appendUserMessage(message);
    this.appendAssistantMessage('', 'streaming', this.chatHistory.length - 1);
  }

  // 渲染所有历史消息（页面初始化或重试时可用）
  renderChatHistoryOnce() {
    if (!this.hasMessagesTarget) return;
    this.messagesTarget.innerHTML = "";
    this.chatHistory.forEach((round, idx) => {
      this.appendUserMessage(round.user);
      this.appendAssistantMessage(round.ai, round.status, idx, round.retry);
    });
    this.scrollToBottom(true);
  }

  // 追加用户消息
  appendUserMessage(content) {
    console.log('[AIChat] appendUserMessage', content);
    if (!this.hasUserMessageTemplateTarget) return;
    const tpl = this.userMessageTemplateTarget.content.cloneNode(true);
    tpl.querySelector('.ai-user-message').textContent = content;
    this.messagesTarget.appendChild(tpl);
    this.scrollToBottom(true);
  }

  // 追加AI消息
  appendAssistantMessage(content, status, idx, retryFn) {
    console.log('[AIChat] appendAssistantMessage', content, status, idx);
    if (!this.hasAssistantMessageTemplateTarget) return;
    let forceScroll = true
    const tpl = this.assistantMessageTemplateTarget.content.cloneNode(true);
    const msgSpan = tpl.querySelector('.ai-assistant-message');
    if (status === 'error') {
      const button = this.retryButton
      button.dataset.idx = idx
      msgSpan.innerHTML = `<span class='bkt-text-red-500'>${this.escapeHTML(content)}</span> ${button.outerHTML}`;
      if (retryFn) {
        setTimeout(() => {
          const btns = this.messagesTarget.querySelectorAll(`[data-idx='${idx}']`);
          const btn = btns[btns.length - 1];
          if (btn) {
            btn.onclick = () => retryFn();
          }
        }, 0);
      }
    } else if (content) {
      msgSpan.innerHTML = marked(content);
      forceScroll = false;
    } else {
      msgSpan.innerHTML = `<span class="bkt-text-gray-400">${this.messagesValue.thinking}</span>`;
    }
    this.messagesTarget.appendChild(tpl);
    // 绑定重试
    if (status === 'error' && retryFn) {
      setTimeout(() => {
        const btns = this.messagesTarget.querySelectorAll(`[data-idx='${idx}']`);
        const btn = btns[btns.length - 1];
        if (btn) {
          btn.onclick = () => retryFn();
        }
      }, 0);
    }
    this.scrollToBottom(forceScroll);
  }

  // 只更新当前AI消息内容（流式追加/重试/超时）
  updateCurrentAssistantMessage(content, status, idx, retryFn) {
    console.log('[AIChat] updateCurrentAssistantMessage', content, status, idx);
    const msgSpans = this.messagesTarget.querySelectorAll('.ai-assistant-message');
    const msgSpan = msgSpans[msgSpans.length - 1];
    if (!msgSpan) {
      console.warn('[AIChat] updateCurrentAssistantMessage: no msgSpan found');
      return;
    }
    if (status === 'error') {
      const button = this.retryButton
      button.dataset.idx = idx
      msgSpan.innerHTML = `<span class='bkt-text-red-500'>${this.escapeHTML(content)}</span> ${button.outerHTML}`;
      if (retryFn) {
        setTimeout(() => {
          const btn = this.messagesTarget.querySelector(`[data-idx='${idx}']`);
          if (btn) {
            btn.onclick = () => retryFn();
          }
        }, 0);
      }
    } else if (status === 'canceled') {
      msgSpan.innerHTML = `<span class="bkt-text-gray-400">${this.messagesValue.canceled}</span>`;
    } else if (content) {
      msgSpan.innerHTML = marked(content);
    } else {
      msgSpan.innerHTML = `<span class="bkt-text-gray-400">${this.messagesValue.thinking}</span>`;
    }
    this.scrollToBottom();
  }

  async sendMessage(message) {
    console.log('[AIChat] sendMessage', message);
    if (!message || !this.url) {
      console.warn('[AIChat] sendMessage: invalid params', message, this.url);
      return;
    }
    if (this.isStreaming) {
      this.updateCurrentAssistantMessage(this.currentRound.ai, 'canceled', this.chatHistory.length - 1);
      this.stopStreaming();
    }
    this.addUserMessage(message);
    this.isStreaming = true;
    this.currentRound.ai = '';
    this.currentRound.status = 'streaming';
    const idx = this.chatHistory.length - 1;
    this.updateCurrentAssistantMessage('', 'streaming', idx);
    const params = new URLSearchParams({ message });
    this.eventSource = new EventSource(`${this.url}?${params.toString()}`);
    this.startTimeoutTimer();
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      data.message ||= ''
      console.log('[AIChat] eventSource.onmessage', data);
      this.resetTimeoutTimer();
      if (data.status === "system") {
        // 系统消息，直接显示，不做拼接
        this.currentRound.ai = data.message;
        this.currentRound.status = 'system';
        this.updateCurrentAssistantMessage(this.currentRound.ai, 'system', idx);
      } else if (data.status === "streaming") {
        // 如果上一个状态是 system，切换到 streaming，清空内容
        if (this.currentRound.status !== 'streaming') {
          this.currentRound.ai = '';
        }
        this.currentRound.status = 'streaming';
        this.currentRound.ai += data.message;
        this.updateCurrentAssistantMessage(this.currentRound.ai, 'streaming', idx);
      } else if (data.status === "completed") {
        this.currentRound.ai += data.message;
        this.currentRound.status = 'completed';
        this.isStreaming = false;
        this.eventSource.close();
        this.clearTimeoutTimer();
        // 在AI回答结束后添加一句话, 提示用户联系人工客服或者提交问题
        this.currentRound.ai += this.messagesValue.completed;
        this.updateCurrentAssistantMessage(this.currentRound.ai, 'completed', idx);
      } else if (data.status === "error") {
        this.currentRound.ai = data.message;
        this.currentRound.status = 'error';
        this.isStreaming = false;
        this.eventSource.close();
        this.clearTimeoutTimer();
        this.currentRound.retry = () => {
          console.log('[AIChat] retry', idx);
          this.currentRound.status = 'streaming';
          this.currentRound.ai = '';
          this.appendAssistantMessage('', 'streaming', idx);
          this.updateCurrentAssistantMessage('', 'streaming', idx);
          this.sendMessage(this.currentRound.user);
        };
        this.updateCurrentAssistantMessage(this.currentRound.ai, 'error', idx, this.currentRound.retry);
      }
    };
    this.eventSource.onerror = (event) => {
      console.error('[AIChat] eventSource.onerror', event);
      this.eventSource.close();
      this.isStreaming = false;
      this.currentRound.status = 'error';
      this.currentRound.ai = '网络错误，请重试';
      this.currentRound.retry = () => {
        console.log('[AIChat] retry (onerror)', idx);
        this.currentRound.status = 'streaming';
        this.currentRound.ai = '';
        this.appendAssistantMessage('', 'streaming', idx);
        this.updateCurrentAssistantMessage('', 'streaming', idx);
        this.sendMessage(this.currentRound.user);
      };
      this.clearTimeoutTimer();
      this.updateCurrentAssistantMessage(this.currentRound.ai, 'error', idx, this.currentRound.retry);
    };
  }

  stopStreaming() {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (error) { }
    }
    this.isStreaming = false;
    this.clearTimeoutTimer();
    if (this.hasErrorTarget) {
      this.errorTarget.classList.add(...this.hiddenClasses);
    }
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c];
    });
  }

  startTimeoutTimer() {
    if (!this.hasTimeoutValue) return
    this.timeoutTimer = setTimeout(() => {
      if (this.currentRound) {
        this.currentRound.status = 'error';
        this.currentRound.ai = '响应超时，请重试';
        const idx = this.chatHistory.length - 1;
        this.currentRound.retry = () => {
          this.currentRound.status = 'streaming';
          this.currentRound.ai = '';
          this.updateCurrentAssistantMessage('', 'streaming', idx);
          this.sendMessage(this.currentRound.user);
        };
        this.updateCurrentAssistantMessage(this.currentRound.ai, 'error', idx, this.currentRound.retry);
      }
      this.eventSource && this.eventSource.close();
      this.isStreaming = false;
    }, this.timeoutValue * 1000);
  }

  clearTimeoutTimer() {
    if (!this.hasTimeoutValue || !this.timeoutTimer) return
    clearTimeout(this.timeoutTimer);
  }

  resetTimeoutTimer() {
    this.clearTimeoutTimer();
    this.startTimeoutTimer();
  }

  scrollToBottom(force = false) {
    if (!this.hasMessagesTarget) return;
    const el = this.messagesTarget;
    // 判断是否在底部（30px 容忍区间）
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (force || isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }

  get url() {
    return this.hasUrlValue ? this.urlValue : null;
  }

  get retryButton() {
    if (this.hasRetryButtonTarget) {
      return this.retryButtonTarget;
    } else {
      const button = document.createElement('button');
      button.classList.add("bkt-size-4", "bkt-text-gray-600")
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="bkt-size-full" viewBox="0 0 24 24" fill="currentColor"><path d="M5.46257 4.43262C7.21556 2.91688 9.5007 2 12 2C17.5228 2 22 6.47715 22 12C22 14.1361 21.3302 16.1158 20.1892 17.7406L17 12H20C20 7.58172 16.4183 4 12 4C9.84982 4 7.89777 4.84827 6.46023 6.22842L5.46257 4.43262ZM18.5374 19.5674C16.7844 21.0831 14.4993 22 12 22C6.47715 22 2 17.5228 2 12C2 9.86386 2.66979 7.88416 3.8108 6.25944L7 12H4C4 16.4183 7.58172 20 12 20C14.1502 20 16.1022 19.1517 17.5398 17.7716L18.5374 19.5674Z"></path></svg>`
      return button;
    }
  }
}
