import type { TRole } from "@heiso-io/bee/lib/db/schema";

export enum MemberStatus {
  Invited = "invited",
  Active = "active",
  Inactive = "inactive",
  Suspended = "suspended",
}

/**
 * 成員 profile 基本資料（用於 Member.profile）
 */
export interface MemberProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  active: boolean;
  lastLoginAt: Date | null;
}

/**
 * 成員類型（整合 profile 與角色資訊）
 *
 * 此類型用於團隊成員列表 UI
 * 資料來自 Tenant DB members 表
 */
export interface Member {
  id: string;
  memberId: string;
  roleId: string | null;
  role: "owner" | "admin" | "member";
  status: "invited" | "active" | "inactive" | "suspended";
  inviteToken: string | null;
  inviteExpiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  profile: MemberProfile;
  customRole: TRole | null;
}
