"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import OTPLoginForm from "../../_components/otpLoginForm";
import { generateOTP } from "../../_server/otp.service";

export default function TwoStepLogin() {
  const t = useTranslations("auth.otp");
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const codeFromLink = params.get("code") || "";
  const mode = params.get("mode") === "dev" ? "dev" : "regular";
  const [error, setError] = useState<string>("");

  // 帶 code 來的（magic link）— 不重發，直接交給 form 自動驗證
  // 沒帶 code — 進頁面就寄一封 OTP
  useEffect(() => {
    if (!email || codeFromLink) return;
    const send = async () => {
      const result = await generateOTP(
        email,
        mode === "dev" ? { mode: "dev" } : undefined,
      );
      if (!result.success) {
        setError(t(`error.${result.message}`));
      }
    };
    send();
  }, [email, codeFromLink, mode, t]);

  const handleLoginSuccess = () => {
    router.push("/portal");
  };

  const backToLogin = () => {
    router.push(mode === "dev" ? "/auth/devlogin" : "/login");
  };

  return (
    <OTPLoginForm
      email={email}
      setStep={backToLogin as any}
      loginMethod={null}
      error={error}
      setError={setError}
      handleLoginSuccess={handleLoginSuccess}
      initialCode={codeFromLink}
      autoVerify={!!codeFromLink}
      mode={mode}
      extraSignInParams={mode === "dev" ? { isDevLogin: "true" } : undefined}
    />
  );
}
