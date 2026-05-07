import { invite } from "@heiso-io/bee/modules/permission/team/_server/team.service";
import { MemberStatus } from "@heiso-io/bee/modules/permission/team/types";
import { ActionButton } from "@heiso-io/bee/components/primitives/action-button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@heiso-io/bee/components/ui/form";
import { Input } from "@heiso-io/bee/components/ui/input";
import config from "@heiso-io/bee/config";
import { SystemOauth } from "@heiso-io/bee/modules/dev-center/portal-setting/page";
import { oAuthLogin } from "@heiso-io/bee/server/services/auth";
import { zodResolver } from "@hookform/resolvers/zod";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  getLoginMethod,
  getMemberStatus,
  getMemberByEmail,
} from "../_server/user.service";
import { isDevEmail } from "../_server/dev.service";
import { generateOTP } from "../_server/otp.service";
import Header from "./header";
import { type LoginStep, LoginStepEnum } from "./loginForm";
import OAuthLoginButtons from "./oAuthLoginButtons";

interface AuthLoginProps {
  error: string;
  setError: (error: string) => void;
  setLoginMethod: (loginMethod: string | null) => void;
  setStep: (step: LoginStep) => void;
  setUserEmail: (email: string) => void;
  anyUser: boolean;
  orgName?: string;
  handleAuthMethod: (method: string, email: string) => void;
  setDevMode?: (devMode: boolean) => void;
  systemOauth?: string;
}

const AuthLogin = ({
  error,
  setError,
  setLoginMethod,
  setStep,
  setUserEmail,
  anyUser,
  orgName,
  handleAuthMethod,
  setDevMode,
  systemOauth,
}: AuthLoginProps) => {
  const t = useTranslations("auth.login");

  const usedOrgName = orgName || config?.site?.organization;
  const [isLoading, startTransition] = useTransition();

  const emailSchema = z.object({
    email: z.email({ message: t("email.error") }),
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  // 处理邮箱提交
  const handleEmailSubmit = async (values: z.infer<typeof emailSchema>) => {
    setUserEmail(values.email);

    // Dev email 走 OTP-only 路徑（取代原本的 /auth/devlogin (已併入 /login)）
    if (await isDevEmail(values.email)) {
      setDevMode?.(true);
      const result = await generateOTP(values.email, { mode: "dev" });
      if (result.success) {
        setError("");
        setStep(LoginStepEnum.Otp);
      } else {
        setError(t(`error.${result.message}`));
      }
      return;
    }

    // 僅當系統「完全沒有任何使用者」時，才寄送登入連結
    if (!anyUser) {
      try {
        const member = await getMemberByEmail(values.email);
        if (!member) {
          setError("Platform account not found. Please register first.");
          return;
        }
        await invite({ memberId: member.id, roleId: undefined });
        setError("");
      } catch (e) {
        console.error("Failed to send login link email", e);
        setError(t("error.general"));
      } finally {
        setStep(LoginStepEnum.Invite);
      }
      return;
    } else {
      startTransition(async () => {
        try {
          const member = await getMemberByEmail(values.email);
          if (!member) {
            return setError(t("error.userNotFound"));
          }

          const loginMethod = await getLoginMethod(member.id);
          const memberStatus = await getMemberStatus(member.id);

          if (!loginMethod || !memberStatus) {
            return setError(t("error.userNotFound"));
          }

          if (memberStatus === MemberStatus.Invited) {
            return setError(t("error.invited"));
          }

          if (memberStatus === MemberStatus.Inactive) {
            return setError(t("error.inactive"));
          }

          if (memberStatus === MemberStatus.Suspended) {
            return setError(t("error.suspended"));
          }

          if (memberStatus !== MemberStatus.Active) {
            throw new Error("USER_NOT_ACTIVATED");
          }

          // active member — route by their loginMethod
          setLoginMethod(loginMethod);
          handleAuthMethod(loginMethod, values.email);
        } catch (err) {
          console.error("Error getting login method:", err);
          setError(t("error.general"));
        }
      });
    }
  };

  const createAuthButton = (value: string | undefined) => {
    switch (value) {
      case SystemOauth.google.value:
        return (
          <OAuthLoginButtons
            icon="material-icon-theme:google"
            alt="Google"
            onClick={() => oAuthLogin("google")}
          />
        );

      // case SystemOauth.github.value:
      //   return (
      //     <OAuthLoginButtons
      //       icon="akar-icons:github-fill"
      //       alt="GitHub"
      //       onClick={() => oAuthLogin('github')}
      //     />
      //   );

      case SystemOauth.microsoft.value:
        return (
          <OAuthLoginButtons
            icon="logos:microsoft-icon"
            alt="Microsoft"
            onClick={() => oAuthLogin("microsoft-entra-id")}
          />
        );

      case SystemOauth.none.value:
        return null;
      default:
        return null;
    }
  };

  return (
    <>
      <Header
        title={
          anyUser ? t("title") : t("titleInvite", { organization: usedOrgName })
        }
      />
      {createAuthButton(systemOauth) && (
        <div className="mt-8">
          <div className="space-y-3">{createAuthButton(systemOauth)}</div>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted/30" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="px-4 bg-transparent text-muted-foreground/60 font-bold">
                {t("or")}
              </span>
            </div>
          </div>
        </div>
      )}
      <Form {...emailForm}>
        <form
          className="mt-2 space-y-6"
          onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
        >
          <div className="space-y-4">
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">
                    {t("email.label")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="email-address"
                      type="email"
                      autoComplete="email"
                      placeholder={t("email.placeholder")}
                      className="h-12 bg-background/50 border-white/20 focus:border-primary/50 transition-all rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  {error && (
                    <p className="w-full text-destructive text-sm font-medium mt-1">
                      {error}
                    </p>
                  )}
                </FormItem>
              )}
            />
          </div>
          <div className="pt-2">
            <ActionButton
              type="submit"
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_6px_20px_rgba(var(--primary-rgb),0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
              loading={isLoading}
            >
              <span className="text-lg">{t("submit")}</span>
            </ActionButton>
          </div>
        </form>
      </Form>
    </>
  );
};

export default AuthLogin;
