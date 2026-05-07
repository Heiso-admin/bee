"use client";

import { RandomAvatar } from "@heiso-io/bee/components/primitives/random-avatar";
import { ThemeSwitcher } from "@heiso-io/bee/components/primitives/theme-switcher";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@heiso-io/bee/components/ui/avatar";
import { Badge } from "@heiso-io/bee/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@heiso-io/bee/components/ui/dropdown-menu";
import { useAccount } from "@heiso-io/bee/providers/account";
import { usePermissionContext } from "@heiso-io/bee/providers/permission";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export interface UserAvatarMenuItem {
  id: string;
  text?: string;
  href?: string;
  type?: "Group" | "Link" | "Separator" | "Theme" | "LogOut";
  group?: UserAvatarMenuItem[];
}

// TODO: avataaars generator
export function UserAvatar({
  className,
  menu,
}: {
  className?: string;
  menu: UserAvatarMenuItem[];
}) {
  const { member } = useAccount();
  const { role } = usePermissionContext();
  const { data: session } = useSession();

  // const menu = [
  //   {
  //     id: 'user',
  //     type: 'Group',
  //     group: [
  //       {
  //         id: 'dashboard',
  //         text: 'Dashboard',
  //         href: '/portal',
  //         type: 'Link',
  //       },
  //       {
  //         id: 'dev-center',
  //         text: 'Dev Center',
  //         href: '/portal/dev-center',
  //         type: 'Link',
  //       },
  //       {
  //         id: 'accountSettings',
  //         text: 'Account Settings',
  //         href: '/portal/account/me',
  //         type: 'Link',
  //       },
  //     ],
  //   },
  //   {
  //     id: 'separator1',
  //     type: 'Separator',
  //   },
  //   {
  //     id: 'theme',
  //     text: 'Theme',
  //     type: 'Theme',
  //   },
  //   {
  //     id: 'separator2',
  //     type: 'Separator',
  //   },
  //   {
  //     id: 'homePage',
  //     text: 'Home Page',
  //     href: '/',
  //     type: 'Link',
  //   },
  //   {
  //     id: 'logOut',
  //     text: 'Log out',
  //     type: 'LogOut',
  //   },
  // ] satisfies MenuItem[];

  if (!member) return null;

  const image = member?.avatar ?? "";
  const displayName = member?.name ?? "";
  const email = member?.email ?? "";

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="relative">
            <Avatar className="rounded-full shadow-sm h-8 w-8">
              <AvatarImage src={image} alt={`@${displayName}`} />
              <AvatarFallback asChild>
                <RandomAvatar name={displayName} />
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 text-[9px] w-3.5 h-3.5 text-center rounded-sm bg-primary/80">
              {displayName.toUpperCase().slice(0, 1)}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>
            <p className="font-bold text-sm flex justify-between">
              {displayName}
              <Badge
                className="ml-1 text-xs text-muted-foreground"
                variant="outline"
              >
                {role}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {menu.map((item) => {
            if (item.type === "Group") {
              return (
                <DropdownMenuGroup key={item.id}>
                  {item.group?.map((subItem) => (
                    <Link key={subItem.id} href={subItem.href ?? ""}>
                      <DropdownMenuItem>{subItem.text}</DropdownMenuItem>
                    </Link>
                  ))}
                </DropdownMenuGroup>
              );
            }

            if (item.type === "Link") {
              return (
                <Link key={item.id} href={item.href ?? ""}>
                  <DropdownMenuItem>{item.text}</DropdownMenuItem>
                </Link>
              );
            }

            if (item.type === "Separator") {
              return <DropdownMenuSeparator key={item.id} />;
            }

            if (item.type === "Theme") {
              return (
                <DropdownMenuItem key={item.id}>
                  {item.text}
                  <DropdownMenuShortcut>
                    <ThemeSwitcher />
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              );
            }

            if (item.type === "LogOut") {
              // DevLogin users should be redirected to /auth/login after logout
              const isDev = session?.user?.kind === "dev";
              const logoutPath = isDev ? "/auth/login" : "/auth/login";

              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => {
                    signOut({
                      callbackUrl: `${window.location.origin}${logoutPath}`,
                    });
                  }}
                >
                  {item.text}
                  <DropdownMenuShortcut>
                    <LogOut className="h-4 w-4" />
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              );
            }

            return null;
          })}

          {/* <DropdownMenuGroup>
            <Link href="/portal">
              <DropdownMenuItem>Dashboard</DropdownMenuItem>
            </Link>
            {isDeveloper && (
              <Link href="/portal/dev-center">
                <DropdownMenuItem>Dev Center</DropdownMenuItem>
              </Link>
            )}
            <Link href="/portal/account/me">
              <DropdownMenuItem>Account Settings</DropdownMenuItem>
            </Link>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            Theme
            <DropdownMenuShortcut>
              <ThemeSwitcher />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Link href="/">Home Page</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              signOut({
                callbackUrl: '/',
              });
            }}
          >
            Log out
            <DropdownMenuShortcut>
              <LogOut className="h-4 w-4" />
            </DropdownMenuShortcut>
          </DropdownMenuItem> */}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
