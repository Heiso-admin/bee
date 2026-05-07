import { getTranslations } from "next-intl/server";
import { ALLOWED_DEV_EMAILS } from "@heiso-io/bee/modules/auth/auth.config";

export default async function DevPage() {
  return (
    <div className="flex w-full h-full bg-sub-background">
      <div className="main-section-item grow w-full overflow-hidden p-6 space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Dev 名單</h1>
          <p className="text-sm text-muted-foreground">
            由 host env <code className="text-xs px-1 py-0.5 rounded bg-muted">ALLOWED_DEV_EMAILS</code> 控制。
            修改方式：改 <code className="text-xs px-1 py-0.5 rounded bg-muted">.env.local</code> 或部署環境（Vercel / hive）後 restart。
          </p>
        </header>

        {ALLOWED_DEV_EMAILS.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            目前沒有 dev — 所有人都不能走 /auth/login
          </div>
        ) : (
          <ul className="rounded-md border divide-y bg-card">
            {ALLOWED_DEV_EMAILS.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-mono">{email}</span>
                <span className="text-xs text-muted-foreground">via env</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
