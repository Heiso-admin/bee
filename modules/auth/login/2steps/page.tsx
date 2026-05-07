"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@heiso-io/bee/components/ui/button";
import LoadingSpinner from "@heiso-io/bee/components/primitives/spinner";
import OTPLoginForm from "../../_components/otpLoginForm";
import { generateOTP } from "../../_server/otp.service";
import { resolveMagicToken } from "../../_server/magic-link.service";

type Resolved =
  | { state: "loading" }
  | { state: "ready"; email: string; code: string; mode: "regular" | "dev" }
  | { state: "no-token"; email: string; mode: "regular" | "dev" }
  | { state: "invalid" }
  | { state: "session-mismatch"; tokenEmail: string; sessionEmail: string };

export default function TwoStepLogin() {
  const t = useTranslations("auth.otp");
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, status } = useSession();
  const [resolved, setResolved] = useState<Resolved>({ state: "loading" });
  const [error, setError] = useState<string>("");

  // Resolve token (or fall back to email/code/mode for backward compat)
  useEffect(() => {
    if (status === "loading") return;

    const token = params.get("t");
    const sessionEmail = session?.user?.email ?? null;

    const handle = async () => {
      if (token) {
        const decoded = await resolveMagicToken(token);
        if (!decoded) {
          setResolved({ state: "invalid" });
          return;
        }
        // Different email already logged in → require explicit user action
        if (sessionEmail && sessionEmail !== decoded.email) {
          setResolved({
            state: "session-mismatch",
            tokenEmail: decoded.email,
            sessionEmail,
          });
          return;
        }
        // Same email logged in OR not logged in:
        // 都走 ready → autoVerify → consume token + signIn refresh → redirect /portal
        // 這樣 token 一定 one-shot，即使 user 已經登入也不留 replay 機會
        setResolved({
          state: "ready",
          email: decoded.email,
          code: decoded.code,
          mode: decoded.mode,
        });
        return;
      }

      // No token — fall back: just email + mode (typed OTP flow, no auto-verify)
      const email = params.get("email") || "";
      const mode = params.get("mode") === "dev" ? "dev" : "regular";
      if (!email) {
        setResolved({ state: "invalid" });
        return;
      }
      if (sessionEmail && sessionEmail !== email) {
        setResolved({
          state: "session-mismatch",
          tokenEmail: email,
          sessionEmail,
        });
        return;
      }
      // 沒 token 不能 auto-consume（沒 code），讓 user 自己輸入再 verify
      // 同 email 已登入也讓他重新 verify（雖然冗餘，但保持流程一致）
      setResolved({ state: "no-token", email, mode });
    };

    handle();
  }, [params, session, status, router]);

  const handleLoginSuccess = () => router.push("/portal");
  const backToLogin = () => router.push("/auth/login");

  // Send OTP for typed-only flow (no token)
  useEffect(() => {
    if (resolved.state !== "no-token") return;
    const send = async () => {
      const result = await generateOTP(
        resolved.email,
        resolved.mode === "dev" ? { mode: "dev" } : undefined,
      );
      if (!result.success) setError(t(`error.${result.message}`));
    };
    send();
  }, [resolved, t]);

  if (resolved.state === "loading") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8">
        <LoadingSpinner className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">{t("verifying")}</p>
      </div>
    );
  }

  if (resolved.state === "invalid") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-xl font-semibold">Invalid or expired link</h2>
        <p className="text-sm text-muted-foreground">This sign-in link is no longer valid.</p>
        <Button onClick={backToLogin}>Back to login</Button>
      </div>
    );
  }

  if (resolved.state === "session-mismatch") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-xl font-semibold">You're signed in as another account</h2>
        <p className="text-sm text-muted-foreground">
          Currently signed in: <code>{resolved.sessionEmail}</code><br />
          This link is for: <code>{resolved.tokenEmail}</code>
        </p>
        <p className="text-xs text-muted-foreground/70">
          Sign out first if you want to use this link.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.replace("/portal")}>
            Stay signed in as {resolved.sessionEmail}
          </Button>
          <Button onClick={() => signOut({ callbackUrl: window.location.href })}>
            Sign out & continue
          </Button>
        </div>
      </div>
    );
  }

  // ready (token decoded) or no-token (typed OTP flow)
  const email = resolved.email;
  const mode = resolved.mode;
  const initialCode = resolved.state === "ready" ? resolved.code : "";

  return (
    <OTPLoginForm
      email={email}
      setStep={backToLogin as any}
      loginMethod={null}
      error={error}
      setError={setError}
      handleLoginSuccess={handleLoginSuccess}
      initialCode={initialCode}
      autoVerify={!!initialCode}
      mode={mode}
      extraSignInParams={mode === "dev" ? { isDevLogin: "true" } : undefined}
    />
  );
}
