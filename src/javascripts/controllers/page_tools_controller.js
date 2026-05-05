import { Controller } from "@hotwired/stimulus";
import { copyToClipboard } from "../utils/copyToClipboard";

export default class extends Controller {
  static values = {
    markdownUrl: { type: String, default: "" },
    mcpName: { type: String, default: "" },
    mcpUrl: { type: String, default: "" }, // 例如：https://www.baklib.com/-/mcp
    llmPrompt: { type: String, default: "" }
  };

  async copyMcpCommand(event) {
    event?.preventDefault();
    const command = `npx add-mcp ${this.mcpUrlValue} -g`;
    await copyToClipboard(command);
  }

  openExternal(event) {
    event?.preventDefault();
    const provider = event?.params?.provider;
    const targetUrl = this.buildExternalUrl(provider);
    if (!targetUrl) return;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  buildExternalUrl(provider) {
    switch (provider) {
      case "chatgpt": {
        const url = new URL("https://chat.openai.com/");
        url.searchParams.set("hints", "search");
        url.searchParams.set("prompt", this.llmPromptValue);
        return url.toString();
      }
      case "claude": {
        const url = new URL("https://claude.ai/new");
        url.searchParams.set("q", this.llmPromptValue);
        return url.toString();
      }
      case "cursor":
        return this.buildCursorDeeplink();
      case "vscode":
        return this.buildVsCodeDeeplink();
      default:
        return null;
    }
  }

  buildCursorDeeplink() {
    const config = {
      name: this.mcpNameValue,
      url: this.mcpUrlValue,
    };
    const json = JSON.stringify(config);
    const base64Config = btoa(unescape(encodeURIComponent(json)));
    const deeplink = new URL("cursor://anysphere.cursor-deeplink/mcp/install");
    deeplink.searchParams.set("name", this.mcpNameValue);
    deeplink.searchParams.set("config", base64Config);
    return deeplink.toString();
  }

  buildVsCodeDeeplink() {
    const config = {
      name: this.mcpNameValue,
      url: this.mcpUrlValue,
    };
    return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
  }
}
