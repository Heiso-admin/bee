"use client";

import { Button } from "@heiso-io/bee/components/ui/button";
import type { TPublicApiKey } from "@heiso-io/bee/lib/db/schema";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CreateApiKeyDialog } from "./create-api-key-dialog";

interface CreateApiKeyButtonProps {
  onSuccess?: (apiKey: TPublicApiKey) => void;
  availableRoles: { id: string; name: string }[];
}

export function CreateApiKeyButton({ onSuccess, availableRoles }: CreateApiKeyButtonProps) {
  const t = useTranslations("apiKeys");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = (apiKey: TPublicApiKey) => {
    setIsDialogOpen(false);
    onSuccess?.(apiKey);
  };

  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {t("create_api_key")}
      </Button>

      <CreateApiKeyDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleSuccess}
        availableRoles={availableRoles}
      />
    </>
  );
}
