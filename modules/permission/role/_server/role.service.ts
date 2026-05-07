"use server";

import { db } from "@heiso-io/bee/lib/db";
import type {
  TMenu,
  TApiPermission,
  TRole,
  TRoleInsert,
  TRoleUpdate,
} from "@heiso-io/bee/lib/db/schema";
import { roles } from "@heiso-io/bee/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type Role = TRole & {
  menus: {
    menus: TMenu;
  }[];
  apiPermissions: {
    apiPermission: TApiPermission;
  }[];
};

async function getRoles(): Promise<Role[]> {
  const result = await db.query.roles.findMany({
    with: {
      menus: {
        with: {
          menus: true,
        },
      },
      apiPermissions: {
        with: {
          apiPermission: true,
        },
      },
    },
    where: (t, { isNull }) => isNull(t.deletedAt),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  return result as Role[];
}

async function createRole(data: TRoleInsert) {
  const result = await db.insert(roles).values(data);
  revalidatePath("/portal/account/role", "page");
  return result;
}

async function updateRole(id: string, data: TRoleUpdate) {
  const result = await db
    .update(roles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(roles.id, id));

  revalidatePath("/portal/account/role", "page");
  return result;
}

async function deleteRole({ id }: { id: string }) {
  const result = await db
    .update(roles)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(roles.id, id), isNull(roles.deletedAt)));

  revalidatePath("/portal/account/role", "page");
  return result;
}

export { getRoles, createRole, updateRole, deleteRole };
