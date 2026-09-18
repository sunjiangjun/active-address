import { formatEther, parseEther } from "ethers";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Play,
  Square,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AppError,
  formatError,
  readLocale,
  t,
  writeLocale,
  type Locale,
} from "./i18n";
import { QDAY_CHAIN } from "./lib/chain";
import { buildRecipientPlan, splitValueRandom, type RecipientPlan } from "./lib/recipients";
import {
  assertSpendableBalance,
  fetchSenderState,
  runSequentialTransfers,
  type TransferProgress,
} from "./lib/transfer";

type Phase = "idle" | "preparing" | "ready" | "running" | "done" | "stopped" | "failed";

type LogItem = TransferProgress & { at: string };

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatQday(wei: bigint): string {
  const raw = formatEther(wei);
  if (!raw.includes(".")) return raw;
  return raw.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ value, locale }: { value: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? t(locale, "copied") : t(locale, "copy")}
    </button>
  );
}

function AddressHover({ address }: { address: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <span
        className="cursor-default border-b border-dotted border-white/30"
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPos({ x: rect.left, y: rect.top });
        }}
        onMouseLeave={() => setPos(null)}
      >
        {shortAddress(address)}
      </span>
      {pos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 rounded-lg border border-white/15 bg-[#121c30] px-3 py-2 font-mono text-xs text-slate-100 shadow-2xl"
            style={{ left: pos.x, top: pos.y - 8, transform: "translateY(-100%)" }}
          >
            {address}
          </div>,
          document.body,
        )}
    </>
  );
}

function LanguageSwitch({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  const optionClass = (value: Locale) =>
    `px-3 py-1.5 text-xs font-medium ${
      locale === value ? "bg-accent text-ink-950" : "text-slate-300 hover:bg-white/10"
    }`;

  return (
    <div className="flex overflow-hidden rounded-lg border border-white/10">
      <button type="button" className={optionClass("en")} onClick={() => onChange("en")}>
        EN
      </button>
      <button type="button" className={optionClass("zh")} onClick={() => onChange("zh")}>
        中文
      </button>
    </div>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => readLocale());
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [maxSpend, setMaxSpend] = useState("");
  const [addressCount, setAddressCount] = useState("10");
  const [specifiedAddresses, setSpecifiedAddresses] = useState("");

  const [senderAddress, setSenderAddress] = useState("");
  const [senderBalance, setSenderBalance] = useState("");
  const [mnemonicBackupAck, setMnemonicBackupAck] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<unknown>(null);
  const [plan, setPlan] = useState<RecipientPlan | null>(null);
  const [perAmounts, setPerAmounts] = useState<bigint[]>([]);
  const [completed, setCompleted] = useState(0);
  const [logs, setLogs] = useState<LogItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const running = phase === "running";
  const total = plan?.recipients.length ?? 0;
  const remaining = Math.max(total - completed, 0);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  useEffect(() => {
    writeLocale(locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = t(locale, "beforeUnload");
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running, locale]);

  const estimatedTime = useMemo(() => {
    const ms = total <= 1 ? 0 : (total - 1) * QDAY_CHAIN.txIntervalMs;
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return t(locale, "aboutSeconds", { seconds });
    return t(locale, "aboutMinutes", { minutes, seconds });
  }, [total, locale]);

  const amountRangeLabel = useMemo(() => {
    if (perAmounts.length === 0) return "";
    let min = perAmounts[0];
    let max = perAmounts[0];
    let sum = 0n;
    for (const amount of perAmounts) {
      if (amount < min) min = amount;
      if (amount > max) max = amount;
      sum += amount;
    }
    return t(locale, "amountRange", {
      min: formatQday(min),
      max: formatQday(max),
      sum: formatQday(sum),
      ms: QDAY_CHAIN.txIntervalMs,
    });
  }, [perAmounts, locale]);

  async function loadSender() {
    if (!privateKey.trim()) {
      setSenderAddress("");
      setSenderBalance("");
      return;
    }
    try {
      const state = await fetchSenderState(privateKey);
      setSenderAddress(state.address);
      setSenderBalance(state.balanceQday);
      setError(null);
    } catch (err) {
      setSenderAddress("");
      setSenderBalance("");
      setError(err);
    }
  }

  function resetPrepared() {
    if (phase === "running") return;
    setPlan(null);
    setPerAmounts([]);
    setMnemonicBackupAck(false);
    setCompleted(0);
    setLogs([]);
    if (phase !== "idle") setPhase("idle");
  }

  async function buildPreparedState() {
    if (!privateKey.trim()) {
      throw new AppError("needPrivateKey");
    }
    if (!maxSpend.trim()) {
      throw new AppError("needMaxSpend");
    }
    const count = Number(addressCount);
    if (!Number.isInteger(count) || count < 1) {
      throw new AppError("needPositiveCount");
    }
    const nextPlan = buildRecipientPlan(specifiedAddresses, count);
    const spendWei = parseEther(maxSpend.trim());
    const amounts = splitValueRandom(spendWei, nextPlan.recipients.length);
    const state = await fetchSenderState(privateKey);
    assertSpendableBalance(state.balanceWei, maxSpend.trim());
    return { nextPlan, amounts, state };
  }

  function applyPreparedState(
    nextPlan: RecipientPlan,
    amounts: bigint[],
    state: { address: string; balanceQday: string },
  ) {
    setSenderAddress(state.address);
    setSenderBalance(state.balanceQday);
    setPlan(nextPlan);
    setPerAmounts(amounts);
    setCompleted(0);
    setLogs([]);
    setMnemonicBackupAck(!nextPlan.mnemonic);
  }

  async function prepare() {
    setError(null);
    setPhase("preparing");
    try {
      const { nextPlan, amounts, state } = await buildPreparedState();
      applyPreparedState(nextPlan, amounts, state);
      setPhase("ready");
    } catch (err) {
      setPlan(null);
      setPerAmounts([]);
      setPhase("idle");
      setError(err);
    }
  }

  async function start() {
    setError(null);
    const previousPhase = phase;
    let currentPlan = plan;
    let amounts = perAmounts;

    if (!currentPlan || amounts.length === 0) {
      setPhase("preparing");
      try {
        const prepared = await buildPreparedState();
        currentPlan = prepared.nextPlan;
        amounts = prepared.amounts;
        applyPreparedState(currentPlan, amounts, prepared.state);
      } catch (err) {
        setPlan(null);
        setPerAmounts([]);
        setPhase("idle");
        setError(err);
        return;
      }
    }

    if (currentPlan.mnemonic && !mnemonicBackupAck) {
      setPhase("ready");
      setError(new AppError("backupMnemonicFirst"));
      return;
    }

    const resumeFrom =
      (previousPhase === "stopped" || previousPhase === "failed") &&
      completed > 0 &&
      completed < currentPlan.recipients.length
        ? completed
        : 0;

    if (resumeFrom === 0) {
      setCompleted(0);
      setLogs([]);
    }
    setPhase("running");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await runSequentialTransfers({
        privateKey,
        transfers: currentPlan.recipients.slice(resumeFrom).map((to, index) => ({
          to,
          value: amounts[resumeFrom + index],
        })),
        intervalMs: QDAY_CHAIN.txIntervalMs,
        signal: controller.signal,
        onProgress: (update) => {
          const absolute: LogItem = {
            ...update,
            index: resumeFrom + update.index,
            at: new Date().toLocaleTimeString(),
          };
          if (update.status === "sent") {
            setCompleted((value) => value + 1);
          }
          setLogs((current) => [absolute, ...current].slice(0, 200));
        },
      });
      setPhase("done");
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        setPhase("stopped");
        setError(new AppError("stoppedManually"));
        return;
      }
      setPhase("failed");
      setError(err);
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function downloadBackup() {
    if (!plan) return;
    const lines = [
      plan.mnemonic ? `mnemonic: ${plan.mnemonic}` : t(locale, "mnemonicNone"),
      `path: ${plan.path}/i`,
      `count: ${plan.recipients.length}`,
      "",
      "index,source,address",
      ...plan.recipients.map((address, index) => {
        const source = index < plan.specified.length ? "specified" : "generated";
        return `${index},${source},${address}`;
      }),
    ];
    downloadText("qday-active-addresses.txt", lines.join("\n"));
  }

  const warningTone = running
    ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
    : "border-amber-400/30 bg-amber-400/10 text-amber-100";

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent">QDAY Chain · EVM</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Active Address</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t(locale, "subtitle")}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <LanguageSwitch locale={locale} onChange={setLocale} />
            <div className="rounded-2xl border border-white/10 bg-ink-900/80 px-4 py-3 font-mono text-xs text-slate-300">
              <div>RPC {QDAY_CHAIN.rpc}</div>
              <div className="mt-1">Chain ID {QDAY_CHAIN.chainId}</div>
            </div>
          </div>
        </header>

        <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${warningTone}`}>
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">{t(locale, "warningTitle")}</div>
            <div className="mt-1 text-sm opacity-90">{t(locale, "warningBody")}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-white/10 bg-ink-900/70 p-5 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-200">
              <Wallet className="h-4 w-4 text-accent" />
              {t(locale, "sendConfig")}
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="text-slate-300">
                  {t(locale, "privateKey")} <span className="text-rose-400">*</span>
                </span>
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 pr-11 font-mono text-sm outline-none ring-accent/40 placeholder:text-slate-600 focus:ring-2"
                    type={showPrivateKey ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={running}
                    placeholder="0x…"
                    value={privateKey}
                    onChange={(event) => {
                      setPrivateKey(event.target.value);
                      resetPrepared();
                    }}
                    onBlur={() => void loadSender()}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-white"
                    onClick={() => setShowPrivateKey((value) => !value)}
                  >
                    {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {(senderAddress || senderBalance) && (
                <div className="grid gap-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-slate-300">
                  <div>
                    {t(locale, "senderAddress")} {senderAddress || "—"}
                  </div>
                  <div>
                    {t(locale, "currentBalance")} {senderBalance || "—"} QDAY
                  </div>
                  <div>
                    {t(locale, "gasReserveHint", { reserve: QDAY_CHAIN.gasReserveQday })}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">
                    {t(locale, "maxSpend")} <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 outline-none ring-accent/40 placeholder:text-slate-600 focus:ring-2"
                    inputMode="decimal"
                    disabled={running}
                    placeholder={t(locale, "placeholderSpend")}
                    value={maxSpend}
                    onChange={(event) => {
                      setMaxSpend(event.target.value);
                      resetPrepared();
                    }}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">
                    {t(locale, "addressCount")} <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 outline-none ring-accent/40 placeholder:text-slate-600 focus:ring-2"
                    inputMode="numeric"
                    disabled={running}
                    placeholder={t(locale, "placeholderCount")}
                    value={addressCount}
                    onChange={(event) => {
                      setAddressCount(event.target.value);
                      resetPrepared();
                    }}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm">
                <span className="text-slate-300">{t(locale, "specifiedAddresses")}</span>
                <textarea
                  className="min-h-28 rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 font-mono text-xs outline-none ring-accent/40 placeholder:text-slate-600 focus:ring-2"
                  disabled={running}
                  placeholder="0xabc...,0xdef..."
                  value={specifiedAddresses}
                  onChange={(event) => {
                    setSpecifiedAddresses(event.target.value);
                    resetPrepared();
                  }}
                />
              </label>
              <p className="text-xs leading-5 text-slate-500">
                {t(locale, "specifiedHint", { path: "m/44'/60'/0'/0/i" })}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={running || phase === "preparing"}
                onClick={() => void prepare()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/10 disabled:opacity-50"
              >
                {phase === "preparing" ? t(locale, "preparing") : t(locale, "prepare")}
              </button>
              {running ? (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400"
                >
                  <Square className="h-4 w-4" />
                  {t(locale, "stop")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={phase === "preparing" || phase === "done"}
                  onClick={() => void start()}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-[#93a6ff] disabled:opacity-50"
                >
                  {phase === "preparing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {phase === "stopped" || phase === "failed"
                    ? t(locale, "resume")
                    : phase === "done"
                      ? t(locale, "allDone")
                      : t(locale, "start")}
                </button>
              )}
            </div>

            {error != null && (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {formatError(locale, error)}
              </div>
            )}
          </section>

          <section className="grid gap-6">
            <div className="rounded-3xl border border-white/10 bg-ink-900/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-slate-200">{t(locale, "progress")}</h2>
                <span className="text-xs text-slate-400">{percent}%</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink-950">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-sky-400 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Stat label={t(locale, "totalTx")} value={String(total)} />
                <Stat label={t(locale, "remainingTx")} value={String(remaining)} />
                <Stat label={t(locale, "completedTx")} value={String(completed)} />
                <Stat label={t(locale, "eta")} value={estimatedTime} />
              </div>
              {amountRangeLabel && <p className="mt-4 text-xs text-slate-400">{amountRangeLabel}</p>}
            </div>

            {plan?.mnemonic && (
              <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-amber-100">{t(locale, "mnemonicTitle")}</h2>
                  <div className="flex gap-2">
                    <CopyButton value={plan.mnemonic} locale={locale} />
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                      onClick={downloadBackup}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t(locale, "download")}
                    </button>
                  </div>
                </div>
                <p className="mt-3 rounded-xl bg-black/30 px-3 py-3 font-mono text-sm leading-7 text-amber-50">
                  {plan.mnemonic}
                </p>
                <p className="mt-3 text-xs leading-5 text-amber-100/80">
                  {t(locale, "mnemonicPathHint", { path: plan.path })}
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm text-amber-50">
                  <input
                    type="checkbox"
                    checked={mnemonicBackupAck}
                    disabled={running}
                    onChange={(event) => setMnemonicBackupAck(event.target.checked)}
                  />
                  {t(locale, "mnemonicAck")}
                </label>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-ink-900/70 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-200">{t(locale, "recipients")}</h2>
                {plan && (
                  <span className="text-xs text-slate-500">
                    {t(locale, "specifiedGenerated", {
                      specified: plan.specified.length,
                      generated: plan.generated.length,
                    })}
                  </span>
                )}
              </div>
              <div className="mono-scroll mt-3 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs leading-6 text-slate-300">
                {plan ? (
                  plan.recipients.map((address, index) => (
                    <div key={`${address}-${index}`}>
                      {index + 1}. {address}
                    </div>
                  ))
                ) : (
                  <span className="text-slate-600">{t(locale, "recipientsEmpty")}</span>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-ink-900/70 p-5">
          <h2 className="text-sm font-medium text-slate-200">{t(locale, "txLog")}</h2>
          <div className="mono-scroll mt-3 max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full text-left font-mono text-xs">
              <thead className="sticky top-0 bg-ink-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">{t(locale, "time")}</th>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">{t(locale, "recipient")}</th>
                  <th className="px-3 py-2 font-medium">{t(locale, "amount")}</th>
                  <th className="px-3 py-2 font-medium">{t(locale, "status")}</th>
                  <th className="px-3 py-2 font-medium">{t(locale, "hashOrError")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-600" colSpan={6}>
                      {t(locale, "logEmpty")}
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => (
                    <tr key={`${item.index}-${item.hash ?? item.error}`} className="border-t border-white/5">
                      <td className="px-3 py-2 text-slate-500">{item.at}</td>
                      <td className="px-3 py-2">{item.index + 1}</td>
                      <td className="px-3 py-2">
                        <AddressHover address={item.to} />
                      </td>
                      <td className="px-3 py-2 text-slate-200">{formatQday(item.value)} QDAY</td>
                      <td className={`px-3 py-2 ${item.status === "sent" ? "text-emerald-400" : "text-rose-400"}`}>
                        {item.status === "sent" ? t(locale, "sent") : t(locale, "failed")}
                      </td>
                      <td className="px-3 py-2">
                        {item.hash ? (
                          <a
                            className="text-accent hover:underline"
                            href={`${QDAY_CHAIN.explorer}/tx/${item.hash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortAddress(item.hash)}
                          </a>
                        ) : (
                          item.error
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}
