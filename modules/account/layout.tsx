import { Layout } from "@heiso-io/bee/components/primitives/layout";
import type { UserAvatarMenuItem } from "@heiso-io/bee/components/primitives/user-avatar";
import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import type { Navigation } from "@heiso-io/bee/types/client";
import { getTranslations } from "next-intl/server";
import { getMyMembership } from "../portal/(dashboard)/_server/membership.service";
import { PermissionProvider } from "@heiso-io/bee/providers/permission";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const membership = await getMyMembership();
  const t = await getTranslations("member.layout");

  const navigation: Navigation = {
    rootPath: "/portal/account",
    items: [
      // Personal — settings for the current member
      [
        {
          id: "preferences",
          title: t("navigation.preferences"),
          path: "/me",
          icon: "user-round-cog",
        },
        {
          id: "Authentication",
          title: t("navigation.authentication"),
          path: "/authentication",
          icon: "shield-user",
        },
      ],
      // Team management — org-wide
      [
        {
          id: "team",
          title: t("navigation.team"),
          path: "/team",
          icon: "users-round",
        },
        {
          id: "role",
          title: t("navigation.role"),
          path: "/role",
          icon: "square-user-round",
        },
      ],
    ],
  };

  const userAvatarMenu = [
    {
      id: "user",
      type: "Group",
      group: [
        {
          id: "dashboard",
          text: t("userMenu.dashboard"),
          href: "/portal",
          type: "Link",
        },
        // {
        //   id: 'accountSettings',
        //   text: 'Account Settings',
        //   href: '/portal/account/me',
        //   type: 'Link',
        // },
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
      text: t("userMenu.logOut"),
      type: "LogOut",
    },
  ] satisfies UserAvatarMenuItem[];

  if (membership.kind === "dev") {
    userAvatarMenu[0].group?.push({
      id: "dev-center",
      text: t("userMenu.developer"),
      href: "/portal/dev-center",
      type: "Link",
    });
  }

  return (
    <PermissionProvider>
      <Layout
        breadcrumb={{
          items: [
            {
              title: t("breadcrumb.account"),
              link: "/portal/account",
            },
          ],
        }}
        navigation={navigation}
        menu={userAvatarMenu}
      >
        {children}
      </Layout>
    </PermissionProvider>
  );
}
