import { relations } from "drizzle-orm";
import {
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type zod from "zod/v4";
import { generateId } from "@heiso-io/bee/lib/id-generator";
import { members } from "../../auth/members";

export const pageTemplates = pgTable(
  "page_templates",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$defaultFn(() => generateId()),
    memberId: varchar("member_id", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    pageId: varchar("page_id", { length: 20 }),
    thumbnail: varchar("thumbnail", { length: 255 }),
    htmlContent: json("html_content"),
    mobileContent: json("mobile_content"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("page_templates_member_id_idx").on(table.memberId),
    index("page_templates_page_id_idx").on(table.pageId),
  ],
);

export const posts = pgTable(
  "pages",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$defaultFn(() => generateId()),
    memberId: varchar("member_id", { length: 50 }).notNull(),
    // categoryId: varchar('category_id', { length: 20 }),
    slug: varchar("slug", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }),
    excerpt: text("excerpt"),
    featuredImage: varchar("featured_image", { length: 255 }),
    featuredVideo: varchar("featured_video", { length: 255 }),
    content: json("content"),
    html: text("html"),
    contentMobile: json("content_mobile"),
    htmlMobile: text("html_mobile"),
    updater: varchar("updater", { length: 50 }),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    isPublished: timestamp("is_published"),
    savedTemplateId: varchar("saved_template_id", { length: 20 }).references(
      () => pageTemplates.id,
    ),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("pages_member_id_idx").on(table.memberId),
    // index('pages_category_id_idx').on(table.categoryId),
    index("pages_slug_idx").on(table.slug),
    index("pages_status_idx").on(table.status),
  ],
);

export const pageCategories = pgTable(
  "page_categories",
  {
    id: varchar("id", { length: 20 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    memberId: varchar("member_id", { length: 50 }).notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("page_categories_member_id_idx").on(table.memberId)],
);

export const tags = pgTable(
  "tags",
  {
    id: varchar("id", { length: 200 }).notNull().primaryKey(),
    memberId: varchar("member_id", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    postCount: integer("post_count").default(0),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("tags_member_id_idx").on(table.memberId)],
);

export const pageCategoryRelations = pgTable(
  "page_category_relations",
  {
    postId: varchar("post_id")
      .notNull()
      .references(() => posts.id),
    categoryId: varchar("category_id")
      .notNull()
      .references(() => pageCategories.id),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.categoryId] }),
    index("page_category_relations_post_id_idx").on(table.postId),
    index("page_category_relations_category_id_idx").on(table.categoryId),
  ],
);

export const postRelations = relations(posts, ({ one, many }) => ({
  user: one(members, {
    fields: [posts.memberId],
    references: [members.id],
  }),
  categories: many(pageCategoryRelations),
}));

export const postPageCategoryRelations = relations(
  pageCategoryRelations,
  ({ one }) => ({
    post: one(posts, {
      fields: [pageCategoryRelations.postId],
      references: [posts.id],
    }),
    category: one(pageCategories, {
      fields: [pageCategoryRelations.categoryId],
      references: [pageCategories.id],
    }),
  }),
);

export const pageCategoriesRelations = relations(
  pageCategories,
  ({ one, many }) => ({
    user: one(members, {
      fields: [pageCategories.memberId],
      references: [members.id],
    }),
    posts: many(pageCategoryRelations),
  }),
);

export const tagRelations = relations(tags, ({ one, many }) => ({
  user: one(members, {
    fields: [tags.memberId],
    references: [members.id],
  }),
  posts: many(posts),
}));

export const postsSchema = createSelectSchema(posts);
export const postsInsertSchema = createInsertSchema(posts);
export const postsUpdateSchema = createUpdateSchema(posts);

export const pageTemplatesSchema = createSelectSchema(pageTemplates);

export const pageCategoriesSchema = createSelectSchema(pageCategories);
export const pageCategoriesInsertSchema = createInsertSchema(pageCategories);
export const pageCategoriesUpdateSchema = createUpdateSchema(pageCategories);

export const tagsSchema = createSelectSchema(tags);
export const tagsInsertSchema = createInsertSchema(tags);
export const tagsUpdateSchema = createUpdateSchema(tags);

export type TPost = zod.infer<typeof postsSchema>;
export type TPostInsert = zod.infer<typeof postsInsertSchema>;
export type TPostUpdate = zod.infer<typeof postsUpdateSchema>;

export type TPageCategory = zod.infer<typeof pageCategoriesSchema>;
export type TPageCategoryInsert = zod.infer<typeof pageCategoriesInsertSchema>;
export type TPageCategoryUpdate = zod.infer<typeof pageCategoriesUpdateSchema>;

export type TTag = zod.infer<typeof tagsSchema>;
export type TTagInsert = zod.infer<typeof tagsInsertSchema>;
export type TTagUpdate = zod.infer<typeof tagsUpdateSchema>;
