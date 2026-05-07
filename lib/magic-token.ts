/**
 * Magic link token codec — encrypt / decrypt payload for one-click login URLs.
 *
 * 用 AES-256-GCM 把 {email, code, mode} 打包加密成 opaque token 塞 URL，
 * 取代原本的 ?code=xxx&email=yyy 明碼。
 *
 * 共用 ERROR_CODE_SECRET（少一個 env，密鑰管理簡單）。
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const hex = process.env.ERROR_CODE_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ERROR_CODE_SECRET must be 64 hex chars (32 bytes). Generate: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export interface MagicTokenPayload {
  email: string;
  code: string;
  mode: "regular" | "dev";
  /** Token expiry timestamp (ms epoch) — 防止舊 token 被 replay */
  exp: number;
}

/**
 * 把 magic link payload 加密成 base64url token。
 */
export function encodeMagicToken(payload: MagicTokenPayload): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted])
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * 解 magic token，順便檢查有沒有過期。
 */
export function decodeMagicToken(token: string): MagicTokenPayload | null {
  const isDev = process.env.NODE_ENV !== "production";
  try {
    const key = getKey();
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
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
    const payload: MagicTokenPayload = JSON.parse(plaintext.toString("utf8"));

    if (payload.exp && Date.now() > payload.exp) {
      if (isDev) {
        const ageMin = ((Date.now() - payload.exp) / 60000).toFixed(1);
        console.warn(`[magic-token] expired ${ageMin}min ago (email=${payload.email})`);
      }
      return null;
    }

    return payload;
  } catch (err) {
    if (isDev) {
      console.warn(
        `[magic-token] decode failed: ${(err as Error).message} (likely ERROR_CODE_SECRET mismatch or tampered token)`,
      );
    }
    return null;
  }
}
