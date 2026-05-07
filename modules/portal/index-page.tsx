import { redirect } from "next/navigation";
import type { DashboardMenu } from "@heiso-io/bee/modules/portal/(dashboard)/dashboard-config";
import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { buildDashboardNavigation } from "@heiso-io/bee/modules/portal/(dashboard)/dashboard-config";
import {
  getMyAllowedMenuIds,
  getMyMembership,
} from "@heiso-io/bee/modules/portal/(dashboard)/_server/membership.service";

interface Props {
  menus: Record<string, DashboardMenu>;
  /** Where to send unauthenticated visitors. Default: /auth/login */
  loginPath?: string;
}

/**
 * Drop-in `/portal` index page.
 *
 * Host usage:
 * ```tsx
 * // app/portal/page.tsx
 * import { PortalIndexPage } from "@heiso-io/bee/modules/portal/index-page";
 * import { DASHBOARD_DEFAULT_MENUS } from "../../config/menus";
 * export default () => <PortalIndexPage menus={DASHBOARD_DEFAULT_MENUS} />;
 * ```
 *
 * Handles:
 * - auth gate (redirects to login if no session.user.id)
 * - membership + allowed-menu lookup
 * - server-side redirect to first accessible menu
 * - fallback UI for members with no menu permissions
 */
export async function PortalIndexPage({ menus, loginPath = "/auth/login" }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(loginPath);

  const m = await getMyMembership();
  const isOwner = m.kind === "dev" || m.role === "owner";
  const allowed = await getMyAllowedMenuIds({ isOwner, roleId: m?.roleId });
  const nav = buildDashboardNavigation(allowed, undefined, menus);
  const first = nav.items[0];
  const firstPath = Array.isArray(first) ? first[0]?.path : first?.path;

  if (firstPath) redirect(`/portal${firstPath}`);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-8">
      <h2 className="text-xl font-semibold">No accessible pages</h2>
      <p className="text-sm text-muted-foreground">
        Your account has no menu permissions. Contact an administrator.
      </p>
    </div>
  );
}

export default PortalIndexPage;
