/**
 * Minimal, dependency-free SHA-256 (FIPS 180-4), synchronous. Used by `voice-text.ts` to derive a
 * stable audio filename from narrated text — needs to run identically in the browser (runtime
 * lookup) and in Node (the content build's inventory script) without relying on `node:crypto` or
 * the async `SubtleCrypto` API, so both sides stay on one pure-TS implementation.
 */

const K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const H0: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Pads `bytes` to a multiple of 64 bytes per the SHA-256 message schedule. */
function pad(bytes: Uint8Array): Uint8Array {
  const bitLenHigh = Math.floor(bytes.length / 0x20000000);
  const bitLenLow = (bytes.length << 3) >>> 0;
  // +1 (the 0x80 terminator byte) + zero-padding until 56 mod 64, then 8 bytes for the bit length.
  const outLen = bytes.length + 1 + ((55 - (bytes.length % 64) + 64) % 64) + 8;
  const out = new Uint8Array(outLen);
  out.set(bytes);
  out[bytes.length] = 0x80;
  out[outLen - 8] = (bitLenHigh >>> 24) & 0xff;
  out[outLen - 7] = (bitLenHigh >>> 16) & 0xff;
  out[outLen - 6] = (bitLenHigh >>> 8) & 0xff;
  out[outLen - 5] = bitLenHigh & 0xff;
  out[outLen - 4] = (bitLenLow >>> 24) & 0xff;
  out[outLen - 3] = (bitLenLow >>> 16) & 0xff;
  out[outLen - 2] = (bitLenLow >>> 8) & 0xff;
  out[outLen - 1] = bitLenLow & 0xff;
  return out;
}

/** SHA-256 digest of `text` (UTF-8), as a lowercase 64-character hex string. */
export function sha256Hex(text: string): string {
  const message = pad(new TextEncoder().encode(text));
  const h = [...H0];
  const w = new Array<number>(64);

  for (let offset = 0; offset < message.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const base = offset + i * 4;
      w[i] =
        ((message[base] ?? 0) << 24) |
        ((message[base + 1] ?? 0) << 16) |
        ((message[base + 2] ?? 0) << 8) |
        (message[base + 3] ?? 0);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] as number;
      const w2 = w[i - 2] as number;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) | 0;
    }

    let [a, b, c, d, e, f, g, hh] = h as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + (K[i] as number) + (w[i] as number)) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] as number) + a;
    h[1] = (h[1] as number) + b;
    h[2] = (h[2] as number) + c;
    h[3] = (h[3] as number) + d;
    h[4] = (h[4] as number) + e;
    h[5] = (h[5] as number) + f;
    h[6] = (h[6] as number) + g;
    h[7] = (h[7] as number) + hh;
  }

  return h.map((word) => (word >>> 0).toString(16).padStart(8, '0')).join('');
}
