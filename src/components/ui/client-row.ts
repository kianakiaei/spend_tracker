import type { CategoryDto, RecurringTemplateDto } from "@/lib/schemas";
import type { Category, RecurringTemplate } from "@/lib/services";

// The client edge of the typed v1 client (tickets 22/28): handlers answer
// with DTO rows whose timestamps are ISO strings, while the UI keeps the
// service's Date shape. One converter per row kind, used by every manager
// that keeps server rows in state between refreshes.

export function toCategoryRow(dto: CategoryDto): Category {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function toTemplateRow(dto: RecurringTemplateDto): RecurringTemplate {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
