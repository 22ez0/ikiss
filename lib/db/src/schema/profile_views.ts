import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const profileViewsTable = pgTable("profile_views", {
  id: serial("id").primaryKey(),
  profileUserId: integer("profile_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  country: text("country"),
  device: text("device"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("profile_views_user_id_idx").on(t.profileUserId),
  index("profile_views_viewed_at_idx").on(t.viewedAt),
]);

export type ProfileView = typeof profileViewsTable.$inferSelect;
