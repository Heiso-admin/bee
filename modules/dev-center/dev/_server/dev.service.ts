"use server";

/**
 * Dev 名單目前由 env `ALLOWED_DEV_EMAILS` 管（每個 host 自決，之後 hive 集中控制）。
 * 此 service 是給 dev-center UI 顯示 / CRUD 用，當前未實作（read-only 顯示 env）。
 */

type Staff = {
  memberId: string;
  role: string;
  createdAt: Date;
  user: { id: string; email: string; name: string; avatar: string | null };
};

async function getStaff(): Promise<Staff[]> {
  console.warn("[getStaff] not yet implemented (DB CRUD)");
  return [];
}

async function addStaff({ email }: { email: string }): Promise<{ memberId: string }> {
  console.warn("[addStaff] not yet implemented");
  throw new Error("addStaff: DB CRUD not implemented yet");
}

async function removeStaff({ id }: { id: string }): Promise<{ memberId: string }> {
  console.warn("[removeStaff] not yet implemented");
  throw new Error("removeStaff: DB CRUD not implemented yet");
}

export { getStaff, addStaff, removeStaff, type Staff };
