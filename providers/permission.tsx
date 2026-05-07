"use client";

import { getUserPermissions } from "@heiso-io/bee/server/services/permission";
import type { UserPermission } from "@heiso-io/bee/server/services/role";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface Permission {
  resource: string;
  action: string;
}

interface PermissionCheck {
  permissions: Permission[];
}

export interface PermissionContextType {
  can: (params: PermissionCheck) => Promise<boolean[]>;
  role: string | null;
  refresh: () => Promise<void>;
}

const defaultContext: PermissionContextType = {
  can: async () => [],
  role: null,
  refresh: async () => {},
};

export const PermissionContext =
  createContext<PermissionContextType>(defaultContext);

export const usePermissionContext = () => useContext(PermissionContext);

export const PermissionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [role, setRole] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<
    UserPermission["permissions"] | null
  >(null);

  const fetchPermissions = useCallback(async () => {
    try {
      const result = await getUserPermissions();
      setRole(result.role);
      setIsOwner(("isOwner" in result && (result as any).isOwner) ?? false);
      setPermissions(result.permissions);
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
      setPermissions(null);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const can = useCallback(
    async ({
      permissions: permissionsList,
    }: PermissionCheck): Promise<boolean[]> => {
      if (isOwner === true) return Array(permissionsList.length).fill(true);
      if (!permissions) return Array(permissionsList.length).fill(false);

      return permissionsList.map(({ resource, action }) =>
        permissions.some((p) => p.resource === resource && p.action === action),
      );
    },
    [isOwner, permissions],
  );

  return (
    <PermissionContext.Provider
      value={{ can, role, refresh: fetchPermissions }}
    >
      {children}
    </PermissionContext.Provider>
  );
};
