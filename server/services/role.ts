"use server";

import { db } from "@heiso-io/bee/lib/db";

interface UserPermission {
  role: string;
  isOwner: boolean;
  permissions?: {
    id: string;
    resource: string;
    action: string;
  }[];
}

/**
 * 取得使用者權限
 * 統一使用 members 表
 */
async function findUserPermissions(memberId: string): Promise<UserPermission> {

  const member = await db.query.members.findFirst({
    columns: {
      id: true,
      role: true,
      roleId: true,
    },
    with: {
      customRole: {
        columns: {
          id: true,
          name: true,
        },
        with: {
          apiPermissions: {
            with: {
              apiPermission: {
                columns: {
                  id: true,
                  resource: true,
                  action: true,
                },
              },
            },
          },
        },
      },
    },
    where: (t, { eq, isNull, and }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });

  if (!member) throw new Error("User not found");

  const customRole = (member as any).customRole as
    | { id: string; name: string; apiPermissions?: { apiPermission: { id: string; resource: string; action: string } }[] }
    | null
    | undefined;

  const isOwner = member.role === "owner";
  const roleName = isOwner ? "owner" : (customRole?.name ?? member.role ?? "");

  return {
    role: roleName,
    isOwner,
    permissions: customRole?.apiPermissions?.map((e) => e.apiPermission) ?? [],
  };
}

export { findUserPermissions, type UserPermission };
