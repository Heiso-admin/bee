"use client";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { ActionButton } from "@heiso-io/bee/components/primitives/action-button";
import { MenuTree } from "@heiso-io/bee/components/primitives/menu";
import { CaptionTotal } from "@heiso-io/bee/components/shared/caption-total";
import { Badge } from "@heiso-io/bee/components/ui/badge";
import { Button } from "@heiso-io/bee/components/ui/button";
import { Checkbox } from "@heiso-io/bee/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@heiso-io/bee/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@heiso-io/bee/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@heiso-io/bee/components/ui/form";
import { Input } from "@heiso-io/bee/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@heiso-io/bee/components/ui/select";
import { Separator } from "@heiso-io/bee/components/ui/separator";
import { Textarea } from "@heiso-io/bee/components/ui/textarea";
import type { TMenu } from "@heiso-io/bee/lib/db/schema";
import { MODULES } from "@heiso-io/bee/lib/modules";
import { cn } from "@heiso-io/bee/lib/utils";
import { useAccount } from "@heiso-io/bee/providers/account";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronDown,
  ChevronRight,
  ListChevronsDownUp,
  Pencil,
  Plus,
  Trash,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { assignMenus, assignPermissions } from "../_server/assign.service";
import type { Role } from "../_server/role.service";
import { createRole, deleteRole, updateRole } from "../_server/role.service";

export function RoleList({
  data,
  menus,
  permissions,
}: {
  data: Role[];
  menus: TMenu[];
  permissions: any;
}) {
  const t = useTranslations("dashboard.permission.role");
  const { kind } = useAccount();
  const staff = kind === "dev";
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Role | null>(null);
  const [isCollapsedClose, setIsListCollapsedClose] = useState<boolean>(false); //點擊一律關閉

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto pt-4 pr-4 h-full flex flex-col">
        <CreateOrUpdateRole
          open={open}
          onClose={() => {
            setOpen(false);
            setSelectedItem(null);
          }}
          data={selectedItem}
        />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="bg-transparent"
              onClick={() => setIsListCollapsedClose(!isCollapsedClose)}
            >
              <ListChevronsDownUp className="h-4 w-4" />
            </Button>
            {pathname.indexOf("dev-center") !== -1 && staff && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("list.add_new")}
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-4">
          {data.map((role) => (
            <RoleItemCollapsible
              key={role.id}
              role={role}
              menus={menus}
              permissionGroups={permissions}
              isCollapsedClose={isCollapsedClose}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
}

function RoleItemCollapsible({
  role,
  menus,
  permissionGroups,
  isCollapsedClose,
}: {
  role: Role;
  menus: TMenu[];
  permissionGroups: any[];
  isCollapsedClose: boolean;
}) {
  const t = useTranslations("dashboard.permission.role");
  const { kind } = useAccount();
  const staff = kind === "dev";
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMenus, setSelectedMenus] = useState<string[]>(
    role.menus?.map((m: any) => m.menus.id) ?? [],
  );
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    role.apiPermissions?.map((p: any) => p.permission.id) ?? [],
  );
  const [name, setName] = useState<string>(role.name || "");
  const [description, setDescription] = useState<string>(
    role.description || "",
  );
  const [allowMagicLink, setAllowMagicLink] = useState<boolean>(
    role.allowMagicLink ?? true,
  );
  const [allowPassword, setAllowPassword] = useState<boolean>(
    role.allowPassword ?? true,
  );
  const [allowTwoFactor, setAllowTwoFactor] = useState<boolean>(
    role.allowTwoFactor ?? false,
  );
  const [allowedModules, setAllowedModules] = useState<string[]>(
    role.allowedModules ?? [],
  );
  const [fullAccessEditing, setFullAccessEditing] = useState<boolean>(false);
  const prevPermissionsRef = useRef<string[] | null>(null);
  const prevMenusRef = useRef<string[] | null>(null);
  const [isSaving, startTransition] = useTransition();
  const ItemColStyle = {
    gridTemplateColumns: "minmax(200px, 1fr) 3fr",
    gap: "1rem",
  };

  // helpers: 取得角色預設的選單/權限 ID（穩定引用）
  const getRoleMenuIds = useCallback(
    (r: Role) => r.menus?.map((m: any) => m.menus.id) ?? [],
    [],
  );
  const getRolePermissionIds = useCallback(
    (r: Role) => r.apiPermissions?.map((p: any) => p.permission.id) ?? [],
    [],
  );

  // helpers: 將狀態重置為角色目前資料（不改 isEditing）（穩定引用）
  const applyRoleState = useCallback(
    (r: Role) => {
      setSelectedMenus(getRoleMenuIds(r));
      setSelectedPermissions(getRolePermissionIds(r));
      setName(r.name || "");
      setDescription(r.description || "");
      setAllowMagicLink(r.allowMagicLink ?? true);
      setAllowPassword(r.allowPassword ?? true);
      setAllowTwoFactor(r.allowTwoFactor ?? false);
      setAllowedModules(r.allowedModules ?? []);
      setFullAccessEditing(false);
      prevPermissionsRef.current = null;
      prevMenusRef.current = null;
    },
    [getRoleMenuIds, getRolePermissionIds],
  );

  // helpers: 記住原先選擇（僅在尚未記住時）（依賴目前選擇）
  const snapshotPrevIfNeeded = useCallback(() => {
    if (!prevPermissionsRef.current)
      prevPermissionsRef.current = selectedPermissions;
    if (!prevMenusRef.current) prevMenusRef.current = selectedMenus;
  }, [selectedPermissions, selectedMenus]);

  const allPermissionIds = useMemo(() => {
    const ids: string[] = [];
    (permissionGroups || []).forEach((g: any) => {
      (g.permissions || []).forEach((p: any) => {
        ids.push(p.id);
      });
    });
    return Array.from(new Set(ids));
  }, [permissionGroups]);

  const allMenuIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (arr: any[]) => {
      (arr || []).forEach((n) => {
        ids.push(n.id);
        if (n.children) walk(n.children);
      });
    };
    walk(menus as any);
    return Array.from(new Set(ids));
  }, [menus]);

  // helpers: 全選權限與選單（僅在未全選時才設定）（穩定依賴）
  const selectAllMenusAndPermissions = useCallback(() => {
    snapshotPrevIfNeeded();
    if (selectedPermissions.length !== allPermissionIds.length) {
      setSelectedPermissions(allPermissionIds);
    }
    if (selectedMenus.length !== allMenuIds.length) {
      setSelectedMenus(allMenuIds);
    }
  }, [
    snapshotPrevIfNeeded,
    selectedPermissions.length,
    allPermissionIds,
    selectedMenus.length,
    allMenuIds,
  ]);

  // helpers: 從快照還原選擇，並清空快照（穩定引用）
  const restoreSelectionsFromPrev = useCallback(() => {
    setSelectedPermissions(prevPermissionsRef.current ?? []);
    prevPermissionsRef.current = null;
    setSelectedMenus(prevMenusRef.current ?? []);
    prevMenusRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof isCollapsedClose === "boolean") {
      setIsOpen(false);
    }
  }, [isCollapsedClose]);

  useEffect(() => {
    // 重置為角色目前的權限/選單；儲存進行中時避免被舊資料覆蓋
    if (isSaving) return;
    applyRoleState(role);
  }, [role, applyRoleState, isSaving]);

  const permissionMap = useMemo(() => {
    const m = new Map<string, any[]>();
    (permissionGroups || []).forEach((g: any) => {
      m.set(g.id, g.permissions || []);
    });
    return m;
  }, [permissionGroups]);

  const menusWithPerms = useMemo(() => {
    const attach = (arr: any[]): any[] =>
      (arr || []).map((node) => ({
        ...node,
        permissions: permissionMap.get(node.id) || [],
        children: node.children ? attach(node.children) : undefined,
      }));
    return attach(menus as any);
  }, [menus, permissionMap]);

  const handleCancelEdit = () => {
    applyRoleState(role);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!allowMagicLink && !allowPassword && !allowTwoFactor) {
      toast.error("At least one login method must be enabled");
      return;
    }
    startTransition(async () => {
      await updateRole(role.id, {
        name,
        description,
        allowMagicLink,
        allowPassword,
        allowTwoFactor,
        allowedModules,
      });
      await assignMenus({ roleId: role.id, menus: selectedMenus });
      await assignPermissions({
        roleId: role.id,
        permissions: selectedPermissions,
      });
      toast.success(t("form.update_title"));
      setIsEditing(false);
    });
  };

  // 當預設或切換為完全訪問時，確保選單與權限已全選，視覺與資料一致
  useEffect(() => {
    if (!fullAccessEditing) return;
    // 記住原先狀態以便之後還原，並補齊未全選的項目
    selectAllMenusAndPermissions();
  }, [fullAccessEditing, selectAllMenusAndPermissions]);

  const handleToggleFullAccess = (checked: boolean | "indeterminate") => {
    if (!isEditing) return;
    const isChecked = checked === true;
    setFullAccessEditing(isChecked);
    if (isChecked) {
      selectAllMenusAndPermissions();
    } else {
      restoreSelectionsFromPrev();
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={isEditing ? undefined : setIsOpen}
      className="flex flex-col gap-4 layout-split-pane border-none"
    >
      <div
        className="grid items-center gap-4"
        style={{ gridTemplateColumns: "minmax(200px, auto) 1fr auto" }}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center space-x-3 cursor-pointer">
            {isOpen ? (
              <ChevronDown className="size-5" />
            ) : (
              <ChevronRight className="size-5" />
            )}
            {isEditing ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("form.name")}
                className="h-8 w-[220px]"
              />
            ) : (
              <h4 className="text-sm font-semibold">{role.name}</h4>
            )}
          </div>
        </CollapsibleTrigger>
        {/* Login methods summary chips — view-only in row header. Edit happens in the body section below. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {role.allowMagicLink && (
            <Badge variant="outline" className="font-normal">
              Magic link
            </Badge>
          )}
          {role.allowPassword && (
            <Badge variant="outline" className="font-normal">
              Password
            </Badge>
          )}
          {role.allowTwoFactor && (
            <Badge variant="outline" className="font-normal">
              2FA
            </Badge>
          )}
        </div>


        <div className="flex items-center">
          {!isEditing ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
                setIsOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                className="mr-2"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
              >
                {t("form.cancel")}
              </Button>
              <ActionButton
                className="mr-2"
                size="sm"
                loading={isSaving}
                disabled={isSaving}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
              >
                {t("form.save")}
              </ActionButton>
            </>
          )}
          {pathname.indexOf("dev-center") !== -1 && staff && (
            <DeleteConfirm id={role.id}>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash className="size-4" />
              </Button>
            </DeleteConfirm>
          )}
        </div>
      </div>
      <CollapsibleContent className="flex flex-col gap-6 px-8 pt-2">
        <span className="w-full wrap-break-words overflow-hidden ">
          {isEditing ? (
            <Textarea
              className="min-h-8 py-1"
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= 200)
                  setDescription(e.target.value);
              }}
              placeholder={t("form.description")}
              maxLength={200}
            />
          ) : (
            <span className="text-sm">{`${t("form.description")} : ${role.description}`}</span>
          )}
        </span>
        <Separator />

        {/* Login methods section */}
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-medium text-muted-foreground">
              Login methods
            </h5>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Pick which sign-in options members of this role can use. At least one must be enabled.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                isEditing
                  ? "cursor-pointer hover:bg-accent/50"
                  : "opacity-70 cursor-default",
                allowMagicLink && "border-primary/40 bg-primary/5",
              )}
            >
              <Checkbox
                checked={allowMagicLink}
                disabled={!isEditing}
                onCheckedChange={(c) => setAllowMagicLink(c === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="text-sm font-medium">Magic link</div>
                <div className="text-xs text-muted-foreground">
                  Passwordless sign-in via emailed one-click link
                </div>
              </div>
            </label>
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                isEditing
                  ? "cursor-pointer hover:bg-accent/50"
                  : "opacity-70 cursor-default",
                allowPassword && "border-primary/40 bg-primary/5",
              )}
            >
              <Checkbox
                checked={allowPassword}
                disabled={!isEditing}
                onCheckedChange={(c) => setAllowPassword(c === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="text-sm font-medium">Password</div>
                <div className="text-xs text-muted-foreground">
                  Email + password, no second factor
                </div>
              </div>
            </label>
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                isEditing
                  ? "cursor-pointer hover:bg-accent/50"
                  : "opacity-70 cursor-default",
                allowTwoFactor && "border-primary/40 bg-primary/5",
              )}
            >
              <Checkbox
                checked={allowTwoFactor}
                disabled={!isEditing}
                onCheckedChange={(c) => setAllowTwoFactor(c === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="text-sm font-medium">2FA</div>
                <div className="text-xs text-muted-foreground">
                  Password + one-time code by email
                </div>
              </div>
            </label>
          </div>
        </div>

        <Separator />

        {/* Modules section — which top-level features the role can access */}
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-medium text-muted-foreground">
              Modules
            </h5>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Pick which feature modules this role can access. Sidebar / menus only show items from enabled modules.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MODULES.map((mod) => {
              const checked = allowedModules.includes(mod.id);
              return (
                <label
                  key={mod.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                    isEditing
                      ? "cursor-pointer hover:bg-accent/50"
                      : "opacity-70 cursor-default",
                    checked && "border-primary/40 bg-primary/5",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!isEditing}
                    onCheckedChange={(c) => {
                      if (!isEditing) return;
                      setAllowedModules((prev) =>
                        c === true
                          ? [...prev, mod.id]
                          : prev.filter((id) => id !== mod.id),
                      );
                    }}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{mod.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {mod.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Header row */}
        <div className="grid items-center justify-between" style={ItemColStyle}>
          <div className="flex items-center gap-2 ">
            <Checkbox
              id={`fullAccess-${role.id}`}
              checked={!!fullAccessEditing}
              disabled={!isEditing}
              onCheckedChange={handleToggleFullAccess}
            />
            <label
              htmlFor={`fullAccess-${role.id}`}
              className={cn(
                "text-sm ml-2",
                !isEditing ? "text-muted-foreground" : "",
              )}
            >
              <h5 className="text-sm font-medium text-muted-foreground">
                {t("form.menuTitle")}
              </h5>
            </label>
            {(false || fullAccessEditing) && (
              <Badge className="ml-1" variant="outline">
                {t("list.full_access")}
              </Badge>
            )}
          </div>
          <h5 className="text-sm font-medium text-muted-foreground">
            {t("form.permissionTitle")}
          </h5>
        </div>

        {/* Menu 與權限行內結合（權限在 MenuTree 內部以 resource 群組顯示） */}
        <MenuTree
          externalDndContext={true}
          style={ItemColStyle}
          items={menusWithPerms as any}
          selectable={{
            selectedItems: selectedMenus,
            disabled: !isEditing || !!fullAccessEditing,
            onSelectionChange: (itemId, checked) => {
              if (!isEditing || fullAccessEditing) return;
              setSelectedMenus((prev) =>
                checked
                  ? [...prev, itemId]
                  : prev.filter((id) => id !== itemId),
              );
            },
          }}
          selectPermission={{
            selectedItems: selectedPermissions,
            disabled: !isEditing || !!fullAccessEditing,
            onSelectionChange: (permissionId, checked) => {
              if (!isEditing || fullAccessEditing) return;
              setSelectedPermissions((prev) =>
                checked
                  ? [...prev, permissionId]
                  : prev.filter((id) => id !== permissionId),
              );
            },
          }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function CreateOrUpdateRole({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: Role | null;
}) {
  const t = useTranslations("dashboard.permission.role.form");
  const [isPending, startTransition] = useTransition();

  const formSchema = z.object({
    name: z.string().min(1, { message: t("validation.name_required") }),
    description: z.string().optional(),

  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
    },
  });

  useEffect(() => {
    if (data) {
      form.setValue("name", data.name);
      form.setValue("description", data.description ?? "");
    }
  }, [data, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Handle form submission
    startTransition(async () => {
      if (data) {
        await updateRole(data.id, values);
      } else {
        await createRole({
          ...values,
        });
      }
      form.reset();
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {data ? t("update_title") : t("create_title")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              defaultValue=""
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("name")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              defaultValue=""
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("description")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <ActionButton
                type="submit"
                loading={isPending}
                disabled={isPending}
              >
                {t("save")}
              </ActionButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirm({
  children,
  id,
}: {
  children: React.ReactNode;
  id: string;
}) {
  const t = useTranslations("dashboard.permission.role.delete_confirm");
  const [isDeletePending, startDeleteTransition] = useTransition();

  const handleDelete = async () => {
    startDeleteTransition(async () => {
      await deleteRole({ id });
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>
            <Button variant="outline">{t("cancel")}</Button>
          </DialogClose>
          <DialogClose>
            <ActionButton
              onClick={handleDelete}
              loading={isDeletePending}
              disabled={isDeletePending}
            >
              {t("delete")}
            </ActionButton>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
