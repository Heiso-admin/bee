import { generateId } from "@heiso-io/bee/lib/id-generator";
import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { members } from "./members";

/**
 * member2faCode — 一個 member 同時只能有一筆有效 OTP。
 * Resend = upsert（覆蓋舊 code）。Verify 成功 = DELETE row（一次性）。
 * 沒 `used` flag — row 在 = pending、row 沒了 = no OTP。
 */
export const member2faCode = pgTable(
  "member_2fa_code",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$default(() => generateId()),
    memberId: varchar("member_id", { length: 50 })
      .notNull()
      .unique()
      .references(() => members.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("member_2fa_code_expires_at_idx").on(table.expiresAt)],
);
