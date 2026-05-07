"use client";

import { ActionButton } from "@heiso-io/bee/components/primitives/action-button";
import { AvatarUploader } from "@heiso-io/bee/components/primitives/uploader/avatar";
import { Button } from "@heiso-io/bee/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@heiso-io/bee/components/ui/card";
import { Input } from "@heiso-io/bee/components/ui/input";
import { useAccount } from "@heiso-io/bee/providers/account";
import { useSite } from "@heiso-io/bee/providers/site";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateAvatar, updateNickname } from "./_server/profile.service";

export default function Preferences() {
  return (
    <div className="flex-1 space-y-4 p-6 w-full max-w-3xl mx-auto mb-20">
      <UserAvatar />
      <Nickname />
      <Email />
      <Appearance />
      <UserId />
    </div>
  );
}

function UserAvatar() {
  const { member, updateMember } = useAccount();
  const t = useTranslations("member.me");
  const [avatar, setAvatar] = useState(member?.avatar);
  const [isPending, startTransition] = useTransition();

  const handleSave = async () => {
    startTransition(async () => {
      if (member?.id) {
        const result = await updateAvatar(member.id, avatar ?? "");
        if (result.success) {
          updateMember({ avatar: avatar });
          toast.success(result.message);
        } else {
          toast.error(result.error || "updated failed");
        }
      }
    });
  };

  return (
    <Card x-chunk="dashboard-04-chunk-1">
      <CardContent className="flex justify-between text-sm py-4">
        <div>
          <h4 className="font-medium text-lg">{t("avatar.title")}</h4>
          <p className="text-muted-foreground">{t("avatar.description")}</p>
        </div>
        <div className="relative">
          <AvatarUploader
            name={member?.name ?? ""}
            value={member?.avatar ?? ""}
            onUploadComplete={(file) => {
              console.log("file: ", file);
              setAvatar(file.url);
            }}
            onRemove={() => {
              setAvatar("");
            }}
          />
          {member?.name && (
            <div className="absolute bottom-0 right-0 w-8 h-8 text-center text-[20px] rounded-sm bg-primary/80">
              {member.name.toUpperCase().slice(0, 1)}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-4 text-sm text-muted-foreground">
        {t("avatar.footer")}
        <ActionButton
          loading={isPending}
          onClick={handleSave}
          disabled={isPending}
        >
          {t("common.save")}
        </ActionButton>
      </CardFooter>
    </Card>
  );
}

function Nickname() {
  const { member, updateMember } = useAccount();
  const t = useTranslations("member.me");
  const [nickname, setNickname] = useState(member?.name || "");
  const [isPending, startTransition] = useTransition();

  const handleSave = async () => {
    startTransition(async () => {
      if (member?.id) {
        const result = await updateNickname(member.id, nickname.trim());
        if (result.success) {
          updateMember({ name: nickname.trim() });
          toast.success(result.message);
        } else {
          toast.error(result.error || "updated failed");
        }
      }
    });
  };

  return (
    <Card x-chunk="dashboard-04-chunk-2">
      <CardHeader>
        <CardTitle>{t("displayName.title")}</CardTitle>
        <CardDescription>{t("displayName.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4">
          <Input
            placeholder=""
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isPending}
          />
          {/* {error && <p className="text-sm text-red-600">{error}</p>} */}
          {/* {success && <p className="text-sm text-green-600">{success}</p>} */}
          {/* <div className="flex items-center space-x-2">
              <Checkbox id="include" defaultChecked />
              <label
                htmlFor="include"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Allow administrators to change your display name.
              </label>
            </div> */}
        </form>
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-4 text-sm text-muted-foreground">
        {t("displayName.footer")}
        <ActionButton
          loading={isPending}
          onClick={handleSave}
          disabled={isPending || !nickname.trim() || nickname === member?.name}
        >
          {t("common.save")}
        </ActionButton>
      </CardFooter>
    </Card>
  );
}

function Email() {
  const { member } = useAccount();
  const t = useTranslations("member.me");
  return (
    <Card x-chunk="dashboard-06-chunk-2">
      <CardHeader>
        <CardTitle>{t("email.title")}</CardTitle>
        <CardDescription>{t("email.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4">
          <Input readOnly placeholder="" defaultValue={member?.email} />
        </form>
      </CardContent>
      {/* <CardFooter className="flex justify-between border-t px-6 py-4 text-sm text-muted-foreground">
          {t('email.footer')}
          <Button>{t('common.save')}</Button>
        </CardFooter> */}
    </Card>
  );
}

function UserId() {
  const { site } = useSite();
  const { member } = useAccount();
  const t = useTranslations("member.me");
  return (
    <Card x-chunk="dashboard-08-chunk-2">
      <CardHeader>
        <CardTitle>
          {t("userId.title", { siteName: site?.basic?.name ?? "" })}
        </CardTitle>
        <CardDescription>
          {t("userId.description", { siteName: site?.basic?.name ?? "" })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Input placeholder="" defaultValue={member?.id} readOnly />
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-4 text-sm text-muted-foreground">
        {t("userId.footer")}
      </CardFooter>
    </Card>
  );
}

function _PhoneNumber() {
  // const { member } = useAccount();
  const _t = useTranslations("member.me");
  return (
    <Card x-chunk="dashboard-07-chunk-2">
      <CardHeader>
        <CardTitle>Your Phone Number</CardTitle>
        <CardDescription>
          Enter a phone number to receive important service updates by SMS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4">
          <Input placeholder="" />
        </form>
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-4 text-sm text-muted-foreground">
        A code will be sent to verify
        <Button>Save</Button>
      </CardFooter>
    </Card>
  );
}

function Appearance() {
  const t = useTranslations("member.me");
  const { setTheme, theme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<string>();

  useEffect(() => {
    setCurrentTheme(theme);
  }, [theme]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("appearance.title")}</CardTitle>
          <CardDescription>{t("appearance.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium leading-none">
                {t("appearance.themeMode.title")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                {t("appearance.themeMode.description")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                className="relative"
                onClick={() => setTheme("dark")}
              >
                <div className="relative cursor-pointer">
                  <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                    <div className="space-y-2 rounded-sm bg-[#1c1c1c] p-2">
                      <div className="space-y-2 rounded-md bg-zinc-950 p-2 shadow-sm">
                        <div className="h-2 w-[80px] rounded-lg bg-zinc-800" />
                        <div className="h-2 w-[100px] rounded-lg bg-zinc-800" />
                      </div>
                      <div className="flex items-center space-x-2 rounded-md bg-zinc-950 p-2 shadow-sm">
                        <div className="h-4 w-4 rounded-full bg-zinc-800" />
                        <div className="h-2 w-[100px] rounded-lg bg-zinc-800" />
                      </div>
                      <div className="flex items-center space-x-2 rounded-md bg-zinc-950 p-2 shadow-sm">
                        <div className="h-4 w-4 rounded-full bg-zinc-800" />
                        <div className="h-2 w-[100px] rounded-lg bg-zinc-800" />
                      </div>
                    </div>
                  </div>
                  <span className="absolute inset-0 flex h-full w-full items-center justify-center rounded-md bg-zinc-950/30 opacity-0 hover:opacity-100">
                    <span className="sr-only">
                      {t("appearance.themeMode.dark")}
                    </span>
                    <span className="bg-zinc-900 text-white text-sm font-medium px-2 py-0.5 rounded-sm">
                      {t("appearance.themeMode.dark")}
                    </span>
                  </span>
                  {currentTheme === "dark" && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </button>
              <button
                type="button"
                className="relative"
                onClick={() => setTheme("light")}
              >
                <div className="relative cursor-pointer">
                  <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                    <div className="space-y-2 rounded-sm bg-white p-2">
                      <div className="space-y-2 rounded-md bg-zinc-100 p-2 shadow-sm">
                        <div className="h-2 w-[80px] rounded-lg bg-zinc-200" />
                        <div className="h-2 w-[100px] rounded-lg bg-zinc-200" />
                      </div>
                      <div className="flex items-center space-x-2 rounded-md bg-zinc-100 p-2 shadow-sm">
                        <div className="h-4 w-4 rounded-full bg-zinc-200" />
                        <div className="h-2 w-[100px] rounded-lg bg-zinc-200" />
                      </div>
                      <div className="flex items-center space-x-2 rounded-md bg-zinc-100 p-2 shadow-sm">
                        <div className="h-4 w-4 rounded-full bg-zinc-200" />
                        <div className="h-2 w-[100px] rounded-lg bg-zinc-200" />
                      </div>
                    </div>
                  </div>
                  <span className="absolute inset-0 flex h-full w-full items-center justify-center rounded-md bg-zinc-950/30 opacity-0 hover:opacity-100">
                    <span className="sr-only">
                      {t("appearance.themeMode.light")}
                    </span>
                    <span className="bg-zinc-900 text-white text-sm font-medium px-2 py-0.5 rounded-sm">
                      {t("appearance.themeMode.light")}
                    </span>
                  </span>
                  {currentTheme === "light" && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </button>
              {/* <div className="relative cursor-pointer">
                <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                  <div className="space-y-2 rounded-sm bg-[#0f0f0f] p-2">
                    <div className="space-y-2 rounded-md bg-zinc-900 p-2 shadow-sm">
                      <div className="h-2 w-[80px] rounded-lg bg-zinc-700" />
                      <div className="h-2 w-[100px] rounded-lg bg-zinc-700" />
                    </div>
                    <div className="flex items-center space-x-2 rounded-md bg-zinc-900 p-2 shadow-sm">
                      <div className="h-4 w-4 rounded-full bg-zinc-700" />
                      <div className="h-2 w-[100px] rounded-lg bg-zinc-700" />
                    </div>
                    <div className="flex items-center space-x-2 rounded-md bg-zinc-900 p-2 shadow-sm">
                      <div className="h-4 w-4 rounded-full bg-zinc-700" />
                      <div className="h-2 w-[100px] rounded-lg bg-zinc-700" />
                    </div>
                  </div>
                </div>
                <span className="absolute inset-0 flex h-full w-full items-center justify-center rounded-md bg-zinc-950/30 opacity-0 hover:opacity-100">
                  <span className="sr-only">Classic Dark</span>
                  <span className="bg-zinc-900 text-white text-sm font-medium px-2 py-0.5 rounded-sm">
                    Classic Dark
                  </span>
                </span>
              </div> */}
              <button
                type="button"
                className="relative"
                onClick={() => setTheme("system")}
              >
                <div className="relative cursor-pointer">
                  <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                    <div className="space-y-2 rounded-sm bg-gradient-to-br from-white to-[#1c1c1c] p-2">
                      <div className="space-y-2 rounded-md bg-gradient-to-br from-zinc-100 to-zinc-900 p-2 shadow-sm">
                        <div className="h-2 w-[80px] rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-700" />
                        <div className="h-2 w-[100px] rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-700" />
                      </div>
                      <div className="flex items-center space-x-2 rounded-md bg-gradient-to-br from-zinc-100 to-zinc-900 p-2 shadow-sm">
                        <div className="h-4 w-4 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-700" />
                        <div className="h-2 w-[100px] rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-700" />
                      </div>
                      <div className="flex items-center space-x-2 rounded-md bg-gradient-to-br from-zinc-100 to-zinc-900 p-2 shadow-sm">
                        <div className="h-4 w-4 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-700" />
                        <div className="h-2 w-[100px] rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-700" />
                      </div>
                    </div>
                  </div>
                  <span className="absolute inset-0 flex h-full w-full items-center justify-center rounded-md bg-zinc-950/30 opacity-0 hover:opacity-100">
                    <span className="sr-only">
                      {t("appearance.themeMode.system")}
                    </span>
                    <span className="bg-zinc-900 text-white text-sm font-medium px-2 py-0.5 rounded-sm">
                      {t("appearance.themeMode.system")}
                    </span>
                  </span>
                  {currentTheme === "system" && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function _DeleteAccount() {
  const t = useTranslations("member.me");
  return (
    <Card x-chunk="dashboard-09-chunk-2" className="border-destructive/15 pb-0">
      <CardHeader>
        <CardTitle>{t("deleteAccount.title")}</CardTitle>
        <CardDescription>{t("deleteAccount.description")}</CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-between border-t px-6 py-4 text-sm bg-destructive/15 rounded-b-lg text-destructive">
        <Button variant="destructive">{t("deleteAccount.button")}</Button>
      </CardFooter>
    </Card>
  );
}
