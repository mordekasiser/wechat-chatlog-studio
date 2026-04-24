const state = {
  status: null,
  sessions: [],
  contacts: [],
  selectedAccountId: null,
  selectedChat: null,
  chat: null,
  chatError: null,
  query: "",
  preparing: false,
  loadingOlder: false,
  activeTask: null,
  loadingChat: false,
  sidebarRequestId: 0,
  chatRequestId: 0,
  toastTimer: null,
  accountDirDraft: "",
  outputBaseDraft: "",
  applyingAccountDir: false,
  browsingAccountDir: false,
  applyingOutputBase: false,
  browsingOutputBase: false,
  controlFeedback: null,
};

const elements = {
  prepareButton: document.querySelector("#prepare-button"),
  forcePrepareButton: document.querySelector("#force-prepare-button"),
  progressCard: document.querySelector("#progress-card"),
  progressLabel: document.querySelector("#progress-label"),
  progressPercent: document.querySelector("#progress-percent"),
  progressBar: document.querySelector("#progress-bar"),
  controlFeedback: document.querySelector("#control-feedback"),
  accountDirInput: document.querySelector("#account-dir-input"),
  accountDirNote: document.querySelector("#account-dir-note"),
  browseAccountButton: document.querySelector("#browse-account-button"),
  applyAccountButton: document.querySelector("#apply-account-button"),
  resetAccountButton: document.querySelector("#reset-account-button"),
  outputBaseInput: document.querySelector("#output-base-input"),
  outputBaseNote: document.querySelector("#output-base-note"),
  browseOutputButton: document.querySelector("#browse-output-button"),
  applyOutputButton: document.querySelector("#apply-output-button"),
  resetOutputButton: document.querySelector("#reset-output-button"),
  searchStatus: document.querySelector("#search-status"),
  accountSelect: document.querySelector("#account-select"),
  searchInput: document.querySelector("#search-input"),
  weixinState: document.querySelector("#weixin-state"),
  readyState: document.querySelector("#ready-state"),
  sidebarList: document.querySelector("#sidebar-list"),
  statusNote: document.querySelector("#status-note"),
  contactsCount: document.querySelector("#contacts-count"),
  sessionsCount: document.querySelector("#sessions-count"),
  exportsCount: document.querySelector("#exports-count"),
  dbCount: document.querySelector("#db-count"),
  conversationTitle: document.querySelector("#conversation-title"),
  conversationSubtitle: document.querySelector("#conversation-subtitle"),
  conversationBanner: document.querySelector("#conversation-banner"),
  messageStream: document.querySelector("#message-stream"),
  exportButton: document.querySelector("#export-button"),
  loadFullButton: document.querySelector("#load-full-button"),
  inspectorTitle: document.querySelector("#inspector-title"),
  inspectorSubtitle: document.querySelector("#inspector-subtitle"),
  inspectorStats: document.querySelector("#inspector-stats"),
  inspectorMediaLabel: document.querySelector("#inspector-media-label"),
  inspectorMediaGrid: document.querySelector("#inspector-media-grid"),
  inspectorLinkLabel: document.querySelector("#inspector-link-label"),
  inspectorLinkList: document.querySelector("#inspector-link-list"),
  toast: document.querySelector("#toast"),
};

document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  bootstrap().catch((error) => {
    showToast(error.message || "Failed to start Chatlog Studio.");
  });
});

function invalidateChatContext() {
  state.chatRequestId += 1;
  state.selectedChat = null;
  state.chat = null;
  state.chatError = null;
  state.loadingChat = false;
}

function wireEvents() {
  elements.prepareButton.addEventListener("click", () => {
    prepareLocalData(false).catch((error) => showToast(error.message));
  });

  elements.forcePrepareButton.addEventListener("click", () => {
    const confirmed = window.confirm("这会清空本工具生成的解密缓存和图片缓存，然后从本机微信数据重新识别。原始微信数据库不会被修改。继续吗？");
    if (!confirmed) {
      return;
    }
    prepareLocalData(true).catch((error) => showToast(error.message));
  });

  elements.accountDirInput.addEventListener("input", (event) => {
    state.accountDirDraft = event.target.value;
    renderAccountDirConfig();
  });

  elements.accountDirInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    applyWechatRoot(state.accountDirDraft).catch((error) => showToast(error.message));
  });

  elements.browseAccountButton.addEventListener("click", () => {
    browseWechatRoot().catch((error) => showToast(error.message));
  });

  elements.applyAccountButton.addEventListener("click", () => {
    applyWechatRoot(state.accountDirDraft).catch((error) => showToast(error.message));
  });

  elements.resetAccountButton.addEventListener("click", () => {
    applyWechatRoot("").catch((error) => showToast(error.message));
  });

  elements.outputBaseInput.addEventListener("input", (event) => {
    state.outputBaseDraft = event.target.value;
    renderOutputBaseConfig();
  });

  elements.outputBaseInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    applyOutputBase(state.outputBaseDraft).catch((error) => showToast(error.message));
  });

  elements.browseOutputButton.addEventListener("click", () => {
    browseOutputBase().catch((error) => showToast(error.message));
  });

  elements.applyOutputButton.addEventListener("click", () => {
    applyOutputBase(state.outputBaseDraft).catch((error) => showToast(error.message));
  });

  elements.resetOutputButton.addEventListener("click", () => {
    applyOutputBase("").catch((error) => showToast(error.message));
  });

  elements.accountSelect.addEventListener("change", async (event) => {
    try {
      state.selectedAccountId = event.target.value || null;
      invalidateChatContext();
      setControlFeedback("正在切换账号上下文…", "info");
      await refreshStatus();
      await refreshSidebar();
      await loadBestInitialChat();
      clearControlFeedback();
    } catch (error) {
      setControlFeedback(error.message || "切换账号失败", "error");
      showToast(error.message || "切换账号失败");
    }
  });

  let searchTimer = null;
  elements.searchInput.addEventListener("input", (event) => {
    window.clearTimeout(searchTimer);
    state.query = event.target.value.trim();
    searchTimer = window.setTimeout(() => {
      refreshSidebar().catch((error) => showToast(error.message));
    }, 180);
  });

  elements.sidebarList.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-chat-username]");
    if (!trigger) {
      return;
    }
    const username = trigger.getAttribute("data-chat-username");
    if (!username) {
      return;
    }
    state.selectedChat = username;
    loadChat(username, false).catch((error) => showToast(error.message));
  });

  elements.exportButton.addEventListener("click", () => {
    if (!state.selectedChat) {
      return;
    }
    exportCurrentChat().catch((error) => showToast(error.message));
  });

  elements.loadFullButton.addEventListener("click", () => {
    if (!state.selectedChat || !state.chat?.hasMore) {
      return;
    }
    loadOlderMessages().catch((error) => showToast(error.message));
  });

  elements.inspectorMediaGrid.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-jump-local-id]");
    if (!trigger) {
      return;
    }
    event.preventDefault();
    const localId = trigger.getAttribute("data-jump-local-id");
    if (!localId) {
      return;
    }
    jumpToMessage(localId);
  });
}

async function bootstrap() {
  try {
    await refreshStatus();
    await refreshSidebar();
    await loadBestInitialChat();
  } catch (error) {
    setControlFeedback(error.message || "初始化失败", "error");
    throw error;
  }
}

async function refreshStatus() {
  const params = new URLSearchParams();
  if (state.selectedAccountId) {
    params.set("account", state.selectedAccountId);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await fetchJson(`/api/status${suffix}`);
  state.status = payload;
  state.selectedAccountId = payload.selectedAccountId || null;
  state.accountDirDraft = payload.manualSourcePath || "";
  state.outputBaseDraft = payload.outputBase || "";
  renderStatus();
}

async function refreshSidebar() {
  if (!state.status?.prepared) {
    invalidateChatContext();
    state.sessions = [];
    state.contacts = [];
    renderSidebar();
    renderConversation();
    renderSearchStatus();
    return;
  }

  const requestId = ++state.sidebarRequestId;
  const params = new URLSearchParams();
  params.set("account", state.selectedAccountId || "");
  if (state.query) {
    params.set("query", state.query);
  }

  const sessionPromise = fetchJson(`/api/sessions?${params.toString()}`);
  const contactPromise = state.query
    ? fetchJson(`/api/contacts?${params.toString()}`)
    : Promise.resolve({ items: [] });

  const [sessionPayload, contactPayload] = await Promise.all([sessionPromise, contactPromise]);
  if (requestId !== state.sidebarRequestId) {
    return;
  }

  state.sessions = sessionPayload.items || [];
  state.contacts = dedupeContacts(contactPayload.items || [], state.sessions);
  renderSidebar();
  renderSearchStatus();
}

async function loadBestInitialChat() {
  if (!state.status?.prepared) {
    renderConversation();
    return;
  }

  const available = new Set([
    ...state.sessions.map((item) => item.username),
    ...state.contacts.map((item) => item.username),
  ]);

  if (state.selectedChat && available.has(state.selectedChat)) {
    await loadChat(state.selectedChat, false);
    return;
  }

  const firstChat = state.sessions[0]?.username || state.contacts[0]?.username || null;
  state.selectedChat = firstChat;
  if (firstChat) {
    await loadChat(firstChat, false);
    return;
  }
  invalidateChatContext();
  renderConversation();
}

async function prepareLocalData(force) {
  state.preparing = true;
  state.activeTask = {
    status: "queued",
    current: 0,
    total: 1,
    percent: 0,
    message: force ? "准备清空缓存并重新识别" : "正在检查本地缓存",
  };
  renderActionState();
  setControlFeedback(force ? "正在清理旧缓存并重建…" : "正在检查并准备本地缓存…", "info");
  showToast(force ? "正在清空缓存并重新准备数据。" : "正在准备本地数据，已有缓存会直接复用。");

  try {
    const task = await fetchJson("/api/tasks/prepare", {
      method: "POST",
      body: JSON.stringify({ account: state.selectedAccountId, force }),
    });
    const payload = await pollTask(task.taskId);
    if (payload.status !== "succeeded") {
      throw new Error(payload.error || "Prepare task failed.");
    }

    state.activeTask = payload;
    state.status = payload.result.status;
    state.selectedAccountId = payload.result.status.selectedAccountId || null;
    renderStatus();
    await refreshSidebar();
    await loadBestInitialChat();
    setControlFeedback(payload.result.usedCache ? "已复用本地缓存，可直接浏览和导出。" : "准备完成，现在可以浏览会话和导出记录。", "success");
    showToast(payload.result.usedCache ? "已复用本地缓存。" : `已准备 ${payload.result.decryptedFiles.length} 个数据库文件。`);
  } catch (error) {
    state.activeTask = {
      ...(state.activeTask || {}),
      status: "failed",
      message: error.message || "准备任务失败",
      error: error.message || "准备任务失败",
    };
    renderActionState();
    setControlFeedback(error.message || "准备任务失败", "error");
    throw error;
  } finally {
    state.preparing = false;
    renderActionState();
  }
}

async function pollTask(taskId) {
  while (true) {
    const payload = await fetchJson(`/api/tasks/${encodeURIComponent(taskId)}`);
    state.activeTask = payload;
    renderActionState();
    if (payload.status === "succeeded" || payload.status === "failed") {
      return payload;
    }
    await sleep(650);
  }
}

async function loadChat(username, full, options = {}) {
  const requestId = ++state.chatRequestId;
  const prepend = Boolean(options.prepend);
  const previousHeight = elements.messageStream.scrollHeight;
  state.chatError = null;
  if (!prepend) {
    state.chat = null;
  }
  state.loadingChat = !prepend;
  state.loadingOlder = prepend;
  renderConversation();

  try {
    const params = new URLSearchParams();
    params.set("account", state.selectedAccountId || "");
    if (full) {
      params.set("full", "1");
    }
    if (options.beforeCreateTime && options.beforeLocalId) {
      params.set("beforeCreateTime", String(options.beforeCreateTime));
      params.set("beforeLocalId", String(options.beforeLocalId));
    }

    const payload = await fetchJson(`/api/chat/${encodeURIComponent(username)}?${params.toString()}`);
    if (requestId !== state.chatRequestId) {
      return;
    }
    if (prepend && state.chat?.contact?.username === payload.contact.username) {
      state.chat = {
        ...payload,
        messages: [...payload.messages, ...state.chat.messages],
        returnedMessages: payload.messages.length + state.chat.messages.length,
      };
    } else {
      state.chat = payload;
    }
    state.selectedChat = payload.contact.username;
    state.loadingChat = false;
    state.loadingOlder = false;
    state.chatError = null;
    renderSidebar();
    renderConversation();
    if (prepend) {
      elements.messageStream.scrollTop = elements.messageStream.scrollHeight - previousHeight;
    } else {
      elements.messageStream.scrollTop = elements.messageStream.scrollHeight;
    }
  } catch (error) {
    if (requestId !== state.chatRequestId) {
      return;
    }
    state.loadingChat = false;
    state.loadingOlder = false;
    if (!prepend) {
      state.chat = null;
      state.chatError = error.message || "聊天内容载入失败";
    }
    renderConversation();
    throw error;
  }
}

async function loadOlderMessages() {
  const chat = state.chat;
  if (!state.selectedChat || !chat?.hasMore || !chat.nextBeforeCreateTime || !chat.nextBeforeLocalId) {
    return;
  }
  await loadChat(state.selectedChat, false, {
    prepend: true,
    beforeCreateTime: chat.nextBeforeCreateTime,
    beforeLocalId: chat.nextBeforeLocalId,
  });
}

async function exportCurrentChat() {
  const payload = await fetchJson("/api/export", {
    method: "POST",
    body: JSON.stringify({
      account: state.selectedAccountId,
      query: state.selectedChat,
    }),
  });
  setControlFeedback(`已导出 ${payload.contact.displayName}，文件位于 ${payload.outputPath}`, "success");
  showToast(`Exported ${payload.contact.displayName} to ${payload.outputPath}`);
  await refreshStatus();
}

async function browseWechatRoot() {
  state.browsingAccountDir = true;
  renderAccountDirConfig();
  try {
    const payload = await fetchJson("/api/wechat-root/browse", {
      method: "POST",
      body: JSON.stringify({
        initialDir: state.accountDirDraft || state.status?.manualSourcePath || state.status?.xwechatRoot || "",
      }),
    });
    if (!payload.path) {
      return;
    }
    state.accountDirDraft = payload.path;
    renderAccountDirConfig();
  } finally {
    state.browsingAccountDir = false;
    renderAccountDirConfig();
  }
}

async function applyWechatRoot(sourceDir) {
  state.applyingAccountDir = true;
  renderAccountDirConfig();
  try {
    setControlFeedback(sourceDir ? "正在更新微信文件目录…" : "正在恢复自动发现…", "info");
    const payload = await fetchJson("/api/wechat-root", {
      method: "POST",
      body: JSON.stringify({
        sourceDir,
      }),
    });
    state.status = payload;
    state.selectedAccountId = payload.selectedAccountId || null;
    state.accountDirDraft = payload.manualSourcePath || "";
    invalidateChatContext();
    renderStatus();
    await refreshSidebar();
    await loadBestInitialChat();
    const message = payload.manualSourcePath
      ? `微信文件目录已切换到 ${payload.manualSourcePath}`
      : "已恢复自动发现微信文件目录";
    setControlFeedback(message, "success");
    showToast(message);
  } finally {
    state.applyingAccountDir = false;
    renderAccountDirConfig();
  }
}

async function browseOutputBase() {
  state.browsingOutputBase = true;
  renderOutputBaseConfig();
  try {
    const payload = await fetchJson("/api/output-base/browse", {
      method: "POST",
      body: JSON.stringify({
        initialDir: state.status?.outputBase || "",
      }),
    });
    if (!payload.path) {
      return;
    }
    state.outputBaseDraft = payload.path;
    renderOutputBaseConfig();
  } finally {
    state.browsingOutputBase = false;
    renderOutputBaseConfig();
  }
}

async function applyOutputBase(outputBase) {
  state.applyingOutputBase = true;
  renderOutputBaseConfig();
  try {
    setControlFeedback("正在更新输出目录…", "info");
    const payload = await fetchJson("/api/output-base", {
      method: "POST",
      body: JSON.stringify({
        outputBase,
      }),
    });
    state.status = payload;
    state.selectedAccountId = payload.selectedAccountId || null;
    state.outputBaseDraft = payload.outputBase || "";
    invalidateChatContext();
    renderStatus();
    await refreshSidebar();
    await loadBestInitialChat();
    setControlFeedback(`输出目录已切换到 ${payload.outputBase}`, "success");
    showToast(`输出目录已切换到 ${payload.outputBase}`);
  } finally {
    state.applyingOutputBase = false;
    renderOutputBaseConfig();
  }
}

function renderStatus() {
  const status = state.status;
  const stats = status?.stats || {};
  renderActionState();
  renderAccountDirConfig();
  renderOutputBaseConfig();
  renderSearchStatus();

  elements.weixinState.textContent = status?.hasRunningWeixin ? "已登录" : "未打开";
  elements.readyState.textContent = status?.prepared ? "已就绪" : "待准备";
  elements.contactsCount.textContent = formatNumber(stats.contacts || 0);
  elements.sessionsCount.textContent = formatNumber(stats.sessions || 0);
  elements.exportsCount.textContent = formatNumber(stats.exports || 0);
  elements.dbCount.textContent = formatNumber(stats.decryptedFiles || 0);
  elements.statusNote.textContent = buildStatusNote(status);

  renderAccountOptions();
}

function renderActionState() {
  elements.prepareButton.disabled = state.preparing;
  elements.forcePrepareButton.disabled = state.preparing;
  elements.prepareButton.textContent = state.preparing ? "准备中..." : "使用本地缓存 / 准备数据";
  const task = state.activeTask;
  const visibleTask = task && (task.status === "running" || task.status === "queued" || task.status === "failed");
  elements.progressCard.hidden = !visibleTask;
  if (task) {
    const percent = Number(task.percent || Math.round(((task.current || 0) / Math.max(task.total || 1, 1)) * 100));
    elements.progressLabel.textContent = task.message || "任务处理中";
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressBar.style.width = `${Math.max(0, Math.min(percent, 100))}%`;
    elements.progressCard.querySelector(".progress-track")?.setAttribute("aria-valuenow", String(Math.max(0, Math.min(percent, 100))));
  }
}

function renderOutputBaseConfig() {
  const currentOutputBase = state.status?.outputBase || "";
  const defaultOutputBase = state.status?.defaultOutputBase || "";
  const draft = state.outputBaseDraft ?? currentOutputBase;
  const busy = state.preparing || state.applyingOutputBase || state.browsingOutputBase;
  const draftChanged = draft.trim() !== currentOutputBase.trim();

  if (!elements.outputBaseInput) {
    return;
  }
  elements.outputBaseInput.value = draft;
  elements.outputBaseInput.disabled = busy;
  elements.browseOutputButton.disabled = busy;
  elements.applyOutputButton.disabled = busy || !draftChanged;
  elements.applyOutputButton.textContent = state.applyingOutputBase ? "应用中..." : "应用目录";
  elements.browseOutputButton.textContent = state.browsingOutputBase ? "打开中..." : "选择文件夹";
  elements.resetOutputButton.disabled = busy || currentOutputBase === defaultOutputBase;
  elements.outputBaseNote.textContent = currentOutputBase === defaultOutputBase
    ? `当前使用默认输出目录：${currentOutputBase}`
    : `当前输出目录：${currentOutputBase}。默认目录：${defaultOutputBase}`;
}

function renderAccountDirConfig() {
  const currentSource = state.status?.manualSourcePath || "";
  const draft = state.accountDirDraft ?? currentSource;
  const busy = state.preparing || state.applyingAccountDir || state.browsingAccountDir;
  const draftChanged = draft.trim() !== currentSource.trim();
  const matchedAccountId = state.status?.matchedAccountId || "";
  const searchRoots = state.status?.searchRoots || state.status?.xwechatRoots || [];

  if (!elements.accountDirInput) {
    return;
  }

  elements.accountDirInput.value = draft;
  elements.accountDirInput.disabled = busy;
  elements.browseAccountButton.disabled = busy;
  elements.applyAccountButton.disabled = busy || !draftChanged;
  elements.resetAccountButton.disabled = busy || !currentSource;
  elements.browseAccountButton.textContent = state.browsingAccountDir ? "打开中..." : "选择微信目录";
  elements.applyAccountButton.textContent = state.applyingAccountDir ? "应用中..." : "使用此目录";

  if (currentSource) {
    const matchedText = matchedAccountId ? `当前自动匹配账号：${matchedAccountId}` : "当前未匹配到运行中的微信账号，将回退到首个可用账号。";
    elements.accountDirNote.textContent = `当前手动目录：${currentSource}。${matchedText}`;
    return;
  }

  const rootsText = searchRoots.length ? searchRoots.join("；") : "未检测到可扫描位置";
  elements.accountDirNote.textContent = `当前使用自动发现。扫描位置：${rootsText}`;
}

function renderSearchStatus() {
  if (!elements.searchStatus) {
    return;
  }
  if (!state.status?.prepared) {
    elements.searchStatus.textContent = "准备完成后，这里会显示最近会话；输入关键词时会自动筛选联系人和会话。";
    return;
  }
  if (!state.query) {
    elements.searchStatus.textContent = `当前显示最近会话 ${formatNumber(state.sessions.length)} 条。需要时可搜索备注、昵称、wxid 或摘要。`;
    return;
  }
  elements.searchStatus.textContent = `关键词“${state.query}”匹配到 ${formatNumber(state.sessions.length)} 个会话、${formatNumber(
    state.contacts.length
  )} 个联系人。`;
}

function setControlFeedback(message, tone = "info") {
  state.controlFeedback = { message, tone };
  renderControlFeedback();
}

function clearControlFeedback() {
  state.controlFeedback = null;
  renderControlFeedback();
}

function renderControlFeedback() {
  if (!elements.controlFeedback) {
    return;
  }
  const feedback = state.controlFeedback;
  elements.controlFeedback.hidden = !feedback;
  elements.controlFeedback.textContent = feedback?.message || "";
  elements.controlFeedback.dataset.tone = feedback?.tone || "";
}

function renderAccountOptions() {
  const accounts = state.status?.accounts || [];
  if (!accounts.length) {
    elements.accountSelect.innerHTML = `<option value="">未发现本地账号</option>`;
    elements.accountSelect.disabled = true;
    return;
  }

  elements.accountSelect.disabled = false;
  elements.accountSelect.innerHTML = accounts
    .map((account) => {
      const selected = account.id === state.selectedAccountId ? "selected" : "";
      const suffix = account.prepared ? "已准备" : "未准备";
      const matched = account.id === state.status?.matchedAccountId ? " · 当前登录" : "";
      return `<option value="${escapeAttr(account.id)}" ${selected}>${escapeHtml(
        `${account.name} · ${suffix}${matched}`
      )}</option>`;
    })
    .join("");
}

function renderSidebar() {
  if (!state.status?.prepared) {
    elements.sidebarList.innerHTML = `
      <section class="empty-state">
        <span class="empty-kicker">Private by default</span>
        <h4>还没有准备本地数据</h4>
        <p>先登录微信，再点击“使用本地缓存 / 准备数据”。准备完成后，这里会显示最近会话和搜索结果。</p>
      </section>
    `;
    return;
  }

  const sessionSection = `
    <section class="sidebar-section">
      <div class="sidebar-section-header">
        <h3>${state.query ? "匹配会话" : "最近会话"}</h3>
        <span>${state.sessions.length}</span>
      </div>
      <div class="session-list">
          ${state.sessions.length ? state.sessions.map(renderSessionCard).join("") : renderNoSessionCard("没有匹配到最近会话。")}
        </div>
      </section>
  `;

  const contactSection =
    state.query &&
    `
      <section class="sidebar-section">
        <div class="sidebar-section-header">
          <h3>匹配联系人</h3>
          <span>${state.contacts.length}</span>
        </div>
        <div class="session-list">
          ${state.contacts.length ? state.contacts.map(renderContactCard).join("") : renderNoSessionCard("没有额外联系人结果。")}
        </div>
      </section>
    `;

  elements.sidebarList.innerHTML = `${sessionSection}${contactSection || ""}`;
}

function renderConversation() {
  const status = state.status;
  const chat = state.chat;
  const isPrepared = Boolean(status?.prepared);

  elements.exportButton.disabled = !chat;
  elements.loadFullButton.hidden = !chat?.hasMore;
  elements.loadFullButton.disabled = state.loadingOlder;
  elements.loadFullButton.textContent = state.loadingOlder ? "正在加载..." : "加载更早消息";

  if (!isPrepared) {
    elements.conversationTitle.textContent = "等待会话";
    elements.conversationSubtitle.textContent = "准备完成后，从左侧选择一个会话或联系人。";
    elements.conversationBanner.textContent = "最近 400 条消息会优先载入，完整时间线可按需展开，避免首次打开卡顿。";
    elements.messageStream.innerHTML = `
      <section class="empty-state">
        <span class="empty-kicker">Ready when you are</span>
        <h4>先准备本地数据，再开始浏览聊天记录。</h4>
        <p>这个页面不会上传聊天内容，也不会改动原始加密数据库。它只是把你本机的解密结果做成一个更顺手的界面。</p>
      </section>
    `;
    renderInspector();
    return;
  }

  if (state.loadingChat) {
    const pendingLabel = state.selectedChat ? `正在载入 ${state.selectedChat} 的聊天内容…` : "正在载入聊天内容…";
    elements.conversationBanner.textContent = "正在切换会话，旧内容已冻结，完成后会自动刷新到最新位置。";
    elements.messageStream.innerHTML = `
      <section class="loading-state">
        <p>${escapeHtml(pendingLabel)}</p>
      </section>
    `;
    renderInspector();
    return;
  }

  if (state.chatError) {
    elements.conversationTitle.textContent = "无法载入会话";
    elements.conversationSubtitle.textContent = state.selectedChat
      ? `目标会话：${state.selectedChat}`
      : "当前会话暂时无法读取。";
    elements.conversationBanner.textContent = "可以重新点击左侧会话、检查本地缓存，或重新准备数据后再试。";
    elements.messageStream.innerHTML = `
      <section class="empty-state">
        <span class="empty-kicker">Load failed</span>
        <h4>没有显示旧聊天内容。</h4>
        <p>${escapeHtml(state.chatError)}</p>
      </section>
    `;
    renderInspector();
    return;
  }

  if (!chat) {
    elements.conversationTitle.textContent = "选择一个会话";
    elements.conversationSubtitle.textContent = "左侧可以查看最近会话，或者搜索备注、昵称、wxid。";
    elements.conversationBanner.textContent = "准备完成后，点击任意会话即可浏览文本内容并导出。";
    elements.messageStream.innerHTML = `
      <section class="empty-state">
        <span class="empty-kicker">Conversation view</span>
        <h4>左侧选一个会话，时间线就会出现在这里。</h4>
        <p>默认先显示最近 400 条消息，然后可以继续向前翻阅更早内容。</p>
      </section>
    `;
    renderInspector();
    return;
  }

  elements.conversationTitle.textContent = chat.contact.displayName;
  elements.conversationSubtitle.textContent = buildConversationSubtitle(chat.contact);
  elements.conversationBanner.textContent = chat.truncated
    ? `当前显示 ${formatNumber(chat.returnedMessages)} / ${formatNumber(
        chat.totalMessages
      )} 条消息。点击“加载更早消息”会继续向前翻页，并保持当前滚动位置。`
    : `共载入 ${formatNumber(chat.totalMessages)} 条消息。导出按钮会生成 UTF-8 文本文件。`;
  elements.messageStream.innerHTML = renderMessageStream(chat.messages);
  renderInspector();
}

function renderSessionCard(item) {
  const activeClass = item.username === state.selectedChat ? "active" : "";
  return `
    <button class="session-card ${activeClass}" type="button" data-chat-username="${escapeAttr(item.username)}">
      <span class="session-avatar">${escapeHtml(initialOf(item.displayName))}</span>
      <span class="session-main">
        <span class="session-title-row">
          <strong class="session-title">${escapeHtml(item.displayName)}</strong>
          <span class="session-time">${escapeHtml(formatRelativeTime(item.lastTimestamp))}</span>
        </span>
        <span class="session-summary">${escapeHtml(item.summary || "No summary")}</span>
        <span class="session-aux">${escapeHtml(item.username)}</span>
      </span>
      ${item.unreadCount ? `<span class="unread-badge">${escapeHtml(String(item.unreadCount))}</span>` : "<span></span>"}
    </button>
  `;
}

function renderContactCard(item) {
  const activeClass = item.username === state.selectedChat ? "active" : "";
  const aux = [item.remark, item.nickName, item.alias].filter(Boolean).join(" · ");
  return `
    <button class="session-card ${activeClass}" type="button" data-chat-username="${escapeAttr(item.username)}">
      <span class="session-avatar">${escapeHtml(initialOf(item.displayName))}</span>
      <span class="session-main">
        <span class="session-title-row">
          <strong class="session-title">${escapeHtml(item.displayName)}</strong>
          <span class="session-time">Contact</span>
        </span>
        <span class="session-summary">${escapeHtml(aux || "Direct contact result")}</span>
        <span class="session-aux">${escapeHtml(item.username)}</span>
      </span>
      <span></span>
    </button>
  `;
}

function renderNoSessionCard(message) {
  return `
    <div class="session-card" aria-hidden="true">
      <span class="session-avatar">-</span>
      <span class="session-main">
        <strong class="session-title">暂无结果</strong>
        <span class="session-summary">${escapeHtml(message)}</span>
      </span>
      <span></span>
    </div>
  `;
}

function renderMessageStream(messages) {
  if (!messages.length) {
    return `
      <section class="empty-state">
        <span class="empty-kicker">No messages</span>
        <h4>这个联系人当前没有可显示的消息。</h4>
      </section>
    `;
  }

  let lastDay = "";
  const chunks = [];
  for (const message of messages) {
    const day = formatDayKey(message.createTime);
    if (day !== lastDay) {
      lastDay = day;
      chunks.push(`<div class="timeline-day">${escapeHtml(formatDayLabel(message.createTime))}</div>`);
    }
    const bubbleClass = message.isOutgoing ? "message-bubble message-out" : "message-bubble message-in";
    const body = renderMessageBody(message);
    chunks.push(`
      <article class="${bubbleClass}" id="msg-${escapeAttr(String(message.localId))}">
        <div class="message-meta">
          <span>${escapeHtml(message.sender)}</span>
          <time datetime="${escapeAttr(new Date(message.createTime * 1000).toISOString())}">
            ${escapeHtml(formatDateTime(message.createTime))}
          </time>
        </div>
        ${body}
      </article>
    `);
  }
  return chunks.join("");
}

function renderInspector() {
  const status = state.status;
  const chat = state.chat;

  if (!status?.prepared) {
    elements.inspectorTitle.textContent = "等待本地数据";
    elements.inspectorSubtitle.textContent = "准备完成后，这里会汇总当前会话的媒体、链接和消息统计。";
    elements.inspectorStats.innerHTML = renderInspectorEmpty("尚未准备本地聊天数据。");
    elements.inspectorMediaLabel.textContent = "当前未载入媒体";
    elements.inspectorMediaGrid.innerHTML = renderInspectorEmpty("图片、视频和表情索引会在这里出现。");
    elements.inspectorLinkLabel.textContent = "当前未载入链接";
    elements.inspectorLinkList.innerHTML = renderInspectorEmpty("文本中的 URL 和分享链接会在这里归档。");
    return;
  }

  if (state.loadingChat) {
    elements.inspectorTitle.textContent = "正在载入会话";
    elements.inspectorSubtitle.textContent = "请稍候，右侧索引会随着时间线一起刷新。";
    elements.inspectorStats.innerHTML = renderInspectorEmpty("正在整理当前会话的统计和媒体。");
    elements.inspectorMediaLabel.textContent = "媒体索引整理中";
    elements.inspectorMediaGrid.innerHTML = renderInspectorEmpty("正在扫描图片、视频和表情消息。");
    elements.inspectorLinkLabel.textContent = "链接索引整理中";
    elements.inspectorLinkList.innerHTML = renderInspectorEmpty("正在扫描消息里的 URL。");
    return;
  }

  if (state.chatError) {
    elements.inspectorTitle.textContent = "会话读取失败";
    elements.inspectorSubtitle.textContent = state.chatError;
    elements.inspectorStats.innerHTML = renderInspectorEmpty("没有保留旧统计，请重新选择会话。");
    elements.inspectorMediaLabel.textContent = "当前无可用媒体";
    elements.inspectorMediaGrid.innerHTML = renderInspectorEmpty("无法读取媒体索引。");
    elements.inspectorLinkLabel.textContent = "当前无可用链接";
    elements.inspectorLinkList.innerHTML = renderInspectorEmpty("无法读取链接索引。");
    return;
  }

  if (!chat) {
    elements.inspectorTitle.textContent = "等待选择会话";
    elements.inspectorSubtitle.textContent = "选择左侧任意会话后，这里会出现媒体、链接和联系人摘要。";
    elements.inspectorStats.innerHTML = renderInspectorEmpty("会话统计会显示已载入条数、媒体数和链接数。");
    elements.inspectorMediaLabel.textContent = "当前未载入媒体";
    elements.inspectorMediaGrid.innerHTML = renderInspectorEmpty("图片、视频和表情索引会在这里出现。");
    elements.inspectorLinkLabel.textContent = "当前未载入链接";
    elements.inspectorLinkList.innerHTML = renderInspectorEmpty("文本中的 URL 和分享链接会在这里归档。");
    return;
  }

  const messages = chat.messages || [];
  const imageMessages = messages.filter((message) => message.displayType === "image");
  const videoMessages = messages.filter((message) => message.displayType === "video");
  const emojiMessages = messages.filter((message) => message.displayType === "emoji");
  const links = collectUniqueLinks(messages);

  elements.inspectorTitle.textContent = chat.contact.displayName;
  elements.inspectorSubtitle.textContent = buildConversationSubtitle(chat.contact);
  elements.inspectorStats.innerHTML = [
    renderInspectorStat("已载入", formatNumber(messages.length)),
    renderInspectorStat("图片", formatNumber(imageMessages.length)),
    renderInspectorStat("视频", formatNumber(videoMessages.length)),
    renderInspectorStat("链接", formatNumber(links.length)),
  ].join("");

  const mediaItems = [
    ...imageMessages.slice(0, 4).map((message) => renderInspectorMediaItem(message, "图片")),
    ...videoMessages.slice(0, 3).map((message) => renderInspectorMediaItem(message, "视频")),
    ...emojiMessages.slice(0, 3).map((message) => renderInspectorMediaItem(message, "表情")),
  ];
  elements.inspectorMediaLabel.textContent = `当前已载入 ${formatNumber(
    imageMessages.length + videoMessages.length + emojiMessages.length
  )} 条媒体消息`;
  elements.inspectorMediaGrid.innerHTML = mediaItems.length
    ? mediaItems.join("")
    : renderInspectorEmpty("当前已载入消息里还没有图片、视频或表情。");

  elements.inspectorLinkLabel.textContent = `当前已载入 ${formatNumber(links.length)} 条链接`;
  elements.inspectorLinkList.innerHTML = links.length
    ? links.slice(0, 8).map((link) => renderInspectorLinkItem(link)).join("")
    : renderInspectorEmpty("当前已载入消息里还没有解析到链接。");
}

function renderInspectorStat(label, value) {
  return `
    <article class="inspector-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderInspectorMediaItem(message, label) {
  if (message.displayType === "image" && message.imageUrl) {
    return `
      <button class="inspector-media-item inspector-media-thumb" type="button" data-jump-local-id="${escapeAttr(
        String(message.localId)
      )}">
        <img src="${escapeAttr(message.imageUrl)}" alt="${escapeAttr(message.text || label)}" loading="lazy" decoding="async" />
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }
  return `
    <button class="inspector-media-item" type="button" data-jump-local-id="${escapeAttr(String(message.localId))}">
      <strong>${escapeHtml(label)}</strong>
      <small>${escapeHtml(message.text || `${label}消息`)}</small>
    </button>
  `;
}

function renderInspectorLinkItem(link) {
  return `
    <a class="inspector-link-item" href="${escapeAttr(link)}" target="_blank" rel="noreferrer">
      <strong>${escapeHtml(readableUrl(link))}</strong>
      <small>${escapeHtml(link)}</small>
    </a>
  `;
}

function renderInspectorEmpty(message) {
  return `<div class="inspector-empty">${escapeHtml(message)}</div>`;
}

function collectUniqueLinks(messages) {
  const unique = new Set();
  for (const message of messages) {
    for (const link of message.links || []) {
      unique.add(link);
    }
  }
  return Array.from(unique);
}

function jumpToMessage(localId) {
  const target = elements.messageStream.querySelector(`#msg-${String(localId)}`);
  if (!target) {
    return;
  }
  target.scrollIntoView({ block: "center", behavior: "smooth" });
}

function renderMessageBody(message) {
  if (message.displayType === "image") {
    if (!message.imageUrl) {
      return renderMediaPlaceholder("图片消息", "本地图片暂时无法预览，但消息类型已正确识别。", "image");
    }
    const targetUrl = message.imageFullUrl || message.imageUrl;
    return `
      <figure class="message-image-wrap">
        <a class="message-image-link" href="${escapeAttr(targetUrl)}" target="_blank" rel="noreferrer">
          <img class="message-image" src="${escapeAttr(message.imageUrl)}" alt="${escapeAttr(message.text || "图片消息")}" loading="lazy" decoding="async" />
        </a>
        <figcaption>${escapeHtml(message.text || "图片消息")}</figcaption>
      </figure>
    `;
  }
  if (message.displayType === "video") {
    if (!message.videoUrl) {
      return renderMediaPlaceholder("视频消息", "未在本机缓存中找到可播放视频文件。", "video");
    }
    return `
      <figure class="message-video-wrap">
        <video class="message-video" controls preload="metadata">
          <source src="${escapeAttr(message.videoUrl)}" type="${escapeAttr(message.videoMimeType || "video/mp4")}" />
          当前浏览器无法播放这个视频。
        </video>
        <figcaption>
          <span>${escapeHtml(message.text || "视频消息")}</span>
          <a href="${escapeAttr(message.videoUrl)}" target="_blank" rel="noreferrer">打开原视频</a>
        </figcaption>
      </figure>
    `;
  }
  if (message.displayType === "emoji") {
    return `
      <div class="message-emoji-card">
        <span class="message-emoji-glyph" aria-hidden="true">☺</span>
        <span>
          <strong>${escapeHtml(message.text || "表情消息")}</strong>
          <small>${message.mediaId ? `ID ${escapeHtml(shortenMediaId(message.mediaId))}` : "自定义表情"}</small>
        </span>
      </div>
    `;
  }
  if (message.displayType === "link" && message.links?.length) {
    const firstLink = message.links[0];
    return `
      <a class="message-link-card" href="${escapeAttr(firstLink)}" target="_blank" rel="noreferrer">
        <span class="message-link-kicker">Link</span>
        <strong>${escapeHtml(message.text && message.text !== firstLink ? message.text : readableUrl(firstLink))}</strong>
        <small>${escapeHtml(readableUrl(firstLink))}</small>
      </a>
    `;
  }
  if (message.displayType === "link") {
    return renderMediaPlaceholder("链接/分享消息", "该分享内容没有可解析链接，已保留消息类型。", "link");
  }
  return `<div class="message-text">${renderTextWithLinks(message.text, message.links)}</div>`;
}

function renderMediaPlaceholder(title, detail, type) {
  return `
    <div class="message-media-placeholder message-media-${escapeAttr(type)}">
      <span class="message-media-icon" aria-hidden="true">${escapeHtml(mediaIcon(type))}</span>
      <span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(detail)}</small>
      </span>
    </div>
  `;
}

function renderTextWithLinks(text, links = []) {
  const source = String(text ?? "");
  const linkSet = new Set(links?.length ? links : extractUrls(source));
  if (!linkSet.size) {
    return escapeHtml(source);
  }

  const chunks = [];
  let cursor = 0;
  for (const link of linkSet) {
    const index = source.indexOf(link, cursor);
    if (index < 0) {
      continue;
    }
    chunks.push(escapeHtml(source.slice(cursor, index)));
    chunks.push(
      `<a class="inline-link" href="${escapeAttr(link)}" target="_blank" rel="noreferrer">${escapeHtml(link)}</a>`
    );
    cursor = index + link.length;
  }
  chunks.push(escapeHtml(source.slice(cursor)));
  return chunks.join("");
}

function extractUrls(text) {
  return String(text ?? "").match(/https?:\/\/[^\s<>'"，。！？、）】》]+/gi) || [];
}

function readableUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function mediaIcon(type) {
  return {
    image: "IMG",
    video: "VID",
    link: "URL",
  }[type] || "MSG";
}

function shortenMediaId(value) {
  return String(value).length > 12 ? `${String(value).slice(0, 8)}...` : value;
}

function dedupeContacts(contacts, sessions) {
  const seen = new Set(sessions.map((item) => item.username));
  return contacts.filter((item) => !seen.has(item.username));
}

function buildStatusNote(status) {
  if (!status.accounts?.length) {
    const roots = status.searchRoots?.length ? status.searchRoots.join("；") : "默认文档目录";
    return `还没有在这些位置发现可用账号目录：${roots}。先登录微信桌面版，或手动选择微信文件根目录。`;
  }
  if (!status.hasRunningWeixin) {
    return "已发现本地账号目录，但当前没有检测到运行中的 Weixin.exe。要自动匹配并准备当前账号，需要先打开并登录微信。";
  }
  if (!status.prepared) {
    const matched = status.matchedAccountId ? `当前已自动匹配到 ${status.matchedAccountId}。` : "";
    return `${matched}现在可以点击“使用本地缓存 / 准备数据”，生成仅供本机检索与导出的解密副本。`;
  }
  return `当前账号已准备完成。工作副本目录：${status.outputRoot}`;
}

function buildConversationSubtitle(contact) {
  const parts = [contact.username];
  if (contact.remark) {
    parts.push(`remark: ${contact.remark}`);
  }
  if (contact.alias) {
    parts.push(`alias: ${contact.alias}`);
  }
  return parts.join("  ·  ");
}

function initialOf(value) {
  if (!value) {
    return "?";
  }
  return Array.from(value.trim())[0] || "?";
}

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return "-";
  }
  const date = new Date(timestamp * 1000);
  const now = Date.now();
  const diffHours = Math.round((now - date.getTime()) / (1000 * 60 * 60));
  if (diffHours < 24) {
    return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (diffHours < 24 * 6) {
    return new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function formatDayKey(timestamp) {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDayLabel(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(timestamp * 1000));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 3200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
