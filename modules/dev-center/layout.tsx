import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { Suspense } from "react";
import { LayoutSkeleton } from "@heiso-io/bee/components/skeleton";
import { Layout } from "@heiso-io/bee/components/primitives/layout";
import type { UserAvatarMenuItem } from "@heiso-io/bee/components/primitives/user-avatar";
import type { Navigation } from "@heiso-io/bee/types/client";
import { getTranslations } from "next-intl/server";
import { PermissionProvider } from "@heiso-io/bee/providers/permission";

const nav: Navigation = {
  rootPath: "/portal/dev-center",
  items: [
    // {
    //   id: 'Overview',
    //   title: 'Overview',
    //   path: '',
    //   icon: 'home',
    // },
    [
      {
        id: "Portal Setting",
        title: "Portal Setting",
        path: "/portal-setting",
        icon: "settings",
      },
      {
        id: "Permission",
        title: "Permission",
        path: "/permission",
        icon: "user-lock",
      },
      {
        id: "Role",
        title: "Role",
        path: "/role",
        icon: "square-user-round",
      },
    ],
    [
      {
        id: "API Keys",
        title: "API Keys",
        path: `/api-keys`,
        icon: "globe-lock",
      },
      {
        id: "Keys",
        title: "Keys",
        path: "/key",
        icon: "key",
      },
      {
        id: "API docs",
        title: "API Docs",
        path: "/../../swagger/api",
        icon: "book-text",
      },
    ],
    [
      {
        id: "AI Usage",
        title: "AI Usage",
        path: `/ai/usage`,
        icon: "chart-line",
      },
    ],
    [
      {
        id: "Developers",
        title: "Developers",
        path: "/dev",
        icon: "user-round-plus",
      },
    ],
  ],
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isDev = session?.user?.kind === "dev";

  const t = await getTranslations("devCenter.userMenu");

  const userAvatarMenu = [
    {
      id: "user",
      type: "Group",
      group: [
        {
          id: "dashboard",
          text: t("dashboard"),
          href: "/portal",
          type: "Link",
        },
        {
          id: "accountSettings",
          text: t("accountSettings"),
          href: "/portal/account/me",
          type: "Link",
        },
      ],
    },
    {
      id: "separator1",
      type: "Separator",
    },
    // {
    //   id: 'theme',
    //   text: 'Theme',
    //   type: 'Theme',
    // },
    // {
    //   id: 'separator2',
    //   type: 'Separator',
    // },
    // {
    //   id: 'homePage',
    //   text: 'Home Page',
    //   href: '/',
    //   type: 'Link',
    // },
    {
      id: "logOut",
      text: t("logOut"),
      type: "LogOut",
    },
  ] satisfies UserAvatarMenuItem[];

  if (isDev) {
    userAvatarMenu[0].group?.push({
      id: "dev-center",
      text: t("developer"),
      href: "/portal/dev-center",
      type: "Link",
    });
  }

  return (
    <Suspense
      fallback={<LayoutSkeleton />}
    >
      <PermissionProvider>
        <Layout
          breadcrumb={{
            items: [
              {
                title: "Dev Center",
              },
            ],
          }}
          navigation={isDev ? nav : undefined}
          menu={userAvatarMenu}
        >
          {!isDev ? (
            <div className="h-full flex items-center justify-center">
              Only admin can access this area
            </div>
          ) : (
            children
          )}
        </Layout>
      </PermissionProvider>
    </Suspense>
  );
}
