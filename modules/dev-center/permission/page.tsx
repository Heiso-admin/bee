import { CaptionTotal } from "@heiso-io/bee/components/shared/caption-total";
import { Suspense } from "react";
import { Skeleton } from "@heiso-io/bee/components/ui/skeleton";
import { getMenus } from "@heiso-io/bee/modules/dev-center/permission/_server/menu.service";
import {
  getPermissions,
  groupPermissionsByResource,
} from "@heiso-io/bee/modules/dev-center/permission/_server/permission.service";
import { PermissionListContent } from "./_components/permission-list-content";

export default async function PermissionPage() {
  const menus = await getMenus();
  const dbPermissions = await getPermissions();
  const permissionGroups = await groupPermissionsByResource(
    menus,
    [],
    dbPermissions,
  );

  const totalPermissions = permissionGroups.reduce(
    (acc, g) => acc + g.permissions.length,
    0,
  );

  return (
    <div className="container m-auto max-w-6xl justify-start py-10 p-6 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <CaptionTotal title="Permissions" total={totalPermissions} />
      </div>

      <Suspense fallback={<div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}>
        <PermissionListContent groups={permissionGroups} />
      </Suspense>
    </div>
  );
}
