"use server";

import { db } from "@heiso-io/bee/lib/db";
import { apiPermissions } from "@heiso-io/bee/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getPermissions() {
  const result = await db.query.apiPermissions.findMany({
    where: (t, { isNull }) => isNull(t.deletedAt),
  });

  return result;
}

type MinimalMenu = { id: string; title: string; icon: string | null };
type MinimalPermission = {
  id: string;
  resource: string;
  action: string;
  menuId?: string | null;
  db?: boolean;
};

async function groupPermissionsByResource(
  menus: MinimalMenu[],
  permissions: MinimalPermission[],
  dbPermissions: MinimalPermission[],
) {
  // 合併時以穩定 key（id）為主；DB 覆寫同 id 的 config
  const map = new Map<string, MinimalPermission>();
  for (const p of permissions) {
    map.set(p.id, p);
  }
  for (const p of dbPermissions) {
    map.set(p.id, p);
  }
  const uniquePermissions = Array.from(map.values());

  return menus.map((menu) => {
    const menuPermissions = uniquePermissions.filter(
      (permission) => permission.menuId === menu.id,
    );

    return {
      id: menu.id,
      title: menu.title,
      icon: menu.icon,
      permissions: menuPermissions.map((p) => {
        const dbPermission = dbPermissions.find((dbP) => dbP.id === p.id);
        return {
          id: p.id,
          resource: p.resource,
          action: p.action,
          db: !!dbPermission,
        };
      }),
    };
  });
}

async function createPermission({
  resource,
  action,
}: {
  resource: string;
  action: string;
}) {
  const result = await db.insert(apiPermissions).values({
    resource,
    action,
  });

  revalidatePath("/portal/dev-center/permission", "page");
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
    })
    .where(eq(apiPermissions.id, id));

  revalidatePath("/portal/dev-center/permission", "page");
  return result;
}

async function deletePermission({ id }: { id: string }) {
  const result = await db
    .update(apiPermissions)
    .set({
      deletedAt: new Date(),
    })
    .where(and(eq(apiPermissions.id, id), isNull(apiPermissions.deletedAt)));

  revalidatePath("/portal/dev-center/permission", "page");
  return result;
}

async function deletePermissionByKey({ id }: { id: string }) {
  const result = await db
    .update(apiPermissions)
    .set({ deletedAt: new Date() })
    .where(and(eq(apiPermissions.id, id), isNull(apiPermissions.deletedAt)));

  revalidatePath("/portal/dev-center/permission", "page");
  return result;
}

// Soft delete all current permissions (set deletedAt)
async function deleteAllPermissions() {
  const result = await db
    .update(apiPermissions)
    .set({ deletedAt: new Date() })
    .where(isNull(apiPermissions.deletedAt));

  // Refresh the permission page to reflect all unchecked states
  revalidatePath("/portal/dev-center/permission", "page");
  return result;
}

export {
  getPermissions,
  groupPermissionsByResource,
  createPermission,
  updatePermission,
  deletePermission,
  deletePermissionByKey,
  deleteAllPermissions,
};
