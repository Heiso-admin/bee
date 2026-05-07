import { generateId } from "@heiso-io/bee/lib/id-generator";
import {
  boolean,
  index,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { members } from "./members";

/**
 * memberPasswordReset - 密碼重設 token
 */
export const memberPasswordReset = pgTable(
  "member_password_reset",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$default(() => generateId()),
    memberId: varchar("member_id", { length: 50 })
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 100 }).notNull().unique(),
    used: boolean("used").default(false),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("member_password_reset_member_id_idx").on(table.memberId),
    index("member_password_reset_valid_idx").on(table.used, table.expiresAt),
    index("member_password_reset_token_idx").on(table.token),
  ],
);
