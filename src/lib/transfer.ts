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

export function assertSpendableBalance(balanceWei: bigint, maxSpendQday: string): void {
  const spendWei = parseEther(maxSpendQday);
  const reserveWei = parseEther(String(QDAY_CHAIN.gasReserveQday));
  const required = spendWei + reserveWei;

  if (balanceWei < required) {
    const have = formatEther(balanceWei);
    const need = formatEther(required);
    throw new AppError("insufficientBalance", {
      have,
      need,
      spend: maxSpendQday,
      reserve: String(QDAY_CHAIN.gasReserveQday),
    });
  }
}

export type TransferItem = {
  to: string;
  value: bigint;
};

export type TransferProgress = {
  index: number;
  to: string;
  value: bigint;
  hash?: string;
  error?: string;
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

export async function runSequentialTransfers(options: {
  privateKey: string;
  transfers: TransferItem[];
  intervalMs: number;
  signal: AbortSignal;
  onProgress: (update: TransferProgress) => void;
}): Promise<void> {
  const { privateKey, transfers, intervalMs, signal, onProgress } = options;
  const provider = createProvider();
  const wallet = walletFromPrivateKey(privateKey).connect(provider);

  let nonce = await wallet.getNonce("pending");
  const feeData = await provider.getFeeData();

  for (let index = 0; index < transfers.length; index += 1) {
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const item = transfers[index];
    try {
      const tx = await wallet.sendTransaction({
        to: item.to,
        value: item.value,
        nonce,
        gasLimit: 21_000n,
        chainId: QDAY_CHAIN.chainId,
        ...(feeData.maxFeePerGas
          ? {
              maxFeePerGas: feeData.maxFeePerGas,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 1n,
            }
          : { gasPrice: feeData.gasPrice ?? undefined }),
      });
      nonce += 1;
      onProgress({
        index,
        to: item.to,
        value: item.value,
        hash: tx.hash,
        status: "sent",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress({
        index,
        to: item.to,
        value: item.value,
        error: message,
        status: "failed",
      });
      throw error;
    }

    if (index < transfers.length - 1) {
      await sleep(intervalMs, signal);
    }
  }
}
