// Typed domain errors (ticket 22): services never throw HTTP-shaped things —
// the ticket-25 handler translates `status`/`code` into problem+json
// (RFC 9457; ticket 12). Statuses: 404 unknown/foreign id, 400 invalid input,
// 409 the three domain conflicts below.

export class DomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "not found for this user") {
    super(404, "not_found", message);
  }
}

export class ValidationError extends DomainError {
  /** Zod issues (path/code/message) — the raw material for problem+json's
   * `errors` array at the handler (ticket 12/25); null for ad-hoc domain
   * validation that has no schema behind it. */
  readonly issues: unknown;

  constructor(message: string, issues?: unknown) {
    super(400, "validation_failed", message);
    this.issues = issues;
  }
}

/** Deleting a category that still has expenses — the app-layer replacement
 * for the FK libSQL ships without (research 09; ticket 12 fixes 409). */
export class CategoryInUseError extends DomainError {
  constructor(message = "category still has expenses") {
    super(409, "category_in_use", message);
  }
}

/** The six seeded categories are undeletable (ticket 05); renaming them is
 * free. */
export class SystemCategoryProtectedError extends DomainError {
  constructor(message = "system categories cannot be deleted") {
    super(409, "system_category_protected", message);
  }
}

/** Category names are unique per user (categories_user_name_unique). */
export class DuplicateCategoryNameError extends DomainError {
  constructor(message = "a category with this name already exists") {
    super(409, "duplicate_category_name", message);
  }
}
