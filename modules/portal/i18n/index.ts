import type { Locale } from "@heiso-io/bee/i18n/config";

export async function getDashboardMessages(locale: Locale) {
  const dashboard = (await import(`../(dashboard)/i18n/${locale}.json`))
    .default;

  const permission = (
    await import(`../../permission/i18n/${locale}.json`)
  ).default;

  return {
    ...dashboard,
    permission,
  };
}
