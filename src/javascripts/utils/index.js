/**
 * URL 查询参数：从 ?query 解析为普通对象（扁平键）
 */
function parseSearchParams(search) {
  if (!search) return {};
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

/**
 * URL 地址组装函数
 * @param {string} originalUrl - 原始 URL（可能是完整的 URL、path，后面可能会有参数）
 * @param {object} params - 需要修改的参数 hash
 * @param {boolean} isOverride - 是否直接覆盖 url 中参数，默认 false：与现有参数合并
 * @param {boolean} isRemoveEmpty - 是否移除空值参数，默认 true
 * @returns {string} 组装后的 URL
 */
export function buildUrl(originalUrl, params = {}, isOverride = false, isRemoveEmpty = true) {
  if (!originalUrl) {
    return "";
  }

  const url = new URL(originalUrl, window.location.origin);
  const existingParams = parseSearchParams(url.search);

  const mergedParams = isOverride ? { ...params } : { ...existingParams, ...params };

  if (isRemoveEmpty) {
    Object.keys(mergedParams).forEach((key) => {
      const v = mergedParams[key];
      if (v === null || v === undefined || v === "") {
        delete mergedParams[key];
      }
    });
  }

  const sp = new URLSearchParams();
  Object.entries(mergedParams).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") {
      sp.set(k, String(v));
    }
  });
  url.search = sp.toString();

  return url.toString();
}

/**
 * 更新当前页面的 URL 查询参数，不触发页面重新加载
 * @param {object} params - 需要更新的参数 hash
 * @param {string} action - 更新方式，默认是 'push'，也可以是 'replace'
 * @param {boolean} isOverride - 是否直接覆盖原始 params，默认是 false
 */
export function updateQuery(params, action = "push", isOverride = true) {
  const url = new URL(window.location.href);

  let mergedParams = {};
  if (!isOverride) {
    mergedParams = parseSearchParams(url.search);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      delete mergedParams[key];
    } else {
      mergedParams[key] = value;
    }
  });

  const sp = new URLSearchParams();
  Object.entries(mergedParams).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") {
      sp.set(k, String(v));
    }
  });
  url.search = sp.toString();

  if (action === "push") {
    history.pushState({}, "", url);
  } else {
    history.replaceState({}, "", url);
  }
}

/**
 * 通过传入的 URL 获取查询参数，并返回一个对象
 * @param {string} urlString - 需要获取查询参数的 URL
 * @returns {object} 查询参数对象
 */
export function getQueryParams(urlString) {
  if (!urlString) {
    return {};
  }

  const url = new URL(urlString, window.location.origin);
  return Object.fromEntries(url.searchParams.entries());
}

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "application/json": "json",
  "application/zip": "zip",
};

/**
 * 根据文件名和 content_type 生成完整的文件名（如果没有后缀则添加）
 * @param {string} filename - 文件名
 * @param {string} contentType - MIME 类型（如 'image/jpeg', 'application/pdf'）
 * @returns {string} 完整的文件名（如果原文件名没有后缀且提供了 content_type，则添加扩展名）
 */
export function getFilenameWithExtension(filename, contentType) {
  if (!filename) {
    return filename;
  }

  const hasExtension = /\.\w+$/.test(filename);
  if (hasExtension) {
    return filename;
  }

  if (contentType) {
    const mimeType = contentType.split(";")[0].trim();
    let extension = MIME_EXTENSION_MAP[mimeType];
    if (!extension) {
      const sub = mimeType.split("/")[1];
      if (sub && !sub.includes("+")) {
        extension = sub.replace(/^x-/, "").replace(/[^a-z0-9]/gi, "");
      }
    }
    if (extension) {
      return `${filename}.${extension}`;
    }
  }

  return filename;
}
