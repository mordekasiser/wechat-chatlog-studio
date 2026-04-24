const STORAGE_KEY = "chatlog-studio.locale";
const SUPPORTED_LOCALES = new Set(["zh-CN", "en"]);

const translations = {
  "zh-CN": {
    htmlLang: "zh-CN",
    pageTitle: "聊天档案台",
    brandTitle: "聊天档案台",
    switchLabel: "界面语言",
    switchOptionZh: "中文",
    switchOptionEn: "英文",
    sidebarEyebrow: "私人档案工作台",
    sidebarDescription:
      "像翻阅编辑台上的档案卡一样查看你自己的微信记录。准备本地数据库后，就能在最近会话、联系人与媒体索引之间快速切换。",
    sidebarWeixinLabel: "微信",
    sidebarReadyLabel: "就绪",
    controlEyebrow: "档案控制",
    controlDescription: "先完成准备，再浏览会话。低频设置和缓存维护已折叠，避免干扰当前主任务。",
    prepareButton: "使用本地缓存 / 准备数据",
    prepareButtonBusy: "准备中...",
    progressWaiting: "等待任务开始",
    progressAria: "准备数据进度",
    accountLabel: "账号",
    accountSelectAria: "选择账号",
    searchLabel: "搜索会话",
    searchPlaceholder: "名字、备注、微信号标识、摘要",
    wechatRootEyebrow: "微信数据根目录",
    wechatRootDescription:
      "程序会先自动扫描常见位置；如果你的微信数据不在默认文档目录，比如被同步盘接管、放在其他磁盘，或自动发现失败，再手动指定微信文件根目录。选择后会优先按当前已登录微信去匹配对应账号。",
    wechatRootLabel: "微信文件根目录",
    wechatRootPlaceholder: "例如 %USERPROFILE%\\Documents\\xwechat_files",
    browseWechatRoot: "选择微信文件目录",
    browseWechatRootBusy: "打开中...",
    applyWechatRoot: "使用此目录",
    applyWechatRootBusy: "应用中...",
    resetWechatRoot: "恢复自动发现",
    wechatRootNote:
      "推荐直接选择 `xwechat_files` 根目录。也兼容直接选择单个账号目录；如果当前检测到运行中的微信，会优先自动匹配对应账号。",
    advancedSummary: "高级设置与缓存维护",
    outputRootEyebrow: "输出根目录",
    outputRootDescription: "统一管理解密数据、导出文件和媒体缓存。切换后会按账号自动建子目录。",
    outputRootLabel: "输出根目录",
    outputRootPlaceholder: "例如 D:\\聊天档案",
    browseOutputRoot: "选择文件夹",
    browseOutputRootBusy: "打开中...",
    applyOutputRoot: "应用目录",
    applyOutputRootBusy: "应用中...",
    resetOutputRoot: "恢复默认",
    outputRootDefaultNote: "未指定时使用默认本地缓存目录；准备数据、媒体缓存和文本导出会放在同一个根目录下。",
    cacheResetEyebrow: "缓存重建",
    cacheResetDescription: "仅删除本工具生成的缓存和解密副本，不影响原始微信数据库。",
    forcePrepareButton: "清空缓存并重新识别",
    archiveNavigatorEyebrow: "档案导航",
    searchStatusDefault: "最近会话优先显示，搜索时会把匹配会话和联系人分组呈现，方便快速定位。",
    headlineEyebrow: "掌控你的本地档案",
    headlineTitle: "把微信聊天整理成一张可翻阅、可检索、可导出的本地档案台",
    headlineStatus: "打开微信并保持登录后，点击“使用本地缓存 / 准备数据”。所有数据处理都留在这台机器上。",
    statusContacts: "联系人",
    statusSessions: "会话",
    statusExports: "导出",
    statusDbs: "解密库",
    conversationEyebrow: "会话",
    conversationTitle: "选择一个会话",
    conversationSubtitle: "准备完成后，从左侧选择一个会话、联系人或搜索结果。",
    loadFullButton: "加载更早消息",
    loadFullButtonBusy: "正在加载...",
    exportButton: "导出当前会话",
    conversationBanner: "最近 400 条消息会优先载入，完整时间线可按需展开，避免首次打开卡顿。",
    emptyKickerReady: "准备就绪",
    emptyTitleReady: "先准备本地数据，再开始浏览聊天记录。",
    emptyBodyReady:
      "这个页面不会上传聊天内容，也不会改动原始加密数据库。它只是把你本机的解密结果做成一个更顺手的界面。",
    inspectorEyebrow: "检查面板",
    inspectorTitle: "等待选择会话",
    inspectorSubtitle: "这里会显示当前会话的媒体、链接和联系人信息。",
    mediaShelfEyebrow: "媒体架",
    mediaLabel: "当前未载入媒体",
    linkIndexEyebrow: "链接索引",
    linkLabel: "当前未载入链接",
    privateDefaultKicker: "默认只在本地运行",
    sidebarEmptyTitle: "还没有准备本地数据",
    sidebarEmptyBody: "先登录微信，再点击“使用本地缓存 / 准备数据”。准备完成后，这里会显示最近会话和搜索结果。",
    sidebarSectionMatchedSessions: "匹配会话",
    sidebarSectionRecentSessions: "最近会话",
    sidebarSectionMatchedContacts: "匹配联系人",
    noSessionCard: "暂无结果",
    noRecentSessions: "没有匹配到最近会话。",
    noContactMatches: "没有额外联系人结果。",
    noSummary: "暂无摘要",
    contactTag: "联系人",
    directContactResult: "直接联系人结果",
    noMessagesKicker: "暂无消息",
    noMessagesTitle: "这个联系人当前没有可显示的消息。",
    inspectorWaitDataTitle: "等待本地数据",
    inspectorWaitDataSubtitle: "准备完成后，这里会汇总当前会话的媒体、链接和消息统计。",
    inspectorWaitDataStats: "尚未准备本地聊天数据。",
    inspectorWaitDataMedia: "图片、视频和表情索引会在这里出现。",
    inspectorWaitDataLinks: "文本中的 URL 和分享链接会在这里归档。",
    inspectorLoadingTitle: "正在载入会话",
    inspectorLoadingSubtitle: "请稍候，右侧索引会随着时间线一起刷新。",
    inspectorLoadingStats: "正在整理当前会话的统计和媒体。",
    inspectorLoadingMediaLabel: "媒体索引整理中",
    inspectorLoadingMedia: "正在扫描图片、视频和表情消息。",
    inspectorLoadingLinkLabel: "链接索引整理中",
    inspectorLoadingLinks: "正在扫描消息里的 URL。",
    inspectorErrorTitle: "会话读取失败",
    inspectorErrorStats: "没有保留旧统计，请重新选择会话。",
    inspectorErrorMediaLabel: "当前无可用媒体",
    inspectorErrorMedia: "无法读取媒体索引。",
    inspectorErrorLinkLabel: "当前无可用链接",
    inspectorErrorLinks: "无法读取链接索引。",
    inspectorWaitChatTitle: "等待选择会话",
    inspectorWaitChatSubtitle: "选择左侧任意会话后，这里会出现媒体、链接和联系人摘要。",
    inspectorWaitChatStats: "会话统计会显示已载入条数、媒体数和链接数。",
    inspectorLoadedLabel: "已载入",
    inspectorImageLabel: "图片",
    inspectorVideoLabel: "视频",
    inspectorLinkCountLabel: "链接",
    inspectorEmojiLabel: "表情",
    inspectorMediaLoaded: ({ count }) => `当前已载入 ${count} 条媒体消息`,
    inspectorNoMedia: "当前已载入消息里还没有图片、视频或表情。",
    inspectorLinksLoaded: ({ count }) => `当前已载入 ${count} 条链接`,
    inspectorNoLinks: "当前已载入消息里还没有解析到链接。",
    inspectorMediaFallback: ({ label }) => `${label}消息`,
    imageMessage: "图片消息",
    imageMessageUnavailable: "本地图片暂时无法预览，但消息类型已正确识别。",
    videoMessage: "视频消息",
    videoMessageUnavailable: "未在本机缓存中找到可播放视频文件。",
    videoUnsupported: "当前浏览器无法播放这个视频。",
    openOriginalVideo: "打开原视频",
    emojiMessage: "表情消息",
    customEmoji: "自定义表情",
    linkMessage: "链接/分享消息",
    linkMessageUnavailable: "该分享内容没有可解析链接，已保留消息类型。",
    linkCardKicker: "链接",
    statusChecking: "检测中",
    statusWeixinOn: "已登录",
    statusWeixinOff: "未打开",
    statusReadyOn: "已就绪",
    statusReadyOff: "待准备",
    searchPreparedHint: "准备完成后，这里会显示最近会话；输入关键词时会自动筛选联系人和会话。",
    searchRecent: ({ count }) => `当前显示最近会话 ${count} 条。需要时可搜索备注、昵称、微信号标识或摘要。`,
    searchMatched: ({ query, sessions, contacts }) => `关键词“${query}”匹配到 ${sessions} 个会话、${contacts} 个联系人。`,
    noAccountsOption: "未发现本地账号",
    accountPreparedSuffix: "已准备",
    accountUnpreparedSuffix: "未准备",
    accountMatchedSuffix: " · 当前登录",
    confirmForcePrepare:
      "这会清空本工具生成的解密缓存和图片缓存，然后从本机微信数据重新识别。原始微信数据库不会被修改。继续吗？",
    switchingAccount: "正在切换账号上下文…",
    switchAccountFailed: "切换账号失败",
    bootstrapFailed: "初始化失败",
    prepareQueuedForce: "准备清空缓存并重新识别",
    prepareQueuedNormal: "正在检查本地缓存",
    preparingForceFeedback: "正在清理旧缓存并重建…",
    preparingNormalFeedback: "正在检查并准备本地缓存…",
    preparingForceToast: "正在清空缓存并重新准备数据。",
    preparingNormalToast: "正在准备本地数据，已有缓存会直接复用。",
    prepareSucceededCache: "已复用本地缓存，可直接浏览和导出。",
    prepareSucceededFresh: "准备完成，现在可以浏览会话和导出记录。",
    prepareToastCache: "已复用本地缓存。",
    prepareToastFresh: ({ count }) => `已准备 ${count} 个数据库文件。`,
    prepareFailed: "准备任务失败",
    chatLoadFailed: "聊天内容载入失败",
    exportSuccessFeedback: ({ name, path }) => `已导出 ${name}，文件位于 ${path}`,
    exportSuccessToast: ({ name, path }) => `已导出 ${name} 到 ${path}`,
    updatingWechatRoot: "正在更新微信文件目录…",
    resettingWechatRoot: "正在恢复自动发现…",
    wechatRootUpdated: ({ path }) => `微信文件目录已切换到 ${path}`,
    wechatRootReset: "已恢复自动发现微信文件目录",
    updatingOutputRoot: "正在更新输出目录…",
    outputRootUpdated: ({ path }) => `输出目录已切换到 ${path}`,
    outputRootDefaultCurrent: ({ current }) => `当前使用默认输出目录：${current}`,
    outputRootCurrent: ({ current, defaultValue }) => `当前输出目录：${current}。默认目录：${defaultValue}`,
    wechatRootManualCurrent: ({ current, matched }) => `当前手动目录：${current}。${matched}`,
    wechatRootMatchedCurrent: ({ matched }) => `当前自动匹配账号：${matched}`,
    wechatRootNoMatched: "当前未匹配到运行中的微信账号，将回退到首个可用账号。",
    wechatRootAutoCurrent: ({ roots }) => `当前使用自动发现。扫描位置：${roots}`,
    wechatRootNoRoots: "未检测到可扫描位置",
    pendingConversationSpecific: ({ name }) => `正在载入 ${name} 的聊天内容…`,
    pendingConversationGeneric: "正在载入聊天内容…",
    loadingConversationBanner: "正在切换会话，旧内容已冻结，完成后会自动刷新到最新位置。",
    conversationWaitTitle: "等待会话",
    conversationWaitSubtitle: "准备完成后，从左侧选择一个会话或联系人。",
    conversationWaitBanner: "最近 400 条消息会优先载入，完整时间线可按需展开，避免首次打开卡顿。",
    loadFailedTitle: "无法载入会话",
    loadFailedSubtitleSpecific: ({ name }) => `目标会话：${name}`,
    loadFailedSubtitleGeneric: "当前会话暂时无法读取。",
    loadFailedBanner: "可以重新点击左侧会话、检查本地缓存，或重新准备数据后再试。",
    loadFailedKicker: "载入失败",
    loadFailedHeading: "没有显示旧聊天内容。",
    selectConversationTitle: "选择一个会话",
    selectConversationSubtitle: "左侧可以查看最近会话，或者搜索备注、昵称、微信号标识。",
    selectConversationBanner: "准备完成后，点击任意会话即可浏览文本内容并导出。",
    selectConversationKicker: "会话视图",
    selectConversationHeading: "左侧选一个会话，时间线就会出现在这里。",
    selectConversationBody: "默认先显示最近 400 条消息，然后可以继续向前翻阅更早内容。",
    conversationBannerTruncated: ({ returned, total }) =>
      `当前显示 ${returned} / ${total} 条消息。点击“加载更早消息”会继续向前翻页，并保持当前滚动位置。`,
    conversationBannerFull: ({ total }) => `共载入 ${total} 条消息。导出按钮会生成标准编码文本文件。`,
    statusNoteNoAccounts: ({ roots }) => `还没有在这些位置发现可用账号目录：${roots}。先登录微信桌面版，或手动选择微信文件根目录。`,
    statusNoteNoWeixin: "已发现本地账号目录，但当前没有检测到运行中的微信桌面版进程。要自动匹配并准备当前账号，需要先打开并登录微信。",
    statusNoteMatchedPrefix: ({ account }) => `当前已自动匹配到 ${account}。`,
    statusNoteNeedPrepare: ({ matchedPrefix }) => `${matchedPrefix}现在可以点击“使用本地缓存 / 准备数据”，生成仅供本机检索与导出的解密副本。`,
    statusNotePrepared: ({ outputRoot }) => `当前账号已准备完成。工作副本目录：${outputRoot}`,
    contactRemarkPrefix: "备注",
    contactAliasPrefix: "别名",
    taskProcessing: "任务处理中",
    taskQueued: "任务排队中",
    taskForce: "正在清空缓存并重新识别",
    taskCheckCache: "正在检查本地缓存",
    taskUsingCache: "已复用本地缓存",
    taskCompleted: "准备完成",
    taskFailed: "准备失败",
    taskValidating: ({ file }) => `正在校验 ${file}`,
    taskDecrypting: ({ file }) => `正在解密 ${file}`,
    taskUsingExistingCache: "已使用现有本地缓存",
    genericStartFailed: "启动聊天档案台失败。",
    dateLocale: "zh-CN",
    numberLocale: "zh-CN",
  },
  en: {
    htmlLang: "en",
    pageTitle: "Chatlog Archive Desk",
    brandTitle: "Chatlog Archive Desk",
    switchLabel: "Interface language",
    switchOptionZh: "Chinese",
    switchOptionEn: "English",
    sidebarEyebrow: "Private archive workstation",
    sidebarDescription:
      "Review your own WeChat history like archive cards on an editorial desk. Once local databases are prepared, you can move quickly between recent chats, contacts, and media indexes.",
    sidebarWeixinLabel: "Weixin",
    sidebarReadyLabel: "Ready",
    controlEyebrow: "Archive Control",
    controlDescription: "Prepare first, then browse conversations. Less frequent settings and cache maintenance stay folded away to keep the main task focused.",
    prepareButton: "Use Local Cache / Prepare Data",
    prepareButtonBusy: "Preparing...",
    progressWaiting: "Waiting for task to start",
    progressAria: "Prepare data progress",
    accountLabel: "Account",
    accountSelectAria: "Select account",
    searchLabel: "Search chats",
    searchPlaceholder: "Name, remark, wxid, summary",
    wechatRootEyebrow: "WeChat Data Root",
    wechatRootDescription:
      "The app scans common locations first. If your WeChat data is not under the default Documents folder, is managed by OneDrive, lives on another drive, or auto-discovery fails, manually choose the WeChat data root. The app will then prefer the currently signed-in WeChat account when it can match one.",
    wechatRootLabel: "WeChat data root",
    wechatRootPlaceholder: "For example %USERPROFILE%\\Documents\\xwechat_files",
    browseWechatRoot: "Choose WeChat folder",
    browseWechatRootBusy: "Opening...",
    applyWechatRoot: "Use this folder",
    applyWechatRootBusy: "Applying...",
    resetWechatRoot: "Restore auto-discovery",
    wechatRootNote:
      "Choosing the `xwechat_files` root is recommended. A single account directory also works. If a running WeChat session is detected, the app will try to match the active account automatically.",
    advancedSummary: "Advanced Settings & Cache Maintenance",
    outputRootEyebrow: "Output Root",
    outputRootDescription: "Manage `decrypted`, `exports`, and `media` under one root. Each account gets its own subdirectory automatically.",
    outputRootLabel: "Output root",
    outputRootPlaceholder: "For example D:\\ChatlogArchive",
    browseOutputRoot: "Choose folder",
    browseOutputRootBusy: "Opening...",
    applyOutputRoot: "Apply folder",
    applyOutputRootBusy: "Applying...",
    resetOutputRoot: "Restore default",
    outputRootDefaultNote:
      "When unset, the default local cache directory is used. Prepared data, media cache, and text exports stay under the same root.",
    cacheResetEyebrow: "Cache Reset",
    cacheResetDescription: "This only removes cache and decrypted copies created by this tool. The original WeChat databases stay untouched.",
    forcePrepareButton: "Clear Cache and Rebuild",
    archiveNavigatorEyebrow: "Archive Navigator",
    searchStatusDefault: "Recent chats appear first. During search, matching chats and contacts are grouped separately to speed up navigation.",
    headlineEyebrow: "Own your desktop archive",
    headlineTitle: "Turn your WeChat history into a browsable, searchable, exportable local archive desk",
    headlineStatus: "Keep WeChat open and signed in, then click “Use Local Cache / Prepare Data”. All processing stays on this machine.",
    statusContacts: "Contacts",
    statusSessions: "Sessions",
    statusExports: "Exports",
    statusDbs: "Decrypted DBs",
    conversationEyebrow: "Conversation",
    conversationTitle: "Select a chat",
    conversationSubtitle: "After preparation finishes, choose a chat, contact, or search result from the left.",
    loadFullButton: "Load Older Messages",
    loadFullButtonBusy: "Loading...",
    exportButton: "Export Current Chat",
    conversationBanner: "The newest 400 messages load first. Expand the full timeline on demand to avoid a slow first paint.",
    emptyKickerReady: "Ready when you are",
    emptyTitleReady: "Prepare local data before browsing chat history.",
    emptyBodyReady:
      "This page does not upload chat content or change the original encrypted databases. It only turns local decrypted results into a more usable interface.",
    inspectorEyebrow: "Inspector",
    inspectorTitle: "Waiting for a selection",
    inspectorSubtitle: "Media, links, and contact details for the current chat appear here.",
    mediaShelfEyebrow: "Media shelf",
    mediaLabel: "No media loaded yet",
    linkIndexEyebrow: "Link index",
    linkLabel: "No links loaded yet",
    privateDefaultKicker: "Private by default",
    sidebarEmptyTitle: "Local data is not prepared yet",
    sidebarEmptyBody: "Sign in to WeChat first, then click “Use Local Cache / Prepare Data”. Recent chats and search results will appear here afterward.",
    sidebarSectionMatchedSessions: "Matching chats",
    sidebarSectionRecentSessions: "Recent chats",
    sidebarSectionMatchedContacts: "Matching contacts",
    noSessionCard: "No results",
    noRecentSessions: "No matching recent chats.",
    noContactMatches: "No additional contact matches.",
    noSummary: "No summary",
    contactTag: "Contact",
    directContactResult: "Direct contact result",
    noMessagesKicker: "No messages",
    noMessagesTitle: "No messages are currently available for this contact.",
    inspectorWaitDataTitle: "Waiting for local data",
    inspectorWaitDataSubtitle: "Once preparation finishes, this panel summarizes media, links, and message counts for the current chat.",
    inspectorWaitDataStats: "Local chat data has not been prepared yet.",
    inspectorWaitDataMedia: "Image, video, and emoji indexes will appear here.",
    inspectorWaitDataLinks: "URLs and shared links from messages will appear here.",
    inspectorLoadingTitle: "Loading conversation",
    inspectorLoadingSubtitle: "Please wait. The right-side index refreshes together with the timeline.",
    inspectorLoadingStats: "Collecting stats and media for the current conversation.",
    inspectorLoadingMediaLabel: "Building media index",
    inspectorLoadingMedia: "Scanning image, video, and emoji messages.",
    inspectorLoadingLinkLabel: "Building link index",
    inspectorLoadingLinks: "Scanning URLs inside messages.",
    inspectorErrorTitle: "Conversation load failed",
    inspectorErrorStats: "Previous stats were not kept. Please select a conversation again.",
    inspectorErrorMediaLabel: "No media available",
    inspectorErrorMedia: "The media index could not be loaded.",
    inspectorErrorLinkLabel: "No links available",
    inspectorErrorLinks: "The link index could not be loaded.",
    inspectorWaitChatTitle: "Waiting for a chat",
    inspectorWaitChatSubtitle: "Select any chat on the left to see media, links, and contact summaries here.",
    inspectorWaitChatStats: "Conversation stats will show loaded messages, media, and links.",
    inspectorLoadedLabel: "Loaded",
    inspectorImageLabel: "Images",
    inspectorVideoLabel: "Videos",
    inspectorLinkCountLabel: "Links",
    inspectorEmojiLabel: "Emoji",
    inspectorMediaLoaded: ({ count }) => `${count} media messages loaded`,
    inspectorNoMedia: "No images, videos, or emoji were found in the loaded messages yet.",
    inspectorLinksLoaded: ({ count }) => `${count} links loaded`,
    inspectorNoLinks: "No links were parsed from the loaded messages yet.",
    inspectorMediaFallback: ({ label }) => `${label} message`,
    imageMessage: "Image message",
    imageMessageUnavailable: "A local preview is not available right now, but the message type was identified correctly.",
    videoMessage: "Video message",
    videoMessageUnavailable: "No playable local video file was found in cache.",
    videoUnsupported: "This browser cannot play this video.",
    openOriginalVideo: "Open original video",
    emojiMessage: "Emoji message",
    customEmoji: "Custom emoji",
    linkMessage: "Link/share message",
    linkMessageUnavailable: "This shared item did not contain a parsable URL, but the message type was preserved.",
    linkCardKicker: "Link",
    statusChecking: "Checking",
    statusWeixinOn: "Signed in",
    statusWeixinOff: "Closed",
    statusReadyOn: "Ready",
    statusReadyOff: "Not ready",
    searchPreparedHint: "After preparation finishes, recent chats appear here. Enter a keyword to filter both contacts and chats automatically.",
    searchRecent: ({ count }) => `${count} recent chats shown. Search remarks, nicknames, wxid, or summaries when needed.`,
    searchMatched: ({ query, sessions, contacts }) => `“${query}” matched ${sessions} chats and ${contacts} contacts.`,
    noAccountsOption: "No local accounts found",
    accountPreparedSuffix: "prepared",
    accountUnpreparedSuffix: "not prepared",
    accountMatchedSuffix: " · currently signed in",
    confirmForcePrepare:
      "This clears decrypted cache and image cache created by this tool, then rebuilds from local WeChat data. The original WeChat databases will not be modified. Continue?",
    switchingAccount: "Switching account context…",
    switchAccountFailed: "Failed to switch account",
    bootstrapFailed: "Initialization failed",
    prepareQueuedForce: "Clearing cache and rebuilding",
    prepareQueuedNormal: "Checking local cache",
    preparingForceFeedback: "Clearing old cache and rebuilding…",
    preparingNormalFeedback: "Checking and preparing local cache…",
    preparingForceToast: "Clearing cache and preparing data again.",
    preparingNormalToast: "Preparing local data. Existing cache will be reused when possible.",
    prepareSucceededCache: "Local cache reused. You can browse and export immediately.",
    prepareSucceededFresh: "Preparation finished. Chats are ready to browse and export.",
    prepareToastCache: "Local cache reused.",
    prepareToastFresh: ({ count }) => `${count} database files prepared.`,
    prepareFailed: "Prepare task failed",
    chatLoadFailed: "Failed to load chat content",
    exportSuccessFeedback: ({ name, path }) => `${name} exported to ${path}`,
    exportSuccessToast: ({ name, path }) => `Exported ${name} to ${path}`,
    updatingWechatRoot: "Updating the WeChat data root…",
    resettingWechatRoot: "Restoring auto-discovery…",
    wechatRootUpdated: ({ path }) => `WeChat data root switched to ${path}`,
    wechatRootReset: "Auto-discovery for the WeChat data root has been restored",
    updatingOutputRoot: "Updating the output root…",
    outputRootUpdated: ({ path }) => `Output root switched to ${path}`,
    outputRootDefaultCurrent: ({ current }) => `Using the default output root: ${current}`,
    outputRootCurrent: ({ current, defaultValue }) => `Current output root: ${current}. Default: ${defaultValue}`,
    wechatRootManualCurrent: ({ current, matched }) => `Current manual root: ${current}. ${matched}`,
    wechatRootMatchedCurrent: ({ matched }) => `Matched running account: ${matched}`,
    wechatRootNoMatched: "No running WeChat account was matched. The first available account will be used as fallback.",
    wechatRootAutoCurrent: ({ roots }) => `Using auto-discovery. Scan locations: ${roots}`,
    wechatRootNoRoots: "No scan locations detected",
    pendingConversationSpecific: ({ name }) => `Loading chat content for ${name}…`,
    pendingConversationGeneric: "Loading chat content…",
    loadingConversationBanner: "Switching conversations. The old content is frozen and will refresh to the latest view automatically.",
    conversationWaitTitle: "Waiting for a conversation",
    conversationWaitSubtitle: "After preparation finishes, choose a chat or contact from the left.",
    conversationWaitBanner: "The newest 400 messages load first. Expand the full timeline on demand to avoid a slow first paint.",
    loadFailedTitle: "Conversation could not be loaded",
    loadFailedSubtitleSpecific: ({ name }) => `Target conversation: ${name}`,
    loadFailedSubtitleGeneric: "The current conversation cannot be read right now.",
    loadFailedBanner: "Try selecting the chat again, checking local cache, or preparing data once more.",
    loadFailedKicker: "Load failed",
    loadFailedHeading: "Older chat content could not be shown.",
    selectConversationTitle: "Select a conversation",
    selectConversationSubtitle: "Browse recent chats on the left, or search by remark, nickname, or wxid.",
    selectConversationBanner: "After preparation finishes, click any chat to browse text content and export it.",
    selectConversationKicker: "Conversation view",
    selectConversationHeading: "Pick a chat on the left and the timeline will appear here.",
    selectConversationBody: "The newest 400 messages are shown first, then you can keep paging backward for older content.",
    conversationBannerTruncated: ({ returned, total }) =>
      `Showing ${returned} / ${total} messages. Click “Load Older Messages” to page backward while keeping the current scroll position.`,
    conversationBannerFull: ({ total }) => `${total} messages loaded. The export button writes a UTF-8 text file.`,
    statusNoteNoAccounts: ({ roots }) => `No usable account directories were found in these locations: ${roots}. Sign in to WeChat desktop first, or choose the WeChat data root manually.`,
    statusNoteNoWeixin: "Local account directories were found, but no running Weixin.exe process was detected. Open and sign in to WeChat to auto-match and prepare the current account.",
    statusNoteMatchedPrefix: ({ account }) => `Matched current account: ${account}. `,
    statusNoteNeedPrepare: ({ matchedPrefix }) => `${matchedPrefix}You can now click “Use Local Cache / Prepare Data” to create decrypted working copies for local browsing and export only.`,
    statusNotePrepared: ({ outputRoot }) => `The current account is prepared. Working copy directory: ${outputRoot}`,
    contactRemarkPrefix: "remark",
    contactAliasPrefix: "alias",
    taskProcessing: "Task in progress",
    taskQueued: "Task queued",
    taskForce: "Clearing cache and rebuilding",
    taskCheckCache: "Checking local cache",
    taskUsingCache: "Using local cache",
    taskCompleted: "Preparation completed",
    taskFailed: "Preparation failed",
    taskValidating: ({ file }) => `Validating ${file}`,
    taskDecrypting: ({ file }) => `Decrypting ${file}`,
    taskUsingExistingCache: "Using existing local cache",
    genericStartFailed: "Failed to start Chatlog Studio.",
    dateLocale: "en-US",
    numberLocale: "en-US",
  },
};

let currentLocale = null;

function resolveLocale(value) {
  if (SUPPORTED_LOCALES.has(value)) {
    return value;
  }
  if (typeof value === "string" && value.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

function detectInitialLocale() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return resolveLocale(stored);
    }
  } catch {
    // Ignore storage access failures and fall back to browser settings.
  }
  const browserLocale = navigator.language || navigator.languages?.[0] || "en";
  return resolveLocale(browserLocale);
}

function persistLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore storage access failures.
  }
}

export function getCurrentLocale() {
  if (!currentLocale) {
    currentLocale = detectInitialLocale();
  }
  return currentLocale;
}

export function setLocale(locale) {
  currentLocale = resolveLocale(locale);
  persistLocale(currentLocale);
  applyStaticTranslations();
  return currentLocale;
}

export function t(key, params) {
  const locale = getCurrentLocale();
  const value = translations[locale]?.[key] ?? translations.en?.[key] ?? key;
  return typeof value === "function" ? value(params || {}) : value;
}

export function getDateLocale() {
  return t("dateLocale");
}

export function getNumberLocale() {
  return t("numberLocale");
}

function updateNodeText(node, key) {
  if (!node) {
    return;
  }
  node.textContent = t(key);
}

function updateNodeHtml(node, key) {
  if (!node) {
    return;
  }
  node.innerHTML = t(key);
}

function applyStaticTranslations() {
  document.documentElement.lang = t("htmlLang");
  document.title = t("pageTitle");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    updateNodeText(node, node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    updateNodeHtml(node, node.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });

  updateLocaleControls();
}

function updateLocaleControls() {
  const locale = getCurrentLocale();
  const switcher = document.querySelector("#language-select");
  if (switcher) {
    switcher.value = locale;
  }
  document.querySelectorAll("[data-locale-option]").forEach((node) => {
    const active = node.dataset.localeOption === locale;
    node.classList.toggle("active", active);
    node.setAttribute("aria-pressed", String(active));
  });
}

export function setupLanguageSwitcher(onChange) {
  const buttons = Array.from(document.querySelectorAll("[data-locale-option]"));
  if (buttons.length) {
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const locale = setLocale(button.dataset.localeOption);
        onChange?.(locale);
      });
    });
    applyStaticTranslations();
    return;
  }

  const switcher = document.querySelector("#language-select");
  if (!switcher) {
    applyStaticTranslations();
    return;
  }
  switcher.addEventListener("change", (event) => {
    const locale = setLocale(event.target.value);
    onChange?.(locale);
  });
  applyStaticTranslations();
}

function translatePattern(message, locale) {
  const patterns = locale === "zh-CN"
    ? [
        [/^Checking local cache$/i, () => t("taskCheckCache")],
        [/^Clearing cache and rebuilding$/i, () => t("taskForce")],
        [/^Using local cache$/i, () => t("taskUsingCache")],
        [/^Using existing local cache$/i, () => t("taskUsingExistingCache")],
        [/^Preparation completed$/i, () => t("taskCompleted")],
        [/^Preparation failed$/i, () => t("taskFailed")],
        [/^Validating (.+)$/i, (match) => t("taskValidating", { file: match[1] })],
        [/^Decrypting (.+)$/i, (match) => t("taskDecrypting", { file: match[1] })],
        [/^path does not exist: (.+)$/i, (match) => `路径不存在：${match[1]}`],
        [/^path is not a directory: (.+)$/i, (match) => `路径不是目录：${match[1]}`],
        [/^no account directories found under: (.+)$/i, (match) => `在以下位置未找到账号目录：${match[1]}`],
        [/^unknown account: (.+)$/i, (match) => `未知账号：${match[1]}`],
        [/^local data is not prepared yet$/i, () => "本地数据尚未准备完成"],
        [/^cannot change WeChat source directory while a prepare or rebuild task is running$/i, () => "准备或重建任务运行期间，不能修改微信数据根目录"],
        [/^cannot change output directory while a prepare or rebuild task is running$/i, () => "准备或重建任务运行期间，不能修改输出目录"],
        [/^output directory points to a file: (.+)$/i, (match) => `输出目录指向了文件：${match[1]}`],
        [/^another prepare or rebuild task is already running for: (.+)$/i, (match) => `该账号已有准备或重建任务在运行：${match[1]}`],
        [/^unknown task: (.+)$/i, (match) => `未知任务：${match[1]}`],
        [/^query is required$/i, () => "必须提供查询内容"],
        [/^folder picker is unavailable: (.+)$/i, (match) => `文件夹选择器不可用：${match[1]}`],
        [/^UI assets not found$/i, () => "未找到界面资源文件"],
        [/^refusing non-local bind; pass --allow-remote to expose the local web UI$/i, () => "拒绝非本地地址绑定；如需暴露本地网页界面，请传入 --allow-remote"],
        [/^Request failed: (\d+)$/i, (match) => `请求失败：${match[1]}`],
      ]
    : [];

  for (const [pattern, replacer] of patterns) {
    const match = message.match(pattern);
    if (match) {
      return replacer(match);
    }
  }
  return message;
}

export function localizeMessage(message) {
  const text = String(message ?? "");
  if (!text) {
    return text;
  }
  return translatePattern(text, getCurrentLocale());
}

export function localizeTaskMessage(message) {
  const text = localizeMessage(message);
  if (text !== message) {
    return text;
  }
  return text;
}
