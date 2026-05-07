import config from "@heiso-io/bee/config";

/**
 * Default welcome page for fresh xxx-bee bootstrap.
 * Black/white alternating sections.
 */
export default function WelcomePage() {
  return (
    <div className="-m-4 md:-m-6">
      {/* Hero — BLACK */}
      <section className="bg-black text-white">
        <div className="container mx-auto px-8 py-24 md:py-32 max-w-6xl">
          <Tag tone="dark">{config.site.name} · portal ready</Tag>
          <h1 className="mt-10 text-6xl md:text-8xl font-bold tracking-[-0.04em] leading-[0.9]">
            Your portal,
            <br />
            already wired.
          </h1>
          <p className="mt-10 text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed">
            Auth、RBAC、dashboard、dev-center 都活著。這頁是介紹,你可以直接從 sidebar 開始用。
          </p>
        </div>
      </section>

      {/* Live now — WHITE */}
      <section className="bg-white text-black">
        <div className="container mx-auto px-8 py-24 md:py-32 max-w-6xl">
          <Tag tone="light">Live now</Tag>
          <h2 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight max-w-3xl">
            What&apos;s already running.
          </h2>
          <div className="mt-16 grid md:grid-cols-2 gap-x-16 gap-y-12">
            <Item n="01" title="Auth & Sessions" desc="next-auth + 2FA + OTP + dev-login。你登入用的就是這個。" tone="light" />
            <Item n="02" title="RBAC + Permissions" desc="Role / membership / permission gate。決定 sidebar 顯示什麼。" tone="light" />
            <Item n="03" title="Dashboard Chrome" desc="Sidebar / Header / User menu / Theme toggle。你正在用。" tone="light" />
            <Item n="04" title="Dev Center" desc="Staff / portal config / API keys / system settings。User menu 有 link。" tone="light" />
            <Item n="05" title="Email Pipeline" desc="Resend + 2FA / verification / invitation。OTP email working。" tone="light" />
            <Item n="06" title="i18n Native" desc="next-intl 接好,zh-TW / zh-CN / en 隨切。" tone="light" />
          </div>
        </div>
      </section>

      {/* Extend — BLACK */}
      <section className="bg-black text-white">
        <div className="container mx-auto px-8 py-24 md:py-32 max-w-4xl">
          <Tag tone="dark">Extend</Tag>
          <h2 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight">Make it yours.</h2>
          <p className="mt-6 text-lg text-white/70 max-w-2xl leading-relaxed">
            上面那些 bee 都包好了。要加 service 自己的功能,動下面 5 個地方。
          </p>
          <ol className="mt-16 space-y-0">
            <Step n="01" title="Branding" file=".env.local" desc="NEXT_PUBLIC_SITE_NAME · NEXT_PUBLIC_ORGANIZATION · NEXT_PUBLIC_LOGO_URL" />
            <Step n="02" title="Menus" file="config/menus.ts" desc="加 dashboard menu items,對應路徑要存在。" />
            <Step n="03" title="Pages" file="app/portal/(main)/<feature>/page.tsx" desc="每個 menu 對應一個 page,寫你的業務邏輯。" />
            <Step n="04" title="Translations" file="app/portal/i18n/*.json" desc="補 menu nav 顯示名 + 自訂頁文字。" />
            <Step n="05" title="Replace this" file="app/portal/(main)/welcome/page.tsx" desc="把 re-export 換成你自己的內容,或從 menus 拿掉。" last />
          </ol>
        </div>
      </section>

      {/* Stack — WHITE */}
      <section className="bg-white text-black">
        <div className="container mx-auto px-8 py-24 max-w-6xl">
          <Tag tone="light">Stack</Tag>
          <h2 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">Built on.</h2>
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 border-t border-l border-black">
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
                className="border-r border-b border-black p-5 hover:bg-black hover:text-white transition-colors"
              >
                <div className="text-lg font-semibold tracking-tight">{pkg}</div>
                <div className="mt-1 text-xs font-mono opacity-50">{ver}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer — BLACK */}
      <section className="bg-black text-white">
        <div className="container mx-auto px-8 py-12 max-w-6xl flex flex-wrap items-end justify-between gap-6">
          <div>
            <Tag tone="dark">Reference</Tag>
            <code className="block mt-3 px-3 py-1.5 border border-white/20 text-sm font-mono w-fit">
              node_modules/@heiso-io/bee/playbook.md
            </code>
          </div>
          <p className="text-xs text-white/40">{config.site.copyright}</p>
        </div>
      </section>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "light" | "dark" }) {
  const text = tone === "dark" ? "text-white/50" : "text-black/50";
  const line = tone === "dark" ? "bg-white/30" : "bg-black/30";
  return (
    <div className={`inline-flex items-center gap-2 text-xs tracking-[0.25em] uppercase ${text}`}>
      <div className={`h-px w-8 ${line}`} />
      {children}
    </div>
  );
}

function Item({
  n,
  title,
  desc,
  tone,
}: {
  n: string;
  title: string;
  desc: string;
  tone: "light" | "dark";
}) {
  const muted = tone === "light" ? "text-black/60" : "text-white/60";
  return (
    <div>
      <div className={`text-xs font-mono ${muted}`}>{n}</div>
      <h3 className="mt-3 text-2xl font-bold tracking-tight">{title}</h3>
      <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{desc}</p>
    </div>
  );
}

function Step({
  n,
  title,
  file,
  desc,
  last,
}: {
  n: string;
  title: string;
  file: string;
  desc: string;
  last?: boolean;
}) {
  return (
    <li className={`grid grid-cols-[auto_1fr] gap-8 py-7 ${last ? "" : "border-b border-white/15"}`}>
      <div className="text-sm font-mono text-white/40 pt-1">{n}</div>
      <div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-xl font-bold tracking-tight">{title}</h3>
          <code className="text-xs text-white/50 font-mono">{file}</code>
        </div>
        <p className="mt-2 text-sm text-white/60 leading-relaxed">{desc}</p>
      </div>
    </li>
  );
}
