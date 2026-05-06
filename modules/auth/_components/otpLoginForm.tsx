"use client";

import { ActionButton } from "@heiso-io/bee/components/primitives/action-button";
import { Button } from "@heiso-io/bee/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@heiso-io/bee/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@heiso-io/bee/components/ui/input-otp";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { generateOTP, type OTPMode, verifyOTP } from "../_server/otp.service";
import AuthRedirectHint from "./authRedirectHint";
import Header from "./header";
import { type LoginStep, LoginStepEnum } from "./loginForm";

interface OTPLoginFormProps {
  email?: string | null;
  setStep: (step: LoginStep) => void;
  loginMethod?: string | null;
  error: string;
  setError: (error: string) => void;
  handleLoginSuccess: () => void;
  /** Pass additional credentials to signIn (e.g., isDevLogin for admin access) */
  extraSignInParams?: Record<string, string>;
  /** OTP flow mode — "dev" 跳過 membership check 限 ALLOWED_DEV_EMAILS */
  mode?: OTPMode;
  /** 預填的驗證碼（例：從 magic link URL 來的） */
  initialCode?: string;
  /** 進來自動觸發 verify（搭配 initialCode，magic link 用） */
  autoVerify?: boolean;
}

const codeBoxMaxWidth = 6;
export default function OTPLoginForm({
  email,
  setStep,
  loginMethod,
  error,
  setError,
  handleLoginSuccess,
  extraSignInParams,
  mode = "regular",
  initialCode = "",
  autoVerify = false,
}: OTPLoginFormProps) {
  const otpOpts = mode === "dev" ? { mode: "dev" as const } : undefined;
  const t = useTranslations("auth.otp");
  const [userEmail, setUserEmail] = useState(email || "");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { update } = useSession();
  const baseSlotId = useId();
  const slotKeys = useMemo(
    () =>
      Array.from({ length: codeBoxMaxWidth }, (_, i) => `${baseSlotId}-${i}`),
    [baseSlotId],
  );

  // 邮箱表单验证
  const emailFormSchema = z.object({
    email: z.string().email({ message: t("email.error") }),
  });

  // 验证码表单验证
  const otpFormSchema = z.object({
    code: z.string().length(6, { message: t("code.error") }),
  });

  const otpForm = useForm<z.infer<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      code: initialCode,
    },
  });

  // 发送验证码
  const _handleSendOTP = async (values: z.infer<typeof emailFormSchema>) => {
    console.log("submit email", values.email);
    setError("");
    setIsLoading(true);

    try {
      const result = await generateOTP(values.email, otpOpts);

      if (result.success) {
        setUserEmail(values.email);
        console.log("success.codeSent", { email: values.email });
        startCountdown();
      } else {
        setError(result.message);
      }
    } catch (_err) {
      setError(t("error.general"));
    } finally {
      setIsLoading(false);
    }
  };

  // 验证 OTP 并登录
  const handleVerifyOTP = async (values: z.infer<typeof otpFormSchema>) => {
    setError("");
    setIsLoading(true);

    try {
      const result = await verifyOTP(userEmail, values.code, otpOpts);

      if (!result.success) {
        const raw = result.message;
        // 如果是短 i18n key（如 'expired'、'invalid'）就走 i18n；否則直接顯示 raw
        if (raw && /^[a-z_]+$/.test(raw)) {
          setError(t(`error.${raw}`));
        } else {
          setError(raw ?? t("error.general"));
        }
        return;
      }

      if (result.success && result.accountId) {
        // 使用 NextAuth 的 signIn 进行登录
        const signInResult = await signIn("credentials", {
          email: userEmail,
          otpVerified: "true",
          accountId: result.accountId,
          redirect: false,
          ...extraSignInParams,
        });

        if (signInResult?.ok) {
          await update();
          handleLoginSuccess();
        } else {
          setError(t("error.login"));
        }
      } else {
        setError(result.message ?? t("error.general"));
      }
    } catch (_err) {
      setError(t("error.general"));
    } finally {
      setIsLoading(false);
    }
  };

  // Magic link：帶 code 進來時自動驗證一次（只跑一次，避免重複觸發）
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (!autoVerify || !initialCode || !userEmail) return;
    autoRanRef.current = true;
    handleVerifyOTP({ code: initialCode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoVerify, initialCode, userEmail]);

  // 重新发送验证码
  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setError("");
    setIsLoading(true);

    try {
      const result = await generateOTP(userEmail, otpOpts);
      console.log("generateOTP", result);

      if (result.success) {
        console.log("success.codeResent");
        startCountdown();
      } else {
        setError(result.message);
      }
    } catch (_err) {
      setError(t("error.general"));
    } finally {
      setIsLoading(false);
    }
  };

  // 开始倒计时
  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <>
      <Header
        title={t("title")}
        description={t("description", { email: email || "email" })}
      />

      <Form {...otpForm}>
        <form
          className="mt-8 space-y-6 mb-8"
          onSubmit={otpForm.handleSubmit(handleVerifyOTP)}
        >
          <div className="space-y-4">
            <FormField
              control={otpForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <InputOTP
                      value={field.value}
                      onChange={(val) => {
                        otpForm.clearErrors("code");
                        field.onChange(val);
                      }}
                      maxLength={codeBoxMaxWidth}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      containerClassName="flex items-center justify-center gap-3"
                    >
                      {new Array(codeBoxMaxWidth).fill(0).map((_, i) => (
                        <InputOTPGroup key={slotKeys[i]}>
                          <InputOTPSlot
                            index={i}
                            className="text-xl w-12 h-14 bg-background/50 border-white/20 rounded-xl"
                          />
                        </InputOTPGroup>
                      ))}
                    </InputOTP>
                  </FormControl>
                  <FormMessage className="w-full text-center" />
                  {error && (
                    <p className="w-full text-sm text-destructive font-medium text-center mt-2">
                      {error}
                    </p>
                  )}
                </FormItem>
              )}
            />
          </div>
          <div className="w-full flex justify-center">
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={countdown > 0 || isLoading}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:text-muted-foreground/60"
            >
              {countdown > 0
                ? t("resend.countdown", { seconds: countdown })
                : t("resend.action")}
            </button>
          </div>

          <div className="pt-2">
            <ActionButton
              type="submit"
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_6px_20px_rgba(var(--primary-rgb),0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
              loading={isLoading}
            >
              <span className="text-lg">{t("submit.verify")}</span>
            </ActionButton>
          </div>
        </form>
        <AuthRedirectHint>
          <div className="flex justify-center">
            {t.rich("backToLogin", {
              Link: (chunks) => (
                <Button
                  variant="link"
                  className="text-muted-foreground hover:text-primary font-medium p-0 h-auto text-sm transition-colors"
                  onClick={() => setStep(LoginStepEnum.Email)}
                  type="button"
                >
                  {chunks}
                </Button>
              ),
            })}
          </div>
        </AuthRedirectHint>
      </Form>
    </>
  );
}
