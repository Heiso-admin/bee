"use client";

import { Avatar } from "@heiso-io/bee/components/primitives/avatar";
import { DataPagination } from "@heiso-io/bee/components/primitives/pagination";
import { CaptionTotal } from "@heiso-io/bee/components/shared/caption-total";
import { Badge } from "@heiso-io/bee/components/ui/badge";
import { Button } from "@heiso-io/bee/components/ui/button";
import { RadioGroup } from "@heiso-io/bee/components/ui/radio-group";
import {
  RadioTagGroupItem,
  RadioTagLabel,
} from "@heiso-io/bee/components/ui/radio-tag";
import { SearchInput } from "@heiso-io/bee/components/ui/search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@heiso-io/bee/components/ui/table";
import { readableDate } from "@heiso-io/bee/lib/utils/format";
import { useAccount } from "@heiso-io/bee/providers/account";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { MemberStatus, type Member } from "../types";
import { invite } from "../_server/team.service";
import { ActionButton } from "@heiso-io/bee/components/primitives/action-button";
import { InviteMember } from "./invite-member";
import { MemberActions } from "./member-actions";
import { MenuAccess } from "../../role/_components/role-menu-access";
import type { TMenu } from "@heiso-io/bee/lib/db/schema";

// moved to team.service.ts
/*
export enum MemberStatus {
  Invited = "invited", // 已邀請/待驗證
  Joined = "joined", // 已加入/啟用
  Review = "review", // 待審核
  Disabled = "suspend", // 停用/已拒絕
  Owner = "Owner", // 擁有者
}
*/

type FilterStatus = "all" | MemberStatus;

export interface Role {
  id: string;
  name: string;
  loginMethod?: string | null;
}

const filterStatuses: FilterStatus[] = [
  "all",
  MemberStatus.Active,
  MemberStatus.Inactive,
  MemberStatus.Suspended,
];

export function MemberList({
  data,
  roles,
  menus,
}: {
  data: Member[];
  roles: Role[];
  menus: TMenu[];
}) {
  const { data: session } = useSession();
  const { kind } = useAccount();
  const staff = kind === "dev";
  const [filtering, setFiltering] = useState("");
  const te = useTranslations("dashboard.permission.team");
  const t = useTranslations("dashboard.permission.team.members");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    filterStatuses[0],
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // const AllRoles: Role[] = [
  //   { id: MemberStatus.Owner, name: MemberStatus.Owner },
  //   ...roles,
  // ];

  const showStatus = useCallback(
    (status: string | null, inviteExpiredAt?: Date | null) => {
      switch (status) {
        case MemberStatus.Invited:
          return inviteExpiredAt && inviteExpiredAt.getTime() > Date.now() ? (
            <Badge status="blue">{t("statuses.invited")}</Badge>
          ) : (
            <Badge status="red">{t("statuses.expired")}</Badge>
          );
        case MemberStatus.Suspended:
          return <Badge status="hidden">{t("statuses.suspended")}</Badge>;
        case MemberStatus.Active:
          return <Badge status="green">{t("statuses.active")}</Badge>;
        case MemberStatus.Inactive:
          return <Badge status="yellow">{t("statuses.inactive")}</Badge>;
        default:
          return status;
      }
    },
    [t],
  );

  const columns: ColumnDef<Member>[] = [
    {
      header: t("user"),
      accessorFn: (row) => {
        const email = row.profile?.email || "";
        const userName = row.profile?.name || email.split("@")[0] || "Unknown";
        return `${userName} ${email}`;
      },
      sortingFn: "basic",
      cell: ({ row }) => {
        const isYou = row.original.memberId === session?.user.id;
        return <MemberUser member={row.original} isYou={isYou} />;
      },
    },
    {
      accessorFn: (row) => {
        // row.role here is the TRole relation object, but the schema also has a 'role' column
        // We need to access the column value which is 'owner' | 'member'
        const memberRole = (row as any).role;
        if (typeof memberRole === 'string' && memberRole === 'owner') {
          return "Owner";
        }
        // If role is an object (TRole relation), get the name
        if (memberRole && typeof memberRole === 'object' && 'name' in memberRole) {
          return memberRole.name || "No Role";
        }
        return "No Role";
      },
      sortingFn: (rowA, rowB) => {
        const aIsOwner = (rowA.original as any).role === 'owner';
        const bIsOwner = (rowB.original as any).role === 'owner';
        const aRole = (rowA.original as any).role;
        const bRole = (rowB.original as any).role;
        const aValue = aIsOwner
          ? "0_Owner"
          : `1_${typeof aRole === 'object' ? aRole?.name : aRole || "ZZZ_No_Role"}`;
        const bValue = bIsOwner
          ? "0_Owner"
          : `1_${typeof bRole === 'object' ? bRole?.name : bRole || "ZZZ_No_Role"}`;
        return aValue.localeCompare(bValue);
      },
      header: t("role"),
      cell: ({ row }) => {
        // The member.role column value is 'owner' | 'member'
        // but there's also a 'role' relation to TRole
        const memberRole = (row.original as any).role;
        const isOwner = memberRole === 'owner';
        const roleRelation = roles.find((role) => role.id === row.original.roleId);
        const roleName = roleRelation?.name || null;

        if (isOwner) return <Badge variant="tag">Owner</Badge>;
        return roleName && <Badge variant="tag">{roleName}</Badge>;
      },
    },
    {
      header: t("status"),
      accessorKey: "status",
      sortingFn: "basic",
      cell: ({ row }) => {
        return showStatus(
          row.original.status,
          row.original.inviteExpiredAt,
        );
      },
    },
    // {
    //   header: t('signin'),
    //   id: 'signin',
    //   accessorFn: (row) => row.user?.loginMethod?.trim() || 'login',
    //   sortingFn: 'text',
    //   cell: ({ getValue }) => capitalize(String(getValue())),
    // },
    {
      header: t("createdDate"),
      accessorKey: "createdAt",
      sortingFn: "datetime",
      cell: ({ row }) => readableDate(row.original.createdAt),
    },
    {
      header: t("updatedDate"),
      id: "lastLoginAt",
      accessorFn: (row) => row.profile?.lastLoginAt ?? null,
      sortingFn: "datetime",
      cell: ({ getValue }) => {
        const value = getValue() as Date | string | null;
        return value ? readableDate(value) : "-";
      },
    },
    {
      header: t("actions"),
      id: "actions",
      cell: ({ row }) => {
        const isYou = row.original.memberId === session?.user.id;
        return (
          !isYou && (
            <div className="w-full flex items-center justify-center gap-2">
              {/* <ProtectedArea resource="member" action="edit"> */}
              <MemberActions
                member={row.original}
                currentMembers={data}
                roles={roles}
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{t("more")}</span>
                </Button>
              </MemberActions>
              <MenuAccess data={row.original.role as any} menus={menus}>
                <ActionButton variant="ghost" className="p-2 h-auto">
                  <ShieldCheck className="h-4 w-4" />
                </ActionButton>
              </MenuAccess>
              {/* </ProtectedArea> */}
            </div>
          )
        );
      },
    },
  ];

  const columnFilters = useMemo(
    () =>
      filterStatus === "all" ? [] : [{ id: "status", value: filterStatus }],
    [filterStatus],
  );

  const table = useReactTable({
    data: data,
    columns,
    state: {
      sorting,
      globalFilter: filtering ?? "",
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const totalRows = table.getFilteredRowModel().rows.length;
  const userName = session?.user?.name;
  if (!userName) return null;

  return (
    <div className="container mx-auto pt-4 pr-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <CaptionTotal title={te("title")} total={totalRows} />
        <div className="flex gap-2">
          <SearchInput
            value={filtering}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltering(e.target.value)}
            placeholder={t("searchMembers")}
          />
          {/* <ProtectedArea resource={'member'} action={'edit'}> */}
          {/* <AddMember roles={AllRoles} /> */}
          {/* {!staff && ( */}
          <InviteMember userName={userName} roles={roles}>
            <Button>
              <Plus className="h-4 w-4" /> {t("invite")}
            </Button>
          </InviteMember>
          {/* )} */}
          {/* </ProtectedArea> */}
        </div>
      </div>
      <RadioGroup
        value={filterStatus}
        className="flex items-center gap-3 mb-2"
        onValueChange={(value: string) => setFilterStatus(value as FilterStatus)}
      >
        <span className="pl-0.5 text-sm text-text-secondary">
          {t("filter.title")}:
        </span>
        {filterStatuses.map((item) => (
          <div className="flex items-center gap-3" key={item}>
            <RadioTagGroupItem className="hidden" value={item} id={item} />
            <RadioTagLabel htmlFor={item}>{t(`filter.${item}`)}</RadioTagLabel>
          </div>
        ))}
      </RadioGroup>

      <div className="layout-split-pane flex flex-col justify-between grow overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted(); // false | 'asc' | 'desc'
                  return (
                    <TableHead
                      key={header.id}
                      isSortable={isSortable}
                      sorted={sorted}
                      onClick={
                        isSortable
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      isCenter={header.column.id === "actions"}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="">
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DataPagination
          className="border-t"
          total={totalRows}
          inputPage={pagination.pageIndex + 1}
          onInputPageChange={(page) => table.setPageIndex(page - 1)}
          defaultRows={pagination.pageSize}
          onChangeRows={(rows) => table.setPageSize(rows)}
        />
      </div>
    </div>
  );
}

export const MemberUser = ({
  member,
  isYou,
}: {
  member: Member;
  isYou: boolean;
}) => {
  const t = useTranslations("dashboard.permission.team.members");
  const { profile, memberId } = member;
  const email = profile?.email || "";
  const userName = profile?.name || email.split("@")[0] || "Unknown";
  return (
    <div className="flex items-center gap-3 min-h-[35px]">
      <Avatar
        className="h-8 w-8"
        image={profile?.avatar}
        displayName={userName}
      />
      <div className="flex flex-col">
        <span>{userName}</span>
        <span className="text-neutral">{email}</span>
      </div>
      {isYou && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {t("you")}
        </Badge>
      )}
    </div>
  );
};
