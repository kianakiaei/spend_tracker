import { db } from "@/db";
import { categories } from "@/db/schema";
import { SYSTEM_CATEGORIES, type SystemCategorySlug } from "@/lib/categorization/seed-lexicon";
import { newId } from "@/lib/id";

// Initial tile tint per system category (ticket 07: paper + ink + a jade
// accent on the most-used one). Like any category, the user can change it.
const SYSTEM_CATEGORY_COLORS: Record<SystemCategorySlug, string> = {
  groceries: "#2f9e6e",
  "cafe-restaurant": "#c47a3d",
  transport: "#3d7fc4",
  "health-beauty": "#c4559b",
  installment: "#7a5fc4",
  "bills-internet": "#3da3c4",
};

/** Seeds the six system categories for a brand-new user, slugs included.
 * One INSERT statement, so it lands all-or-nothing; the (userId, name)
 * unique index makes a re-run a no-op. */
export async function seedSystemCategories(userId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(categories)
    .values(
      SYSTEM_CATEGORIES.map((category, index) => ({
        id: newId(),
        name: category.name,
        color: SYSTEM_CATEGORY_COLORS[category.slug],
        kind: "system" as const,
        order: index,
        slug: category.slug,
        userId,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({ target: [categories.userId, categories.name] });
}
