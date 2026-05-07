"use client";

import { Button } from "@heiso-io/bee/components/ui/button";
import { Calendar } from "@heiso-io/bee/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heiso-io/bee/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@heiso-io/bee/components/ui/form";
import { Input } from "@heiso-io/bee/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@heiso-io/bee/components/ui/select";
import { Switch } from "@heiso-io/bee/components/ui/switch";
import type { TPublicApiKey } from "@heiso-io/bee/lib/db/schema";
import { cn } from "@heiso-io/bee/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths, addYears } from "date-fns";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createApiKey } from "../_server/api-keys.service";

const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  roleId: z.string().min(1, "Role is required"),
  expiresAt: z.string().optional(),
  rateLimitPlan: z.string(),
  rateLimit: z
    .object({
      requests: z.number().int().min(1, "Requests must be at least 1"),
      window: z.number().int().min(1, "Window must be at least 1"),
    })
    .optional(),
});

type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>;

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (apiKey: TPublicApiKey) => void;
  availableRoles: { id: string; name: string }[];
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSuccess,
  availableRoles,
}: CreateApiKeyDialogProps) {
  const t = useTranslations("apiKeys");
  const [isPending, startTransition] = useTransition();
  const [createdApiKey, setCreatedApiKey] = useState<{
    key: string;
    apiKey: TPublicApiKey;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<CreateApiKeyFormData>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      name: "",
      roleId: availableRoles[0]?.id ?? "",
      expiresAt: "1.5_years",
      rateLimitPlan: "standard",
      rateLimit: {
        requests: 500,
        window: 60,
      },
    },
  });

  const handleSubmit = (data: CreateApiKeyFormData) => {
    startTransition(async () => {
      try {
        let expiresAtDate: Date | null = null;
        if (data.expiresAt === "1_year") {
          expiresAtDate = addYears(new Date(), 1);
        } else if (data.expiresAt === "1.5_years") {
          expiresAtDate = addMonths(new Date(), 18);
        } else if (data.expiresAt === "3_years") {
          expiresAtDate = addYears(new Date(), 3);
        }

        let rateLimit = { requests: 500, window: 60 };
        if (data.rateLimitPlan === "professional") {
          rateLimit = { requests: 1000, window: 60 };
        } else if (data.rateLimitPlan === "enterprise") {
          rateLimit = { requests: 3000, window: 60 };
        }

        const result = await createApiKey({
          name: data.name,
          roleId: data.roleId,
          expiresAt: expiresAtDate,
          rateLimit,
        });

        if (result.success && result.apiKey) {
          setCreatedApiKey({
            key: result.apiKey.key,
            apiKey: {
              id: result.apiKey.id,
              roleId: result.apiKey.roleId,
              createdByMemberId: result.apiKey.createdByMemberId,
              name: result.apiKey.name,
              truncatedKey: result.apiKey.truncatedKey ?? result.apiKey.keyPrefix,
              rateLimitRequests: result.apiKey.rateLimitRequests,
              rateLimitWindowSeconds: result.apiKey.rateLimitWindowSeconds,
              expiresAt: result.apiKey.expiresAt,
              createdAt: result.apiKey.createdAt,
              updatedAt: result.apiKey.updatedAt,
              lastUsedAt: result.apiKey.lastUsedAt,
            },
          });
          toast.success(t("create_success"));
        } else {
          toast.error(result.error || t("create_error"));
        }
      } catch (error) {
        console.error("Error creating API key:", error);
        toast.error(t("create_error"));
      }
    });
  };

  const handleCopyKey = async () => {
    if (!createdApiKey) return;

    try {
      await navigator.clipboard.writeText(createdApiKey.key);
      setCopied(true);
      toast.success(t("key_copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying key:", error);
      toast.error(t("copy_error"));
    }
  };

  const handleClose = () => {
    if (createdApiKey) {
      onSuccess(createdApiKey.apiKey);
      setCreatedApiKey(null);
    }
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {!createdApiKey ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("create_api_key")}</DialogTitle>
              <DialogDescription>
                {t("create_api_key_description")}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("name_placeholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableRoles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        API key 繼承此 role 的 permissions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("expires_at")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1_year">
                            {t("expires_1_year")}
                          </SelectItem>
                          <SelectItem value="1.5_years">
                            {t("expires_1_5_years")}
                          </SelectItem>
                          <SelectItem value="3_years">
                            {t("expires_3_years")}
                          </SelectItem>
                          <SelectItem value="never">
                            {t("expires_never")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2 border-t mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {t("advanced_settings")}
                    </span>
                    <Switch
                      checked={showAdvanced}
                      onCheckedChange={setShowAdvanced}
                    />
                  </div>

                  {showAdvanced && (
                    <div className="space-y-4 pt-2">
                      <FormField
                        control={form.control}
                        name="rateLimitPlan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("rate_limit_plan")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="standard">
                                  {t("plan_standard")}
                                </SelectItem>
                                <SelectItem value="professional">
                                  {t("plan_professional")}
                                </SelectItem>
                                <SelectItem value="enterprise">
                                  {t("plan_enterprise")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>



                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? t("creating") : t("create")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("api_key_created")}</DialogTitle>
              <DialogDescription>
                {t("api_key_created_description")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  {t("important_notice")}
                </p>
                <p className="text-sm text-yellow-700">
                  {t("copy_key_warning")}
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="api-key-display"
                  className="text-sm font-medium"
                >
                  {t("api_key")}
                </label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 p-3 bg-sub-background rounded border text-sm font-mono break-all">
                    {createdApiKey.key}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyKey}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">{t("name")}:</span>
                  <p className="text-gray-600">{createdApiKey.apiKey.name}</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>{t("done")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
