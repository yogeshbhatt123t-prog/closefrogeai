/**
 * FrogeClose Cryptographic Audit Trail Engine
 * Immutable SHA-256 Hash Chaining with Tamper Detection
 */

export interface ChainedAuditLogEntry {
  id: string;
  sequence: number;
  timestamp: string;
  actor: 'agent' | 'user' | 'system';
  action: string;
  input_data: string;
  output_data: string;
  approved_by: string;
  prev_hash: string;
  current_hash: string;
}

export interface VerificationResult {
  is_valid: boolean;
  total_entries: number;
  tampered_index: number | null;
  corrupted_entry_id: string | null;
  failure_reason: string | null;
  verified_at: string;
}

/**
 * Pure SHA-256 implementation that runs deterministically anywhere (Node, Vite, Browser)
 */
export function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let compositeAscii = ascii + '\x80';
  while (compositeAscii[lengthProperty] % 64 - 56) compositeAscii += '\x00';
  for (i = 0; i < compositeAscii[lengthProperty]; i++) {
    j = compositeAscii.charCodeAt(i);
    if (j >> 8) return ''; // ASCII check
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, j += 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15], w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const sigma0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const sigma1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);

      const t1 = hash[7] + sigma1 + ch + k[i] + w[i];
      const t2 = sigma0 + maj;

      hash = [(t1 + t2) | 0].concat(hash);
      hash[4] = (hash[4] + t1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Computes deterministic entry hash from fields
 */
export function computeEntryHash(entry: {
  sequence: number;
  timestamp: string;
  actor: string;
  action: string;
  input_data: string;
  output_data: string;
  approved_by: string;
  prev_hash: string;
}): string {
  const payload = `${entry.prev_hash}|${entry.sequence}|${entry.timestamp}|${entry.actor}|${entry.action}|${entry.input_data}|${entry.output_data}|${entry.approved_by}`;
  return sha256Sync(payload);
}

/**
 * Creates genesis block
 */
export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Appends a new verified audit entry to the cryptographic chain
 */
export function appendAuditEntry(
  currentLogs: ChainedAuditLogEntry[],
  payload: {
    actor: 'agent' | 'user' | 'system';
    action: string;
    input_data: string;
    output_data: string;
    approved_by: string;
    timestamp?: string;
  }
): ChainedAuditLogEntry {
  const sequence = currentLogs.length + 1;
  const prev_hash = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1].current_hash : GENESIS_HASH;
  const timestamp = payload.timestamp || new Date().toISOString();

  const entryData = {
    sequence,
    timestamp,
    actor: payload.actor,
    action: payload.action,
    input_data: payload.input_data,
    output_data: payload.output_data,
    approved_by: payload.approved_by,
    prev_hash
  };

  const current_hash = computeEntryHash(entryData);

  return {
    id: `log_sha256_${Date.now()}_${sequence}`,
    ...entryData,
    current_hash
  };
}

/**
 * Verifies the integrity of the audit chain from Genesis to tip.
 * Returns failure if any previous hash doesn't match or recomputed hash doesn't match.
 */
export function verifyAuditChain(chain: ChainedAuditLogEntry[]): VerificationResult {
  const verified_at = new Date().toISOString();
  if (!chain || chain.length === 0) {
    return {
      is_valid: true,
      total_entries: 0,
      tampered_index: null,
      corrupted_entry_id: null,
      failure_reason: null,
      verified_at
    };
  }

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const expectedPrevHash = i === 0 ? GENESIS_HASH : chain[i - 1].current_hash;

    // 1. Verify link to previous entry
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        is_valid: false,
        total_entries: chain.length,
        tampered_index: i,
        corrupted_entry_id: entry.id,
        failure_reason: `Broken chain pointer at index ${i}: prev_hash [${entry.prev_hash.slice(0, 10)}...] does not match previous entry current_hash [${expectedPrevHash.slice(0, 10)}...].`,
        verified_at
      };
    }

    // 2. Recompute current hash to detect payload tampering
    const recomputedHash = computeEntryHash({
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      actor: entry.actor,
      action: entry.action,
      input_data: entry.input_data,
      output_data: entry.output_data,
      approved_by: entry.approved_by,
      prev_hash: entry.prev_hash
    });

    if (recomputedHash !== entry.current_hash) {
      return {
        is_valid: false,
        total_entries: chain.length,
        tampered_index: i,
        corrupted_entry_id: entry.id,
        failure_reason: `Cryptographic payload tampering at index ${i}: recomputed hash [${recomputedHash.slice(0, 10)}...] != stored hash [${entry.current_hash.slice(0, 10)}...].`,
        verified_at
      };
    }
  }

  return {
    is_valid: true,
    total_entries: chain.length,
    tampered_index: null,
    corrupted_entry_id: null,
    failure_reason: null,
    verified_at
  };
}
