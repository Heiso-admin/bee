import config from "@heiso-io/bee/config";

/**
 * Default welcome page for fresh xxx-bee bootstrap.
 *
 * Consumer 用 `export { default } from "@heiso-io/bee/modules/welcome/page"` 一行接上,
 * 之後想客製就直接複製過來改成自己的內容。
 */
export default function WelcomePage() {
  return (
    <div className="container mx-auto p-6 md:p-10 max-w-6xl space-y-12">
      {/* Hero */}
      <div className="rounded-xl border bg-card p-8 md:p-12">
        <div className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
          {config.site.name} · welcome
        </div>
        <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight">
          Your portal, already wired.
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-2xl">
          Auth、RBAC、dashboard、dev-center 都活著。
          這頁是介紹,你可以直接從 sidebar 開始用。
        </p>
      </div>

      {/* Live now */}
      <section>
        <SectionHeader tag="Live now" title="What's already running" />
        <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card n="01" title="Auth & Sessions" desc="next-auth + 2FA + OTP + dev-login。你登入用的就是這個。" />
          <Card n="02" title="RBAC + Permissions" desc="Role / membership / permission gate。決定 sidebar 顯示什麼。" />
          <Card n="03" title="Dashboard Chrome" desc="Sidebar / Header / User menu / Theme toggle。你正在用。" />
          <Card n="04" title="Dev Center" desc="Staff / portal config / API keys / system settings。User menu 有 link。" />
          <Card n="05" title="Email Pipeline" desc="Resend + 2FA / verification / invitation。OTP email working。" />
          <Card n="06" title="i18n Native" desc="next-intl 接好,zh-TW / zh-CN / en 隨切。" />
        </div>
      </section>

      {/* Extend */}
      <section>
        <SectionHeader tag="Extend" title="Make it yours" />
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          上面那些都是 bee 包好的。要加 service 自己的功能,動下面 5 個地方。
        </p>
        <ol className="mt-6 rounded-xl border bg-card divide-y">
          <Step n="01" title="Branding" file=".env.local" desc="NEXT_PUBLIC_SITE_NAME · NEXT_PUBLIC_ORGANIZATION · NEXT_PUBLIC_LOGO_URL" />
          <Step n="02" title="Menus" file="config/menus.ts" desc="加 dashboard menu items,對應路徑要存在。" />
          <Step n="03" title="Pages" file="app/portal/(main)/<feature>/page.tsx" desc="每個 menu 對應一個 page,寫你的業務邏輯。" />
          <Step n="04" title="Translations" file="app/portal/_messages/*.json" desc="補 menu nav 顯示名 + 自訂頁文字。" />
          <Step n="05" title="Replace this" file="app/portal/(main)/welcome/page.tsx" desc="把 re-export 換成你自己的內容,或從 menus 拿掉。" />
        </ol>
      </section>

      {/* Stack */}
      <section>
        <SectionHeader tag="Stack" title="Built on" />
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Next.js", "16.2"],
            ["React", "19.2"],
            ["Tailwind", "4.x"],
            ["Drizzle", "ORM"],
            ["next-auth", "5"],
            ["next-intl", "4.x"],
            ["bun", "1.3"],
            ["Vercel", "Edge"],
          ].map(([pkg, ver]) => (
            <div
              key={pkg}
              className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="text-sm font-semibold">{pkg}</div>
              <div className="mt-0.5 text-xs text-muted-foreground font-mono">{ver}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="rounded-xl border bg-muted/30 p-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-muted-foreground">深入閱讀:</span>{" "}
          <code className="text-xs px-1.5 py-0.5 rounded bg-background border">
            node_modules/@heiso-io/bee/playbook.md
          </code>
        </div>
        <p className="text-xs text-muted-foreground">{config.site.copyright}</p>
      </div>
    </div>
  );
}

function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div>
      <div className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
        {tag}
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function Card({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition-all">
      <div className="text-xs font-mono text-muted-foreground">{n}</div>
      <h3 className="mt-3 font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({
  n,
  title,
  file,
  desc,
}: {
  n: string;
  title: string;
  file: string;
  desc: string;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-5 p-5">
      <div className="text-sm font-mono text-muted-foreground pt-0.5">{n}</div>
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <code className="text-xs text-muted-foreground font-mono">{file}</code>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </li>
  );
}
