/**
 * 全域 error handler — server-side wrap & encode。
 *
 * 在 server route / server action 裡 catch unknown error，
 * 印 structured log（給 Vercel drain → S3）+ encode 成 user-safe code throw。
 *
 * client 拿到 error.message = encoded blob（看不懂）+ error.digest（next.js 自動）。
 */
import { encodeError, type EncodedErrorPayload } from "./error-codec";

const UNAUTHORIZED_MARKERS = ["Unauthorized", "UNAUTHORIZED"];

/**
 * 包 server function 的 helper。
 *
 * Usage:
 *   export const myAction = wrapServerError(async (...) => { ... });
 */
export function wrapServerError<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  ctx?: { route?: string; memberId?: string },
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      // Unauthorized 直接 re-throw（讓 error.tsx 走 redirect path）
      if (
        err instanceof Error &&
        UNAUTHORIZED_MARKERS.some((m) => err.message.includes(m))
      ) {
        throw err;
      }

      const payload: EncodedErrorPayload = {
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        route: ctx?.route,
        memberId: ctx?.memberId,
      };

      // structured log → Vercel stdout → drain → S3
      console.log(
        JSON.stringify({
          type: "server_error",
          ...payload,
        }),
      );

      // throw 給 client 的，message 換成加密 blob
      let encoded: string;
      try {
        encoded = encodeError(payload);
      } catch {
        // ERROR_CODE_SECRET 沒設 → fallback：純 generic
        encoded = "ENCODING_FAILED";
      }
      throw new Error(encoded);
    }
  }) as T;
}
