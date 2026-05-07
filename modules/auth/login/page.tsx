import config from "@heiso-io/bee/config";
import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { hasAnyUser } from "@heiso-io/bee/server/services/auth";
import { getSystemSettings } from "@heiso-io/bee/server/services/system/setting";
import { getPortalSetting } from "@heiso-io/bee/server/site.service";
import { redirect } from "next/navigation";
import { Login } from "../_components";
import InitializeTenantForm from "../_components/InitializeTenantForm";
import {
  checkTenantHasOwner,
  ensureMemberOnFirstLogin,
  getMember,
  getMemberByEmail,
} from "../_server/user.service";
import { seedDefaults } from "@heiso-io/bee/modules/system/provisioning";
import { db } from "@heiso-io/bee/lib/db";

export type OAuthDataType = {
  userId: string | null;
  email: string | null;
  status: string | null;
};
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ join?: string; relogin?: string; error?: string }>;
}) {
  /* 
   * Only check for owner if we are in a tenant context.
   * On Root Domain (x-tenant-id missing), we show standard login.
   */
  const { getTenantId } = await import("@heiso-io/bee/lib/utils/tenant");
  const tenantId = await getTenantId();

  if (tenantId) {
    let hasOwner = false;
    let needsProvisioning = false;

    try {
      hasOwner = await checkTenantHasOwner();
      // If table exists but no owner, it might mean partial initialization or just new tenant.
      // We should arguably run provisioning here too to ensure menus/defaults exist.
      if (!hasOwner) {
        needsProvisioning = true;
      }
    } catch (e: any) {
      // 42P01: undefined table (Schema missing)
      if (e.code === "42P01") {
        needsProvisioning = true;
      } else {
        throw e;
      }
    }

    if (needsProvisioning) {
      console.warn("[Login] Tenant uninitialized. Seeding defaults locally...");
      await seedDefaults(db, [], tenantId);
    }

    // Re-check owner status after provisioning
    if (!hasOwner) {
      return (
        <div className="w-full max-w-md space-y-10">
          <InitializeTenantForm />
        </div>
      );
    }
  }

  const anyUser = await hasAnyUser();
  const general = await getSystemSettings();
  const site = await getPortalSetting();
  const orgName =
    (site as any)?.branding?.organization || config?.site?.organization;

  const session = await auth(); // oAuth 登入
  let email = "";
  let oAuthData: OAuthDataType | undefined;

  // 使用 oAuth 有可能會遇到第三方不願意給 email
  const { relogin, error } = (await searchParams) ?? {};
  const isRelogin = !!relogin;
  if (session?.user && !isRelogin) {
    const userId = session.user.id ?? undefined;
    const sessionEmail = session.user.email ?? undefined;

    // dev: skip zombie check, redirect to dashboard
    if (session.user.kind === "dev") {
      redirect("/portal");
    }

    // Fix: Verify if user really exists in DB (Zombie Session Check)
    if (sessionEmail) {
      const dbUser = await getMemberByEmail(sessionEmail);
      if (!dbUser) {
        // User in session but not in DB. Force logout.
        redirect("/api/auth/signout");
      }
    }

    const member = userId ? await getMember(userId) : null;

    if (member) {
      oAuthData = {
        userId: member.memberId,
        email: session.user.email ?? null,
        status: member.status,
      };
      // 已加入：直接進 Dashboard
      if (member.status === "active") {
        redirect("/portal");
      }

      // 非 active：如無錯誤參數才導向 Pending；有錯誤時留在 login 顯示錯誤
      if (!error) {
        redirect(`/pending?error=${error}`);
      }
    } else {
      // 無成員紀錄：第一次登入，建立/刷新 member 並設為 review，不寄送 email
      if (sessionEmail && userId) {
        try {
          await ensureMemberOnFirstLogin(userId);
          const refreshed = await getMember(userId);
          if (refreshed) {
            oAuthData = {
              userId: refreshed.memberId,
              email: sessionEmail,
              status: refreshed.status,
            };
          }
          email = sessionEmail;
        } catch {
          email = sessionEmail;
        }
      }
    }
  }

  return (
    <div className="w-full max-w-md space-y-10">
      <Login
        email={email}
        anyUser={anyUser}
        orgName={orgName}
        oAuthData={oAuthData}
        systemOauth={general.system_oauth as string}
      />
    </div>
  );
}
