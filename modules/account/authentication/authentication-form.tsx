"use client";

import { ActionButton } from "@heiso-io/bee/components/primitives/action-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@heiso-io/bee/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@heiso-io/bee/components/ui/form";
import { Input } from "@heiso-io/bee/components/ui/input";
import { Label } from "@heiso-io/bee/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { updatePassword } from "./_server/auth.service";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Please enter current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

interface AuthenticationFormProps {
  loginMethod: string;
}

export default function AuthenticationForm({
  loginMethod,
}: AuthenticationFormProps) {
  const t = useTranslations("member.auth");
  const { data: session } = useSession();
  const [isUpdatePasswordPending, startUpdatePasswordTransition] =
    useTransition();
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    startUpdatePasswordTransition(async () => {
      if (!session?.user?.id) return;
      try {
        await updatePassword(session.user.id, data);
        toast.success(t("password.toast.success"));
        passwordForm.reset();
      } catch (_error) {
        toast.error(t("password.toast.error"));
      }
    });
  };

  const isCredentials = ["email", "both"].includes(
    loginMethod?.toLowerCase() || "",
  );

  const getLoginMethodLabel = (method: string) => {
    const m = method?.toLowerCase();
    if (m === "email") return t("loginMethod.password");
    if (m === "both") return t("loginMethod.password");
    if (m === "otp") return t("loginMethod.otp");
    if (m === "2fa") return t("loginMethod.2fa");
    return method;
  };

  return (
    <div className="flex-1 space-y-4 p-6 w-full max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t("loginMethod.title")}</CardTitle>
          <CardDescription>
            {t("loginMethod.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="login-method">{t("loginMethod.label")}</Label>
            <Input
              id="login-method"
              value={getLoginMethodLabel(loginMethod)}
              disabled
              readOnly
            />
          </div>
        </CardContent>
      </Card>

      {isCredentials && (
        <Card>
          <CardHeader>
            <CardTitle>{t("password.title")}</CardTitle>
            <CardDescription>{t("password.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("password.currentPassword")}</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("password.newPassword")}</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("password.confirmPassword")}</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <ActionButton
                  type="submit"
                  disabled={isUpdatePasswordPending}
                  className="w-full"
                >
                  {isUpdatePasswordPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("password.button")}
                </ActionButton>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
