import { Layout } from "@heiso-io/bee/components/primitives/layout";
import type { UserAvatarMenuItem } from "@heiso-io/bee/components/primitives/user-avatar";
import { LayoutSkeleton } from "@heiso-io/bee/components/skeleton";
import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { PermissionProvider } from "@heiso-io/bee/providers/permission";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getMyMembership, getMyAllowedMenuIds } from "./_server/membership.service";
import { buildDashboardNavigation } from "./dashboard-config";
import type { DashboardMenu } from "@heiso-io/bee/modules/portal/(dashboard)/dashboard-config";

interface OrgLayoutProps {
  children: React.ReactNode;
  menus?: Record<string, DashboardMenu>;
}

export default async function OrgLayout({ children, menus }: OrgLayoutProps) {
  // Authentication check
  const session = await auth();
  if (!session?.user) return null;

  // Get organization data
  return (
    <Suspense fallback={<LayoutSkeleton />}>
      <OrgLayoutWrap menus={menus}>{children}</OrgLayoutWrap>
    </Suspense>
  );
}

async function OrgLayoutWrap({
  children,
  menus
}: {
  children: React.ReactNode;
  menus?: Record<string, DashboardMenu>;
}) {
  // Get user membership and permissions
  const membership = await getMyMembership();

  // Zombie Session Check: If no membership record found, force signout
  // This handles cases where DB is reset but Browser Cookie remains.
  // if (!membership.id) {
  //   const { headers } = await import("next/headers");
  //   const { redirect } = await import("next/navigation");
  //   const h = await headers();
  //   const host = h.get("x-forwarded-host") || h.get("host");
  //   const proto = h.get("x-forwarded-proto") || "http";
  //   const callbackUrl = `${proto}://${host}/login`;
  //   redirect(`/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  // }

  // // 若非開發者，且尚未加入（無 membership 或 status !== 'joined'），強制導向 Join 頁
  // if (!membership.staff && (!membership?.id || membership?.status !== 'joined')) {
  //   const cookieStore = await cookies();
  //   const joinToken = cookieStore.get('join-token');
  //   if (joinToken) {
  //     redirect(`/join?token=${joinToken.value}`);
  //   }
  //   redirect('/join');
  // }
  const isOwner =
    membership.kind === "dev" || membership.role === 'owner';

  // Get translations
  const t = await getTranslations("dashboard.userMenu");
  const tn = await getTranslations("dashboard.nav");

  // Build navigation menu from static config
  const allowedMenuIds = await getMyAllowedMenuIds({
    isOwner,
    roleId: membership?.roleId,
  });

  // Build navigation from static config, filtered by allowed IDs
  // Pass translation function for i18n support and optional custom menus
  const navigation = buildDashboardNavigation(
    allowedMenuIds,
    (key) => tn(key),
    menus
  );

  const userAvatarMenu = [
    {
      id: "user",
      type: "Group",
      group: [
        // {
        //   id: 'dashboard',
        //   text: t('dashboard'),
        //   href: '/portal',
        //   type: 'Link',
        // },
        {
          id: "accountSettings",
          text: t("accountSettings"),
          href: "/portal/account/me",
          type: "Link",
        },
      ],
    },
    // {
    //   id: 'separator1',
    //   type: 'Separator',
    // },
    // {
    //   id: 'theme',
    //   text: t('theme'),
    //   type: 'Theme',
    // },
    {
      id: "separator2",
      type: "Separator",
    },
    // {
    //   id: 'homePage',
    //   text: t('homePage'),
    //   href: '/',
    //   type: 'Link',
    // },
    {
      id: "logOut",
      text: t("logOut"),
      type: "LogOut",
    },
  ] satisfies UserAvatarMenuItem[];

  if (membership.kind === "dev") {
    userAvatarMenu[0].group?.push({
      id: "dev-center",
      text: t("developer"),
      href: "/portal/dev-center",
      type: "Link",
    });
  }

  return (
    <PermissionProvider>
      <Layout navigation={navigation} menu={userAvatarMenu}>
        {children}
      </Layout>
    </PermissionProvider>
  );
}
