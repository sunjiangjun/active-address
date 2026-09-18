import { getAddress, HDNodeWallet, isAddress, Mnemonic, randomBytes } from "ethers";
import { HD_PATH_PREFIX } from "./chain";
import { AppError } from "../i18n";

export type RecipientPlan = {
  recipients: string[];
  specified: string[];
  generated: string[];
  mnemonic: string | null;
  path: string;
};

export function parseSpecifiedAddresses(input: string): string[] {
  const parts = input
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const addresses: string[] = [];

  for (const part of parts) {
    if (!isAddress(part)) {
      throw new AppError("invalidAddress", { address: part });
    }
    const checksum = getAddress(part);
    const key = checksum.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(checksum);
  }

  return addresses;
}

export function generateHdAddresses(count: number): {
  mnemonic: string;
  addresses: string[];
  path: string;
} {
  if (count <= 0) {
    return { mnemonic: "", addresses: [], path: HD_PATH_PREFIX };
  }

  const mnemonic = Mnemonic.fromEntropy(randomBytes(16));
  const base = HDNodeWallet.fromMnemonic(mnemonic, HD_PATH_PREFIX);
  const addresses: string[] = [];

  for (let i = 0; i < count; i += 1) {
    addresses.push(base.deriveChild(i).address);
  }

  return { mnemonic: mnemonic.phrase, addresses, path: HD_PATH_PREFIX };
}

export function buildRecipientPlan(
  specifiedInput: string,
  targetCount: number,
): RecipientPlan {
  if (!Number.isInteger(targetCount) || targetCount < 1) {
    throw new AppError("needPositiveCount");
  }

  const specified = parseSpecifiedAddresses(specifiedInput);

  if (specified.length >= targetCount) {
    return {
      recipients: specified.slice(0, targetCount),
      specified: specified.slice(0, targetCount),
      generated: [],
      mnemonic: null,
      path: HD_PATH_PREFIX,
    };
  }

  const need = targetCount - specified.length;
  const generated = generateHdAddresses(need);

  return {
    recipients: [...specified, ...generated.addresses],
    specified,
    generated: generated.addresses,
    mnemonic: generated.mnemonic,
    path: generated.path,
  };
}

function randomBigIntInclusive(max: bigint): bigint {
  if (max <= 0n) return 0n;

  const bitLength = max.toString(2).length;
  const byteLength = Math.ceil(bitLength / 8);
  const extraBits = byteLength * 8 - bitLength;
  const mask = extraBits === 0 ? 255 : (1 << (8 - extraBits)) - 1;

  while (true) {
    const bytes = randomBytes(byteLength);
    bytes[0] &= mask;
    let value = 0n;
    for (const byte of bytes) {
      value = (value << 8n) + BigInt(byte);
    }
    if (value <= max) return value;
  }
}

/** Random positive amounts that sum exactly to `total` (the max spend quota). */
export function splitValueRandom(total: bigint, count: number): bigint[] {
  if (count <= 0) {
    throw new AppError("needPositiveCount");
  }
  if (total <= 0n) {
    throw new AppError("spendMustBePositive");
  }
  if (total < BigInt(count)) {
    throw new AppError("spendTooSmall");
  }

  const rest = total - BigInt(count);
  const cuts: bigint[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    cuts.push(randomBigIntInclusive(rest));
  }
  cuts.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const amounts: bigint[] = [];
  let prev = 0n;
  for (const cut of cuts) {
    amounts.push(cut - prev + 1n);
    prev = cut;
  }
  amounts.push(rest - prev + 1n);
  return amounts;
}
