// UUIDv7 (RFC 9562): 48-bit big-endian unix ms + 74 random bits with version
// and variant nibbles. Every domain row id is generated here, app-side — no
// DB-side defaults (ticket 05).

export function newId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const view = new DataView(bytes.buffer);

  const nowMs = Date.now();
  view.setUint16(0, Math.floor(nowMs / 2 ** 32));
  view.setUint32(2, nowMs % 2 ** 32);
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
