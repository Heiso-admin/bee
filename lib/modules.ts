/**
 * Static catalog of bee/host modules used for RBAC `roles.allowed_modules` config.
 *
 * 之後會跟 packages/bee/modules/registry.ts 整合（runtime register），
 * 現階段先寫死，admin UI 才有東西可選。
 */
export type ModuleEntry = {
  id: string;
  label: string;
  description: string;
};

export const MODULES: ModuleEntry[] = [
  {
    id: "cms",
    label: "CMS",
    description: "Articles, pages, navigation, newsletters",
  },
  {
    id: "editor",
    label: "Editor",
    description: "Block-based content editor (V2)",
  },
  {
    id: "account",
    label: "Account & Team",
    description: "Personal preferences, team members, role management",
  },
  {
    id: "system",
    label: "System Settings",
    description: "Portal branding, language, OAuth, security policies",
  },
];

export function getModule(id: string): ModuleEntry | undefined {
  return MODULES.find((m) => m.id === id);
}
