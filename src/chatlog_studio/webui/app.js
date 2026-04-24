import {
  getDateLocale,
  getNumberLocale,
  localizeMessage,
  localizeTaskMessage,
  setupLanguageSwitcher,
  t,
} from "./i18n.js";

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
  toastMessage: null,
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
  progressTrack: document.querySelector(".progress-track"),
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
  setupLanguageSwitcher(() => {
    rerenderForLocale();
  });
  wireEvents();
  rerenderForLocale();
  bootstrap().catch((error) => {
    showToast(resolveErrorMessage(error, t("genericStartFailed")));
  });
});

function rerenderForLocale() {
  renderStatus();
  renderControlFeedback();
  renderToast();
  renderSidebar();
  renderConversation();
  renderInspector();
}

function invalidateChatContext() {
  state.chatRequestId += 1;
  state.selectedChat = null;
  state.chat = null;
  state.chatError = null;
  state.loadingChat = false;
}

function wireEvents() {
  elements.prepareButton?.addEventListener("click", () => {
    prepareLocalData(false).catch((error) => showToast(resolveErrorMessage(error, t("prepareFailed"))));
  });

  elements.forcePrepareButton?.addEventListener("click", () => {
    const confirmed = window.confirm(t("confirmForcePrepare"));
    if (!confirmed) {
      return;
    }
    prepareLocalData(true).catch((error) => showToast(resolveErrorMessage(error, t("prepareFailed"))));
  });

  elements.accountDirInput?.addEventListener("input", (event) => {
    state.accountDirDraft = event.target.value;
    renderAccountDirConfig();
  });

  elements.accountDirInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    applyWechatRoot(state.accountDirDraft).catch((error) => showToast(resolveErrorMessage(error, t("switchAccountFailed"))));
  });

  elements.browseAccountButton?.addEventListener("click", () => {
    browseWechatRoot().catch((error) => showToast(resolveErrorMessage(error, t("switchAccountFailed"))));
  });

  elements.applyAccountButton?.addEventListener("click", () => {
    applyWechatRoot(state.accountDirDraft).catch((error) => showToast(resolveErrorMessage(error, t("switchAccountFailed"))));
  });

  elements.resetAccountButton?.addEventListener("click", () => {
    applyWechatRoot("").catch((error) => showToast(resolveErrorMessage(error, t("switchAccountFailed"))));
  });

  elements.outputBaseInput?.addEventListener("input", (event) => {
    state.outputBaseDraft = event.target.value;
    renderOutputBaseConfig();
  });

  elements.outputBaseInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    applyOutputBase(state.outputBaseDraft).catch((error) => showToast(resolveErrorMessage(error, t("updatingOutputRoot"))));
  });

  elements.browseOutputButton?.addEventListener("click", () => {
    browseOutputBase().catch((error) => showToast(resolveErrorMessage(error, t("updatingOutputRoot"))));
  });

  elements.applyOutputButton?.addEventListener("click", () => {
    applyOutputBase(state.outputBaseDraft).catch((error) => showToast(resolveErrorMessage(error, t("updatingOutputRoot"))));
  });

  elements.resetOutputButton?.addEventListener("click", () => {
    applyOutputBase("").catch((error) => showToast(resolveErrorMessage(error, t("updatingOutputRoot"))));
  });

  elements.accountSelect?.addEventListener("change", async (event) => {
    try {
      state.selectedAccountId = event.target.value || null;
      invalidateChatContext();
      setControlFeedbackKey("switchingAccount", "info");
      await refreshStatus();
      await refreshSidebar();
      await loadBestInitialChat();
      clearControlFeedback();
    } catch (error) {
      setControlFeedback(resolveErrorMessage(error, t("switchAccountFailed")), "error");
      showToast(resolveErrorMessage(error, t("switchAccountFailed")));
    }
  });

  let searchTimer = null;
  elements.searchInput?.addEventListener("input", (event) => {
    window.clearTimeout(searchTimer);
    state.query = event.target.value.trim();
    searchTimer = window.setTimeout(() => {
      refreshSidebar().catch((error) => showToast(resolveErrorMessage(error)));
    }, 180);
  });

  elements.sidebarList?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-chat-username]");
    if (!trigger) {
      return;
    }
    const username = trigger.getAttribute("data-chat-username");
    if (!username) {
      return;
    }
    state.selectedChat = username;
    loadChat(username, false).catch((error) => showToast(resolveErrorMessage(error)));
  });

  elements.exportButton?.addEventListener("click", () => {
    if (!state.selectedChat) {
      return;
    }
    exportCurrentChat().catch((error) => showToast(resolveErrorMessage(error)));
  });

  elements.loadFullButton?.addEventListener("click", () => {
    if (!state.selectedChat || !state.chat?.hasMore) {
      return;
    }
    loadOlderMessages().catch((error) => showToast(resolveErrorMessage(error)));
  });

  elements.inspectorMediaGrid?.addEventListener("click", (event) => {
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
    setControlFeedback(resolveErrorMessage(error, t("bootstrapFailed")), "error");
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

  state.sessions = (sessionPayload.items || []).filter(isBrowsableSession);
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
    message: force ? t("prepareQueuedForce") : t("prepareQueuedNormal"),
  };
  renderActionState();
  setControlFeedbackKey(force ? "preparingForceFeedback" : "preparingNormalFeedback", "info");
  showToastKey(force ? "preparingForceToast" : "preparingNormalToast");

  try {
    const task = await fetchJson("/api/tasks/prepare", {
      method: "POST",
      body: JSON.stringify({ account: state.selectedAccountId, force }),
    });
    const payload = await pollTask(task.taskId);
    if (payload.status !== "succeeded") {
      throw new Error(payload.error || "Preparation failed");
    }

    state.activeTask = payload;
    state.status = payload.result.status;
    state.selectedAccountId = payload.result.status.selectedAccountId || null;
    renderStatus();
    await refreshSidebar();
    await loadBestInitialChat();
    setControlFeedbackKey(payload.result.usedCache ? "prepareSucceededCache" : "prepareSucceededFresh", "success");
    if (payload.result.usedCache) {
      showToastKey("prepareToastCache");
    } else {
      showToastKey("prepareToastFresh", { count: payload.result.decryptedFiles.length });
    }
  } catch (error) {
    const message = resolveErrorMessage(error, t("prepareFailed"));
    state.activeTask = {
      ...(state.activeTask || {}),
      status: "failed",
      message: message,
      error: message,
    };
    renderActionState();
    setControlFeedback(message, "error");
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
  const previousHeight = elements.messageStream?.scrollHeight || 0;
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
    if (elements.messageStream) {
      if (prepend) {
        elements.messageStream.scrollTop = elements.messageStream.scrollHeight - previousHeight;
      } else {
        elements.messageStream.scrollTop = elements.messageStream.scrollHeight;
      }
    }
  } catch (error) {
    if (requestId !== state.chatRequestId) {
      return;
    }
    state.loadingChat = false;
    state.loadingOlder = false;
    if (!prepend) {
      state.chat = null;
      state.chatError = resolveErrorMessage(error, t("chatLoadFailed"));
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
  setControlFeedbackKey("exportSuccessFeedback", "success", {
    name: payload.contact.displayName,
    path: payload.outputPath,
  });
  showToastKey("exportSuccessToast", {
    name: payload.contact.displayName,
    path: payload.outputPath,
  });
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
    setControlFeedbackKey(sourceDir ? "updatingWechatRoot" : "resettingWechatRoot", "info");
    const payload = await fetchJson("/api/wechat-root", {
      method: "POST",
      body: JSON.stringify({ sourceDir }),
    });
    state.status = payload;
    state.selectedAccountId = payload.selectedAccountId || null;
    state.accountDirDraft = payload.manualSourcePath || "";
    invalidateChatContext();
    renderStatus();
    await refreshSidebar();
    await loadBestInitialChat();
    if (payload.manualSourcePath) {
      setControlFeedbackKey("wechatRootUpdated", "success", { path: payload.manualSourcePath });
      showToastKey("wechatRootUpdated", { path: payload.manualSourcePath });
    } else {
      setControlFeedbackKey("wechatRootReset", "success");
      showToastKey("wechatRootReset");
    }
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
    setControlFeedbackKey("updatingOutputRoot", "info");
    const payload = await fetchJson("/api/output-base", {
      method: "POST",
      body: JSON.stringify({ outputBase }),
    });
    state.status = payload;
    state.selectedAccountId = payload.selectedAccountId || null;
    state.outputBaseDraft = payload.outputBase || "";
    invalidateChatContext();
    renderStatus();
    await refreshSidebar();
    await loadBestInitialChat();
    setControlFeedbackKey("outputRootUpdated", "success", { path: payload.outputBase });
    showToastKey("outputRootUpdated", { path: payload.outputBase });
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

  if (elements.weixinState) {
    elements.weixinState.textContent = status?.hasRunningWeixin ? t("statusWeixinOn") : t("statusWeixinOff");
  }
  if (elements.readyState) {
    elements.readyState.textContent = status?.prepared ? t("statusReadyOn") : t("statusReadyOff");
  }
  if (elements.contactsCount) {
    elements.contactsCount.textContent = formatNumber(stats.contacts || 0);
  }
  if (elements.sessionsCount) {
    elements.sessionsCount.textContent = formatNumber(stats.sessions || 0);
  }
  if (elements.exportsCount) {
    elements.exportsCount.textContent = formatNumber(stats.exports || 0);
  }
  if (elements.dbCount) {
    elements.dbCount.textContent = formatNumber(stats.decryptedFiles || 0);
  }
  if (elements.statusNote) {
    elements.statusNote.textContent = buildStatusNote(status);
  }

  renderAccountOptions();
}

function renderActionState() {
  if (!elements.prepareButton || !elements.forcePrepareButton) {
    return;
  }
  elements.prepareButton.disabled = state.preparing;
  elements.forcePrepareButton.disabled = state.preparing;
  elements.prepareButton.textContent = state.preparing ? t("prepareButtonBusy") : t("prepareButton");
  elements.forcePrepareButton.textContent = t("forcePrepareButton");

  const task = state.activeTask;
  const visibleTask = task && (task.status === "running" || task.status === "queued" || task.status === "failed");
  if (elements.progressCard) {
    elements.progressCard.hidden = !visibleTask;
  }
  if (task) {
    const percent = Number(task.percent || Math.round(((task.current || 0) / Math.max(task.total || 1, 1)) * 100));
    if (elements.progressLabel) {
      elements.progressLabel.textContent = localizeTaskMessage(task.message || t("taskProcessing"));
    }
    if (elements.progressPercent) {
      elements.progressPercent.textContent = `${percent}%`;
    }
    if (elements.progressBar) {
      elements.progressBar.style.width = `${Math.max(0, Math.min(percent, 100))}%`;
    }
    elements.progressTrack?.setAttribute("aria-valuenow", String(Math.max(0, Math.min(percent, 100))));
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
  elements.applyOutputButton.textContent = state.applyingOutputBase ? t("applyOutputRootBusy") : t("applyOutputRoot");
  elements.browseOutputButton.textContent = state.browsingOutputBase ? t("browseOutputRootBusy") : t("browseOutputRoot");
  elements.resetOutputButton.disabled = busy || currentOutputBase === defaultOutputBase;
  elements.resetOutputButton.textContent = t("resetOutputRoot");
  elements.outputBaseNote.textContent = currentOutputBase === defaultOutputBase
    ? t("outputRootDefaultCurrent", { current: currentOutputBase })
    : t("outputRootCurrent", { current: currentOutputBase, defaultValue: defaultOutputBase });
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
  elements.browseAccountButton.textContent = state.browsingAccountDir ? t("browseWechatRootBusy") : t("browseWechatRoot");
  elements.applyAccountButton.textContent = state.applyingAccountDir ? t("applyWechatRootBusy") : t("applyWechatRoot");
  elements.resetAccountButton.textContent = t("resetWechatRoot");

  if (currentSource) {
    const matchedText = matchedAccountId
      ? t("wechatRootMatchedCurrent", { matched: matchedAccountId })
      : t("wechatRootNoMatched");
    elements.accountDirNote.textContent = t("wechatRootManualCurrent", {
      current: currentSource,
      matched: matchedText,
    });
    return;
  }

  const rootsText = searchRoots.length ? joinList(searchRoots) : t("wechatRootNoRoots");
  elements.accountDirNote.textContent = t("wechatRootAutoCurrent", { roots: rootsText });
}

function renderSearchStatus() {
  if (!elements.searchStatus) {
    return;
  }
  if (!state.status?.prepared) {
    elements.searchStatus.textContent = t("searchPreparedHint");
    return;
  }
  if (!state.query) {
    elements.searchStatus.textContent = t("searchRecent", {
      count: formatNumber(state.sessions.length),
    });
    return;
  }
  elements.searchStatus.textContent = t("searchMatched", {
    query: state.query,
    sessions: formatNumber(state.sessions.length),
    contacts: formatNumber(state.contacts.length),
  });
}

function setControlFeedback(message, tone = "info") {
  state.controlFeedback = { tone, raw: String(message ?? "") };
  renderControlFeedback();
}

function setControlFeedbackKey(key, tone = "info", params = {}) {
  state.controlFeedback = { tone, key, params };
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
  elements.controlFeedback.textContent = feedback ? resolveEntryText(feedback) : "";
  elements.controlFeedback.dataset.tone = feedback?.tone || "";
}

function renderAccountOptions() {
  const accounts = state.status?.accounts || [];
  if (!accounts.length) {
    elements.accountSelect.innerHTML = `<option value="">${escapeHtml(t("noAccountsOption"))}</option>`;
    elements.accountSelect.disabled = true;
    return;
  }

  elements.accountSelect.disabled = false;
  elements.accountSelect.innerHTML = accounts
    .map((account) => {
      const selected = account.id === state.selectedAccountId ? "selected" : "";
      const suffix = account.prepared ? t("accountPreparedSuffix") : t("accountUnpreparedSuffix");
      const matched = account.id === state.status?.matchedAccountId ? t("accountMatchedSuffix") : "";
      return `<option value="${escapeAttr(account.id)}" ${selected}>${escapeHtml(`${account.name} · ${suffix}${matched}`)}</option>`;
    })
    .join("");
}

function renderSidebar() {
  if (!elements.sidebarList) {
    return;
  }
  if (!state.status?.prepared) {
    elements.sidebarList.innerHTML = `
      <section class="empty-state">
        <span class="empty-kicker">${escapeHtml(t("privateDefaultKicker"))}</span>
        <h4>${escapeHtml(t("sidebarEmptyTitle"))}</h4>
        <p>${escapeHtml(t("sidebarEmptyBody"))}</p>
      </section>
    `;
    return;
  }

  const sessionSection = `
    <section class="sidebar-section">
      <div class="sidebar-section-header">
        <h3>${escapeHtml(state.query ? t("sidebarSectionMatchedSessions") : t("sidebarSectionRecentSessions"))}</h3>
        <span>${escapeHtml(formatNumber(state.sessions.length))}</span>
      </div>
      <div class="session-list">
        ${state.sessions.length ? state.sessions.map(renderSessionCard).join("") : renderNoSessionCard(t("noRecentSessions"))}
      </div>
    </section>
  `;

  const contactSection = state.query
    ? `
      <section class="sidebar-section">
        <div class="sidebar-section-header">
          <h3>${escapeHtml(t("sidebarSectionMatchedContacts"))}</h3>
          <span>${escapeHtml(formatNumber(state.contacts.length))}</span>
        </div>
        <div class="session-list">
          ${state.contacts.length ? state.contacts.map(renderContactCard).join("") : renderNoSessionCard(t("noContactMatches"))}
        </div>
      </section>
    `
    : "";

  elements.sidebarList.innerHTML = `${sessionSection}${contactSection}`;
}

function renderConversation() {
  const status = state.status;
  const chat = state.chat;
  const isPrepared = Boolean(status?.prepared);

  elements.exportButton.disabled = !chat;
  elements.exportButton.textContent = t("exportButton");
  elements.loadFullButton.hidden = !chat?.hasMore;
  elements.loadFullButton.disabled = state.loadingOlder;
  elements.loadFullButton.textContent = state.loadingOlder ? t("loadFullButtonBusy") : t("loadFullButton");

  if (!isPrepared) {
    elements.conversationTitle.textContent = t("conversationWaitTitle");
    elements.conversationSubtitle.textContent = t("conversationWaitSubtitle");
    elements.conversationBanner.textContent = t("conversationWaitBanner");
    elements.messageStream.innerHTML = `
      <section class="empty-state">
        <span class="empty-kicker">${escapeHtml(t("emptyKickerReady"))}</span>
        <h4>${escapeHtml(t("emptyTitleReady"))}</h4>
        <p>${escapeHtml(t("emptyBodyReady"))}</p>
      </section>
    `;
    renderInspector();
    return;
  }

  if (state.loadingChat) {
    const pendingLabel = state.selectedChat
      ? t("pendingConversationSpecific", { name: state.selectedChat })
      : t("pendingConversationGeneric");
    elements.conversationBanner.textContent = t("loadingConversationBanner");
    elements.messageStream.innerHTML = `
      <section class="loading-state">
        <p>${escapeHtml(pendingLabel)}</p>
      </section>
    `;
    renderInspector();
    return;
  }

  if (state.chatError) {
    elements.conversationTitle.textContent = t("loadFailedTitle");
    elements.conversationSubtitle.textContent = state.selectedChat
      ? t("loadFailedSubtitleSpecific", { name: state.selectedChat })
      : t("loadFailedSubtitleGeneric");
    elements.conversationBanner.textContent = t("loadFailedBanner");
    elements.messageStream.innerHTML = `
      <section class="empty-state">
        <span class="empty-kicker">${escapeHtml(t("loadFailedKicker"))}</span>
        <h4>${escapeHtml(t("loadFailedHeading"))}</h4>
        <p>${escapeHtml(state.chatError)}</p>
      </section>
    `;
    renderInspector();
    return;
  }

  if (!chat) {
    elements.conversationTitle.textContent = t("selectConversationTitle");
    elements.conversationSubtitle.textContent = t("selectConversationSubtitle");
    elements.conversationBanner.textContent = t("selectConversationBanner");
    elements.messageStream.innerHTML = `
      <section class="empty-state">
        <span class="empty-kicker">${escapeHtml(t("selectConversationKicker"))}</span>
        <h4>${escapeHtml(t("selectConversationHeading"))}</h4>
        <p>${escapeHtml(t("selectConversationBody"))}</p>
      </section>
    `;
    renderInspector();
    return;
  }

  elements.conversationTitle.textContent = chat.contact.displayName;
  elements.conversationSubtitle.textContent = buildConversationSubtitle(chat.contact);
  elements.conversationBanner.textContent = chat.truncated
    ? t("conversationBannerTruncated", {
        returned: formatNumber(chat.returnedMessages),
        total: formatNumber(chat.totalMessages),
      })
    : t("conversationBannerFull", { total: formatNumber(chat.totalMessages) });
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
        <span class="session-summary">${escapeHtml(item.summary || t("noSummary"))}</span>
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
          <span class="session-time">${escapeHtml(t("contactTag"))}</span>
        </span>
        <span class="session-summary">${escapeHtml(aux || t("directContactResult"))}</span>
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
        <strong class="session-title">${escapeHtml(t("noSessionCard"))}</strong>
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
        <span class="empty-kicker">${escapeHtml(t("noMessagesKicker"))}</span>
        <h4>${escapeHtml(t("noMessagesTitle"))}</h4>
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
    chunks.push(`
      <article class="${bubbleClass}" id="msg-${escapeAttr(String(message.localId))}">
        <div class="message-meta">
          <span>${escapeHtml(message.sender)}</span>
          <time datetime="${escapeAttr(new Date(message.createTime * 1000).toISOString())}">
            ${escapeHtml(formatDateTime(message.createTime))}
          </time>
        </div>
        ${renderMessageBody(message)}
      </article>
    `);
  }
  return chunks.join("");
}

function renderInspector() {
  const status = state.status;
  const chat = state.chat;

  if (!status?.prepared) {
    elements.inspectorTitle.textContent = t("inspectorWaitDataTitle");
    elements.inspectorSubtitle.textContent = t("inspectorWaitDataSubtitle");
    elements.inspectorStats.innerHTML = renderInspectorEmpty(t("inspectorWaitDataStats"));
    elements.inspectorMediaLabel.textContent = t("mediaLabel");
    elements.inspectorMediaGrid.innerHTML = renderInspectorEmpty(t("inspectorWaitDataMedia"));
    elements.inspectorLinkLabel.textContent = t("linkLabel");
    elements.inspectorLinkList.innerHTML = renderInspectorEmpty(t("inspectorWaitDataLinks"));
    return;
  }

  if (state.loadingChat) {
    elements.inspectorTitle.textContent = t("inspectorLoadingTitle");
    elements.inspectorSubtitle.textContent = t("inspectorLoadingSubtitle");
    elements.inspectorStats.innerHTML = renderInspectorEmpty(t("inspectorLoadingStats"));
    elements.inspectorMediaLabel.textContent = t("inspectorLoadingMediaLabel");
    elements.inspectorMediaGrid.innerHTML = renderInspectorEmpty(t("inspectorLoadingMedia"));
    elements.inspectorLinkLabel.textContent = t("inspectorLoadingLinkLabel");
    elements.inspectorLinkList.innerHTML = renderInspectorEmpty(t("inspectorLoadingLinks"));
    return;
  }

  if (state.chatError) {
    elements.inspectorTitle.textContent = t("inspectorErrorTitle");
    elements.inspectorSubtitle.textContent = state.chatError;
    elements.inspectorStats.innerHTML = renderInspectorEmpty(t("inspectorErrorStats"));
    elements.inspectorMediaLabel.textContent = t("inspectorErrorMediaLabel");
    elements.inspectorMediaGrid.innerHTML = renderInspectorEmpty(t("inspectorErrorMedia"));
    elements.inspectorLinkLabel.textContent = t("inspectorErrorLinkLabel");
    elements.inspectorLinkList.innerHTML = renderInspectorEmpty(t("inspectorErrorLinks"));
    return;
  }

  if (!chat) {
    elements.inspectorTitle.textContent = t("inspectorWaitChatTitle");
    elements.inspectorSubtitle.textContent = t("inspectorWaitChatSubtitle");
    elements.inspectorStats.innerHTML = renderInspectorEmpty(t("inspectorWaitChatStats"));
    elements.inspectorMediaLabel.textContent = t("mediaLabel");
    elements.inspectorMediaGrid.innerHTML = renderInspectorEmpty(t("inspectorWaitDataMedia"));
    elements.inspectorLinkLabel.textContent = t("linkLabel");
    elements.inspectorLinkList.innerHTML = renderInspectorEmpty(t("inspectorWaitDataLinks"));
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
    renderInspectorStat(t("inspectorLoadedLabel"), formatNumber(messages.length)),
    renderInspectorStat(t("inspectorImageLabel"), formatNumber(imageMessages.length)),
    renderInspectorStat(t("inspectorVideoLabel"), formatNumber(videoMessages.length)),
    renderInspectorStat(t("inspectorLinkCountLabel"), formatNumber(links.length)),
  ].join("");

  const mediaItems = [
    ...imageMessages.slice(0, 4).map((message) => renderInspectorMediaItem(message, t("inspectorImageLabel"))),
    ...videoMessages.slice(0, 3).map((message) => renderInspectorMediaItem(message, t("inspectorVideoLabel"))),
    ...emojiMessages.slice(0, 3).map((message) => renderInspectorMediaItem(message, t("inspectorEmojiLabel"))),
  ];
  elements.inspectorMediaLabel.textContent = t("inspectorMediaLoaded", {
    count: formatNumber(imageMessages.length + videoMessages.length + emojiMessages.length),
  });
  elements.inspectorMediaGrid.innerHTML = mediaItems.length
    ? mediaItems.join("")
    : renderInspectorEmpty(t("inspectorNoMedia"));

  elements.inspectorLinkLabel.textContent = t("inspectorLinksLoaded", {
    count: formatNumber(links.length),
  });
  elements.inspectorLinkList.innerHTML = links.length
    ? links.slice(0, 8).map((link) => renderInspectorLinkItem(link)).join("")
    : renderInspectorEmpty(t("inspectorNoLinks"));
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
      <small>${escapeHtml(message.text || t("inspectorMediaFallback", { label }))}</small>
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
  const target = elements.messageStream?.querySelector(`#msg-${String(localId)}`);
  if (!target) {
    return;
  }
  target.scrollIntoView({ block: "center", behavior: "smooth" });
}

function renderMessageBody(message) {
  if (message.displayType === "image") {
    if (!message.imageUrl) {
      return renderMediaPlaceholder(t("imageMessage"), t("imageMessageUnavailable"), "image");
    }
    const targetUrl = message.imageFullUrl || message.imageUrl;
    return `
      <figure class="message-image-wrap">
        <a class="message-image-link" href="${escapeAttr(targetUrl)}" target="_blank" rel="noreferrer">
          <img class="message-image" src="${escapeAttr(message.imageUrl)}" alt="${escapeAttr(message.text || t("imageMessage"))}" loading="lazy" decoding="async" />
        </a>
        <figcaption>${escapeHtml(message.text || t("imageMessage"))}</figcaption>
      </figure>
    `;
  }
  if (message.displayType === "video") {
    if (!message.videoUrl) {
      return renderMediaPlaceholder(t("videoMessage"), t("videoMessageUnavailable"), "video");
    }
    return `
      <figure class="message-video-wrap">
        <video class="message-video" controls preload="metadata">
          <source src="${escapeAttr(message.videoUrl)}" type="${escapeAttr(message.videoMimeType || "video/mp4")}" />
          ${escapeHtml(t("videoUnsupported"))}
        </video>
        <figcaption>
          <span>${escapeHtml(message.text || t("videoMessage"))}</span>
          <a href="${escapeAttr(message.videoUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t("openOriginalVideo"))}</a>
        </figcaption>
      </figure>
    `;
  }
  if (message.displayType === "emoji") {
    return `
      <div class="message-emoji-card">
        <span class="message-emoji-glyph" aria-hidden="true">☺</span>
        <span>
          <strong>${escapeHtml(message.text || t("emojiMessage"))}</strong>
          <small>${message.mediaId ? `ID ${escapeHtml(shortenMediaId(message.mediaId))}` : escapeHtml(t("customEmoji"))}</small>
        </span>
      </div>
    `;
  }
  if (message.displayType === "link" && message.links?.length) {
    const firstLink = message.links[0];
    return `
      <a class="message-link-card" href="${escapeAttr(firstLink)}" target="_blank" rel="noreferrer">
        <span class="message-link-kicker">${escapeHtml(t("linkCardKicker"))}</span>
        <strong>${escapeHtml(message.text && message.text !== firstLink ? message.text : readableUrl(firstLink))}</strong>
        <small>${escapeHtml(readableUrl(firstLink))}</small>
      </a>
    `;
  }
  if (message.displayType === "link") {
    return renderMediaPlaceholder(t("linkMessage"), t("linkMessageUnavailable"), "link");
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

function isBrowsableSession(item) {
  const username = String(item?.username || "");
  return !username.startsWith("@placeholder_");
}

function buildStatusNote(status) {
  if (!status?.accounts?.length) {
    const roots = status?.searchRoots?.length ? joinList(status.searchRoots) : t("wechatRootNoRoots");
    return t("statusNoteNoAccounts", { roots });
  }
  if (!status.hasRunningWeixin) {
    return t("statusNoteNoWeixin");
  }
  if (!status.prepared) {
    const matchedPrefix = status.matchedAccountId ? t("statusNoteMatchedPrefix", { account: status.matchedAccountId }) : "";
    return t("statusNoteNeedPrepare", { matchedPrefix });
  }
  return t("statusNotePrepared", { outputRoot: status.outputRoot });
}

function buildConversationSubtitle(contact) {
  const parts = [contact.username];
  if (contact.remark) {
    parts.push(`${t("contactRemarkPrefix")}: ${contact.remark}`);
  }
  if (contact.alias) {
    parts.push(`${t("contactAliasPrefix")}: ${contact.alias}`);
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
  const locale = getDateLocale();
  if (diffHours < 24) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (diffHours < 24 * 6) {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(date);
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "-";
  }
  return new Intl.DateTimeFormat(getDateLocale(), {
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
  return new Intl.DateTimeFormat(getDateLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(timestamp * 1000));
}

function formatNumber(value) {
  return new Intl.NumberFormat(getNumberLocale()).format(value || 0);
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
  state.toastMessage = { raw: String(message ?? "") };
  renderToast();
}

function showToastKey(key, params = {}) {
  state.toastMessage = { key, params };
  renderToast();
}

function renderToast() {
  if (!elements.toast) {
    return;
  }
  window.clearTimeout(state.toastTimer);
  if (!state.toastMessage) {
    elements.toast.classList.remove("visible");
    return;
  }
  elements.toast.textContent = resolveEntryText(state.toastMessage);
  elements.toast.classList.add("visible");
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
    state.toastMessage = null;
  }, 3200);
}

function resolveErrorMessage(error, fallback = "") {
  if (error instanceof Error && error.message) {
    return localizeMessage(error.message);
  }
  if (typeof error === "string" && error) {
    return localizeMessage(error);
  }
  return fallback;
}

function resolveEntryText(entry) {
  if (!entry) {
    return "";
  }
  if (entry.key) {
    return t(entry.key, entry.params || {});
  }
  return localizeMessage(entry.raw || "");
}

function joinList(items) {
  return items.join(t("dateLocale") === "zh-CN" ? "；" : "; ");
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
