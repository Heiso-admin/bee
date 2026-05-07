/**
 * 錯誤訊息編碼 / 解碼 (AES-256-GCM)
 *
 * 用法：
 *   server: encodeError(err) → base64 blob，給 user 顯示
 *   dev cli: decodeError(blob) → 原始 {message, stack, ...}
 *
 * 需要 env: ERROR_CODE_SECRET（32 bytes，hex 64 chars）
 *   產 key:  openssl rand -hex 32
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM standard

function getKey(): Buffer {
  const hex = process.env.ERROR_CODE_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ERROR_CODE_SECRET must be 64 hex chars (32 bytes). Generate: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export interface EncodedErrorPayload {
  timestamp: string;
  message: string;
  stack?: string;
  digest?: string;
  route?: string;
  memberId?: string;
}

/**
 * 把 error 加密成 user 可顯示的 opaque code。
 */
export function encodeError(payload: EncodedErrorPayload): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // [iv | tag | ciphertext] → base64url（無 +/= 字元方便顯示）
  return Buffer.concat([iv, tag, encrypted])
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * 把 user 提供的 code 還原成原始 payload。Dev CLI 用。
 */
export function decodeError(code: string): EncodedErrorPayload {
  const key = getKey();
  // base64url → base64
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const buf = Buffer.from(b64, "base64");

  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const encrypted = buf.subarray(IV_LEN + 16);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}
