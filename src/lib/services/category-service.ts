import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { categories, expenses } from "@/db/schema";
import { newId } from "@/lib/id";
import { categoryNameSchema, uuidv7Schema } from "@/lib/schemas";
import {
  CategoryInUseError,
  DuplicateCategoryNameError,
  NotFoundError,
  SystemCategoryProtectedError,
  ValidationError,
} from "./errors";
import { parseOrThrow } from "./parse";
import type { Category, DomainDb } from "./types";

// Category service (ticket 22). Domain rules live here because libSQL ships
// with FK enforcement off (research 09): deleting a category that has
// expenses and deleting a system category are refused with 409-shaped domain
// errors; renaming (even a system category) is free. No `next/*` imports —
// the db arrives injected.

const createCategoryInputSchema = z.object({
  name: categoryNameSchema,
  color: z.string().nullish(),
  icon: z.string().nullish(),
});

const updateCategoryInputSchema = z.object({
  name: categoryNameSchema.optional(),
  color: z.string().nullish(),
  icon: z.string().nullish(),
});

const idSchema = uuidv7Schema;

export interface CreateCategoryInput {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

export interface CategoryService {
  /** All of the user's categories in display order (system seeds first, then
   * customs by creation). */
  list(userId: string): Promise<Category[]>;
  get(userId: string, id: string): Promise<Category>;
  create(userId: string, input: CreateCategoryInput): Promise<Category>;
  update(userId: string, id: string, input: UpdateCategoryInput): Promise<Category>;
  /** 409 if the category is a system one or still has expenses. */
  remove(userId: string, id: string): Promise<void>;
  /** Bulk move for the delete-category flow (ticket 05): every expense of
   * `sourceId` re-points to `targetId`. Learning does NOT fire here — it is
   * an expense save (create/update) behavior (ticket 06/22). */
  moveExpenses(
    userId: string,
    sourceId: string,
    targetId: string,
  ): Promise<{ moved: number }>;
}

/** Ownership guard shared with the other services: the row must exist and
 * belong to this user (404 otherwise) — the FK-less schema's stand-in. */
export async function getOwnedCategory(
  db: DomainDb,
  userId: string,
  id: string,
): Promise<Category> {
  parseOrThrow(idSchema, id, "category id");
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!category) throw new NotFoundError(`category ${id} not found`);
  return category;
}

export function createCategoryService(db: DomainDb): CategoryService {
  const getOwned = (userId: string, id: string) => getOwnedCategory(db, userId, id);

  async function assertNameFree(
    userId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.name, name)))
      .limit(1);
    if (row && row.id !== exceptId) {
      throw new DuplicateCategoryNameError(`name "${name}" is already in use`);
    }
  }

  return {
    async list(userId) {
      return db
        .select()
        .from(categories)
        .where(eq(categories.userId, userId))
        .orderBy(asc(categories.order), asc(categories.createdAt));
    },

    get(userId, id) {
      return getOwned(userId, id);
    },

    async create(userId, input) {
      const data = parseOrThrow(createCategoryInputSchema, input, "category input");
      await assertNameFree(userId, data.name);

      // Custom categories stack after everything the user already has
      // (system seeds occupy 0..5).
      const [{ maxOrder }] = await db
        .select({ maxOrder: max(categories.order) })
        .from(categories)
        .where(eq(categories.userId, userId));

      const now = new Date();
      const [category] = await db
        .insert(categories)
        .values({
          id: newId(),
          name: data.name,
          color: data.color ?? null,
          icon: data.icon ?? null,
          kind: "custom",
          order: (maxOrder ?? -1) + 1,
          slug: null,
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return category!;
    },

    async update(userId, id, input) {
      const data = parseOrThrow(updateCategoryInputSchema, input, "category input");
      const existing = await getOwned(userId, id);

      const set: {
        name?: string;
        color?: string | null;
        icon?: string | null;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (data.name !== undefined && data.name !== existing.name) {
        await assertNameFree(userId, data.name, id);
        set.name = data.name;
      }
      if (data.color !== undefined) set.color = data.color;
      if (data.icon !== undefined) set.icon = data.icon;

      const [category] = await db
        .update(categories)
        .set(set)
        .where(eq(categories.id, id))
        .returning();
      return category!;
    },

    async remove(userId, id) {
      const category = await getOwned(userId, id);

      if (category.kind === "system") {
        throw new SystemCategoryProtectedError(
          `"${category.name}" is a system category`,
        );
      }

      const [inUse] = await db
        .select({ id: expenses.id })
        .from(expenses)
        .where(
          and(eq(expenses.userId, userId), eq(expenses.categoryId, id)),
        )
        .limit(1);
      if (inUse) {
        throw new CategoryInUseError(
          `"${category.name}" still has expenses`,
        );
      }

      await db.delete(categories).where(eq(categories.id, id));
    },

    async moveExpenses(userId, sourceId, targetId) {
      const source = await getOwned(userId, sourceId);
      const target = await getOwned(userId, targetId);
      if (source.id === target.id) {
        throw new ValidationError("cannot move a category's expenses to itself");
      }

      const moved = await db
        .update(expenses)
        .set({ categoryId: target.id, updatedAt: new Date() })
        .where(and(eq(expenses.userId, userId), eq(expenses.categoryId, source.id)))
        .returning({ id: expenses.id });
      return { moved: moved.length };
    },
  };
}
