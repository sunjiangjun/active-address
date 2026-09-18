import {
  formatEther,
  JsonRpcProvider,
  Network,
  parseEther,
  Wallet,
} from "ethers";
import { QDAY_CHAIN } from "./chain";
import { AppError } from "../i18n";

export function normalizePrivateKey(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new AppError("needPrivateKey");
  }
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    throw new AppError("invalidPrivateKey");
  }
  return withPrefix;
}

export function createProvider(): JsonRpcProvider {
  const network = new Network(QDAY_CHAIN.name, QDAY_CHAIN.chainId);
  return new JsonRpcProvider(QDAY_CHAIN.rpc, network, { staticNetwork: true });
}

export function walletFromPrivateKey(privateKey: string): Wallet {
  return new Wallet(normalizePrivateKey(privateKey));
}

export function gasReserveWei(): bigint {
  return parseEther(String(QDAY_CHAIN.gasReserveQday));
}

export function requiredBalanceForTx(value: bigint): bigint {
  return value + gasReserveWei();
}

export function isLowBalance(balanceWei: bigint | null): boolean {
  return balanceWei != null && balanceWei < gasReserveWei();
}

export async function fetchSenderState(privateKey: string): Promise<{
  address: string;
  balanceWei: bigint;
  balanceQday: string;
}> {
  const wallet = walletFromPrivateKey(privateKey);
  const provider = createProvider();
  const balanceWei = await provider.getBalance(wallet.address);
  return {
    address: wallet.address,
    balanceWei,
    balanceQday: formatEther(balanceWei),
  };
}

export function collectUniquePrivateKeys(privateKeys: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const raw of privateKeys) {
    if (!raw.trim()) continue;
    try {
      const normalized = normalizePrivateKey(raw);
      const address = new Wallet(normalized).address.toLowerCase();
      if (seen.has(address)) continue;
      seen.add(address);
      unique.push(normalized);
    } catch {
      continue;
    }
  }

  return unique;
}

export type TransferItem = {
  to: string;
  value: bigint;
};

export type TransferProgress = {
  index: number;
  to: string;
  from?: string;
  value: bigint;
  hash?: string;
  error?: unknown;
  status: "sent" | "failed";
};

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export async function runSequentialTransfers(options: {
  privateKeys: string[];
  transfers: TransferItem[];
  intervalMs: number;
  signal: AbortSignal;
  onProgress: (update: TransferProgress) => void;
}): Promise<void> {
  const { privateKeys, transfers, intervalMs, signal, onProgress } = options;
  const uniqueKeys = collectUniquePrivateKeys(privateKeys);
  if (uniqueKeys.length === 0) {
    throw new AppError("needPrivateKey");
  }

  const provider = createProvider();
  const wallets = uniqueKeys.map((key) => walletFromPrivateKey(key).connect(provider));
  const nonces = new Map<string, number>();
  const feeData = await provider.getFeeData();
  const feeFields = feeData.maxFeePerGas
    ? {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 1n,
      }
    : { gasPrice: feeData.gasPrice ?? undefined };

  for (let index = 0; index < transfers.length; index += 1) {
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const item = transfers[index];
    const wallet = pickRandom(wallets);
    const from = wallet.address;

    try {
      const balance = await provider.getBalance(from);
      const required = requiredBalanceForTx(item.value);
      if (balance < required) {
        onProgress({
          index,
          to: item.to,
          from,
          value: item.value,
          status: "failed",
          error: new AppError("senderInsufficient", {
            address: from,
            have: formatEther(balance),
            need: formatEther(required),
            reserve: String(QDAY_CHAIN.gasReserveQday),
          }),
        });
      } else {
        if (!nonces.has(from)) {
          nonces.set(from, await wallet.getNonce("pending"));
        }
        const nonce = nonces.get(from)!;
        const tx = await wallet.sendTransaction({
          to: item.to,
          value: item.value,
          nonce,
          gasLimit: 21_000n,
          chainId: QDAY_CHAIN.chainId,
          ...feeFields,
        });
        nonces.set(from, nonce + 1);
        onProgress({
          index,
          to: item.to,
          from,
          value: item.value,
          hash: tx.hash,
          status: "sent",
        });
      }
    } catch (error) {
      nonces.delete(from);
      onProgress({
        index,
        to: item.to,
        from,
        value: item.value,
        error,
        status: "failed",
      });
    }

    if (index < transfers.length - 1) {
      await sleep(intervalMs, signal);
    }
  }
}
