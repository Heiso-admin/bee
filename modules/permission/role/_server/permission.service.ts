"use server";

import { db } from "@heiso-io/bee/lib/db";
import {
  apiPermissions,
  type TApiPermission,
} from "@heiso-io/bee/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getPermissions() {
  return db.query.apiPermissions.findMany({
    where: (t, { isNull }) => isNull(t.deletedAt),
  });
}

// menu_id 已從 apiPermissions 拿掉（UI / API 解耦）
// 改成依 resource 分組，每個 resource 列出所有 actions
async function groupPermissionsByResource<P extends TApiPermission>(
  permissions: P[],
) {
  const grouped: Record<string, { id: string; resource: string; action: string }[]> = {};
  for (const p of permissions) {
    if (!grouped[p.resource]) grouped[p.resource] = [];
    grouped[p.resource].push({ id: p.id, resource: p.resource, action: p.action });
  }
  return Object.entries(grouped).map(([resource, items]) => ({
    resource,
    permissions: items,
  }));
}

async function createPermission({
  resource,
  action,
}: {
  space: "Organization" | "Project";
  resource: string;
  action: string;
}) {
  const result = await db.insert(apiPermissions).values({
    resource,
    action,
  });

  revalidatePath("/portal/account/role", "page");
  return result;
}

async function updatePermission({
  id,
  resource,
  action,
}: {
  id: string;
  resource: string;
  action: string;
}) {
  const result = await db
    .update(apiPermissions)
    .set({
      resource,
      action,
      updatedAt: new Date(),
    })
    .where(eq(apiPermissions.id, id));

  revalidatePath("/portal/account/role", "page");
  return result;
}

async function deletePermission({ id }: { id: string }) {
  const result = await db
    .update(apiPermissions)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(apiPermissions.id, id), isNull(apiPermissions.deletedAt)));

  revalidatePath("/portal/account/role", "page");
  return result;
}

export {
  getPermissions,
  groupPermissionsByResource,
  createPermission,
  updatePermission,
  deletePermission,
};
