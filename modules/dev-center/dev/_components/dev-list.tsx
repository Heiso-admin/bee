"use client";

import { Avatar } from "@heiso-io/bee/components/primitives/avatar";
import { CaptionTotal } from "@heiso-io/bee/components/shared/caption-total";
import { ActionButton } from "@heiso-io/bee/components/primitives/action-button";
import { Badge } from "@heiso-io/bee/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@heiso-io/bee/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@heiso-io/bee/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@heiso-io/bee/components/ui/form";
import { Input } from "@heiso-io/bee/components/ui/input";
import { SearchInput } from "@heiso-io/bee/components/ui/search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@heiso-io/bee/components/ui/table";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ColumnDef,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import type { Staff } from "../_server/dev.service";
import { addStaff, removeStaff } from "../_server/dev.service";

const fuzzyFilter: FilterFn<Staff> = (row, _columnId, filterValue) => {
  const searchValue = filterValue.toLowerCase();
  const user = row.original.user;

  return !!(
    user.name?.toLowerCase().includes(searchValue) ||
    user.email?.toLowerCase().includes(searchValue)
  );
};

export function StaffList({ data }: { data: Staff[] }) {
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [isRemovePending, startRemoveTransition] = useTransition();
  const [filtering, setFiltering] = useState("");
  const [open, setOpen] = useState(false);
  const t = useTranslations("devCenter.staff");

  const columns: ColumnDef<Staff>[] = [
    {
      header: t("columns.name"),
      accessorFn: (row) => `${row.user.name} ${row.user.email}`,
      cell: ({ row }) => {
        const isYou = session?.user?.id === row.original.user.id;
        return <DeveloperUser staff={row.original} isYou={isYou} />;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div className="flex items-center justify-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  loading={isRemovePending}
                  disabled={isRemovePending}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{t("actions.moreActions")}</span>
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-xs text-destructive"
                  onClick={() => {
                    startRemoveTransition(async () => {
                      await removeStaff({ id: row.original.memberId });
                    });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("actions.remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const form = useForm<FormValues>({
    resolver: zodResolver(inviteFormSchema(t)),
    defaultValues: {
      email: "",
    },
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter: filtering,
    },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setFiltering,
  });

  const onSubmit = async (data: FormValues) => {
    startTransition(async () => {
      try {
        await addStaff({
          email: data.email,
        });
        toast.success(t("notifications.addSuccess"));
        setOpen(false);
        form.reset();
      } catch (error) {
        toast.error(t("notifications.addError"));
        console.error("Error adding administrator:", error);
      }
    });
  };

  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div className="container mx-auto pt-4 pr-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <CaptionTotal title={t("title")} total={totalRows} />
        <div className="flex gap-2">
          <SearchInput
            value={filtering}
            onChange={(e) => setFiltering(e.target.value)}
            placeholder={t("search.inputPlaceholder")}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <ActionButton
                variant="default"
                disabled={isPending}
                loading={isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("add.buttonLabel")}
              </ActionButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("add.dialogTitle")}</DialogTitle>
                <DialogDescription>
                  {t("add.dialogDescription")}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("add.emailLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("add.emailPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <ActionButton
                      type="submit"
                      loading={isPending}
                      disabled={isPending}
                    >
                      {isPending ? t("add.savingButton") : t("add.saveButton")}
                    </ActionButton>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="layout-split-pane flex flex-col justify-between grow overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export const DeveloperUser = ({
  staff,
  isYou,
}: {
  staff: Staff;
  isYou: boolean;
}) => {
  const t = useTranslations("devCenter.staff");
  const { user } = staff;
  const userName = user.name || user.email?.split("@")[0] || "Unknown";

  return (
    <div className="flex items-center gap-3 min-h-[35px]">
      <Avatar
        className="h-8 w-8"
        image={user.avatar}
        displayName={userName}
      />
      <div className="flex flex-col text-sm">
        <div className="flex items-center gap-2">
          <span>{userName}</span>
          {isYou && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {t("columns.youBadge")}
            </Badge>
          )}
        </div>
        <span className="text-gray-500 text-xs">{user.email}</span>
      </div>
    </div>
  );
};

const inviteFormSchema = (t: ReturnType<typeof useTranslations>) =>
  z.object({
    email: z.string().email(t("validation.emailInvalid")),
  });

type FormValues = z.infer<ReturnType<typeof inviteFormSchema>>;
