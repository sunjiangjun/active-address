export type Locale = "en" | "zh";

const en = {
    subtitle:
      "Send native QDAY to many addresses in sequence to activate them. Your private key is used only in this browser and is never uploaded.",
    warningTitle: "Do not close or refresh this page",
    warningBody:
      "Transactions are sent one by one every 0.2s. Closing the tab, refreshing, or letting the computer sleep will interrupt the process. Transactions already broadcast will not be reversed.",
    sendConfig: "Send configuration",
    privateKey: "Private key",
    senderAddress: "Sender",
    currentBalance: "Balance",
    gasReserveHint:
      "Keep {reserve} QDAY for gas. Balance must be ≥ max spend + {reserve} QDAY.",
    maxSpend: "Max QDAY to spend",
    addressCount: "Recipient count",
    specifiedAddresses: "Specified recipients (optional, comma or newline separated)",
    specifiedHint:
      "If specified addresses are fewer than the required count, a 12-word mnemonic is generated and addresses are derived with {path}. Each amount is random within the max spend; all amounts sum to the max spend.",
    prepare: "Generate addresses & verify",
    preparing: "Verifying…",
    start: "Start sending",
    stop: "Stop",
    resume: "Resume",
    allDone: "All done",
    progress: "Progress",
    totalTx: "Total transactions",
    remainingTx: "Remaining",
    completedTx: "Completed",
    eta: "Estimated time",
    amountRange: "Random {min} – {max} QDAY per tx, total {sum} QDAY, interval {ms} ms.",
    mnemonicTitle: "Generated mnemonic",
    copy: "Copy",
    copied: "Copied",
    download: "Download",
    mnemonicPathHint:
      "Derivation path {path}/i. Back it up before leaving this page, or the generated addresses cannot be recovered.",
    mnemonicAck: "I have backed up the mnemonic",
    recipients: "Recipients",
    specifiedGenerated: "Specified {specified} · Generated {generated}",
    recipientsEmpty: "The full address list will appear here after verification.",
    txLog: "Transaction log",
    time: "Time",
    recipient: "Recipient",
    amount: "Amount",
    status: "Status",
    hashOrError: "Hash / error",
    logEmpty: "Each transaction will be recorded here in order after sending starts.",
    sent: "Sent",
    failed: "Failed",
    aboutSeconds: "about {seconds}s",
    aboutMinutes: "about {minutes}m {seconds}s",
    placeholderSpend: "e.g. 100",
    placeholderCount: "e.g. 20",
    backupMnemonicFirst: "Back up the mnemonic and check the confirmation box before sending.",
    stoppedManually: "Sending was stopped. Closing or refreshing the page also interrupts the process.",
    needPrivateKey: "Enter the sender private key",
    needMaxSpend: "Enter the maximum QDAY amount to spend",
    needPositiveCount: "Recipient count must be an integer greater than 0",
    invalidAddress: "Invalid recipient address: {address}",
    invalidPrivateKey: "Invalid private key. It must be 64 hexadecimal characters.",
    insufficientBalance:
      "Insufficient balance: {have} QDAY now, need at least {need} QDAY (max spend {spend} + {reserve} QDAY gas reserve)",
    spendMustBePositive: "Max spend must be greater than 0",
    spendTooSmall: "Max spend is too small to assign a positive amount to each recipient",
    mnemonicNone: "mnemonic: (not generated; all recipients were specified)",
    beforeUnload: "Transactions are being sent. Closing or refreshing will interrupt the process.",
  } as const;

const zh: { [K in keyof typeof en]: string } = {
    subtitle:
      "向多个地址连续发送原生 QDAY，用于激活地址。私钥仅在浏览器本地签名，不会上传。",
    warningTitle: "请勿关闭或刷新页面",
    warningBody:
      "交易按 0.2 秒一笔顺序发送。关闭标签页、刷新页面或电脑休眠都会中断当前流程，已发出的交易不会回滚。",
    sendConfig: "发送配置",
    privateKey: "私钥",
    senderAddress: "发送地址",
    currentBalance: "当前余额",
    gasReserveHint: "Gas 预留 {reserve} QDAY，余额需 ≥ 最大花费 + {reserve} QDAY",
    maxSpend: "最大花费 QDAY 数额",
    addressCount: "接收地址数量",
    specifiedAddresses: "指定接收地址（可选，逗号或换行分隔）",
    specifiedHint:
      "若指定地址数量不足，将自动生成 12 词助记词，并按 {path} 补齐地址。每笔金额在最大花费额度内随机生成，全部交易额之和等于最大花费。",
    prepare: "生成地址并校验",
    preparing: "校验中…",
    start: "开始发送",
    stop: "停止发送",
    resume: "继续发送",
    allDone: "已全部完成",
    progress: "发送进度",
    totalTx: "待执行总交易",
    remainingTx: "待执行剩余",
    completedTx: "已完成交易",
    eta: "预计耗时",
    amountRange: "每笔随机 {min} – {max} QDAY，总额 {sum} QDAY，间隔 {ms} ms。",
    mnemonicTitle: "自动生成的助记词",
    copy: "复制",
    copied: "已复制",
    download: "下载",
    mnemonicPathHint: "派生路径 {path}/i。关闭页面前请务必备份，否则生成的地址将无法找回。",
    mnemonicAck: "我已备份助记词",
    recipients: "接收地址",
    specifiedGenerated: "指定 {specified} · 生成 {generated}",
    recipientsEmpty: "校验后将在这里显示完整地址列表。",
    txLog: "交易日志",
    time: "时间",
    recipient: "接收地址",
    amount: "交易额",
    status: "状态",
    hashOrError: "哈希 / 错误",
    logEmpty: "开始发送后，这里会按顺序记录每笔交易。",
    sent: "已发送",
    failed: "失败",
    aboutSeconds: "约 {seconds} 秒",
    aboutMinutes: "约 {minutes} 分 {seconds} 秒",
    placeholderSpend: "例如 100",
    placeholderCount: "例如 20",
    backupMnemonicFirst: "请先备份助记词，并勾选确认后再开始发送。",
    stoppedManually: "流程已手动停止。关闭或刷新页面也会中断发送。",
    needPrivateKey: "请输入发送方私钥",
    needMaxSpend: "请输入最大花费 QDAY 数额",
    needPositiveCount: "接收地址数量必须是大于 0 的整数",
    invalidAddress: "无效的接收地址：{address}",
    invalidPrivateKey: "私钥格式不正确，需要 64 位十六进制字符",
    insufficientBalance:
      "余额不足：当前 {have} QDAY，至少需要 {need} QDAY（最大花费 {spend} + 预留 {reserve} QDAY 作为 gas）",
    spendMustBePositive: "最大花费数额必须大于 0",
    spendTooSmall: "最大花费数额过小，无法为每个接收地址分配大于 0 的金额",
    mnemonicNone: "mnemonic: (未生成，全部使用指定地址)",
    beforeUnload: "交易正在发送中，关闭或刷新页面会中断流程。",
  };

export const messages = { en, zh } as const;

export type MessageKey = keyof typeof messages.en;

export class AppError extends Error {
  readonly key: MessageKey;
  readonly params?: Record<string, string>;

  constructor(key: MessageKey, params?: Record<string, string>) {
    super(key);
    this.name = "AppError";
    this.key = key;
    this.params = params;
  }
}

export function t(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let text: string = messages[locale][key] ?? messages.en[key];
  if (!params) return text;
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export function formatError(locale: Locale, error: unknown): string {
  if (error instanceof AppError) {
    return t(locale, error.key, error.params);
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

const STORAGE_KEY = "qday-active-address-locale";

export function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  return "en";
}

export function writeLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}
