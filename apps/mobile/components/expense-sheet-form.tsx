// Expense sheet form (expo-mobile ticket 03): title, whole-Toman amount,
// quantity + unit (عدد / کیلو), mandatory occurrence date with the month
// always derived from it, category with the پیشنهاد badge, and optional
// event — over the typed v1 client with invalidation of the affected scopes
// (no restart). Delete asks inline confirm; ثبت و جدید keeps rapid entry
// open. Locked category/event entry points (drilldowns) render as facts.

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { T as Text } from "./app-text";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "../src/session";
import {
  EXPENSE_SHEET_MESSAGES,
  buildCreatePayload,
  buildUpdatePayload,
  createSheetFormState,
  effectiveMonthKey,
  fetchSuggestion,
  formatAmountInput,
  formatQuantityInput,
  normalizeAmountInput,
  normalizeQuantityInput,
  pickSheetCategory,
  repeatNoticeFor,
  resolveActiveCategoryId,
  saveSheetCreate,
  saveSheetUpdate,
  shouldShowSuggestionBadge,
  validateExpenseForm,
  type ExpenseFormState,
  type ExpenseUnit,
  type SheetOpen,
} from "../src/expense-sheet";
import {
  affectedScopesForExpenseSave,
  invalidateDashboardScopes,
} from "../src/queries";
import { saveErrorMessage } from "../src/server-errors";
import {
  formatJalali,
  fromISODate,
  jalaliMonthKeyLabel,
} from "@spend-tracker/shared/jalali";
import {
  FALLBACK_CATEGORY_COLOR,
  tintOf,
} from "@spend-tracker/shared/color";
import type {
  CategoryDto,
  ClassifyDto,
  EventDto,
} from "@spend-tracker/shared/schemas/api";
import { UniversalSheet } from "./universal-sheet";
import { INPUT_FONT_STYLE } from "./app-text";
import { JalaliDatePicker } from "./jalali-date-picker";

const FIELD_GAP = 12;

export function ExpenseSheetModal({
  open,
  monthKey,
  categories,
  events,
  onClose,
}: {
  open: SheetOpen;
  monthKey: string;
  categories: CategoryDto[];
  events: EventDto[];
  onClose: () => void;
}) {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const initial = useMemo(
    () => createSheetFormState(open, categories, monthKey),
    // Fresh mount per open (parent keys by mode+id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const isEdit = open.mode === "edit";
  const editRow = isEdit ? open.expense : null;
  const lockedCategoryId =
    open.mode === "create" ? open.lockedCategoryId : undefined;
  const lockedEventId =
    open.mode === "create" ? open.lockedEventId : undefined;

  const [form, setForm] = useState<ExpenseFormState>(initial.form);
  const [manual, setManual] = useState(initial.manual);
  const [pickedId, setPickedId] = useState<string | null>(initial.pickedId);
  const [suggestion, setSuggestion] = useState<ClassifyDto | null>(null);
  const [optsOpen, setOptsOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checked = validateExpenseForm(form);
  const activeCategoryId = resolveActiveCategoryId({
    manual,
    pickedId,
    suggestionCategoryId: suggestion?.categoryId ?? null,
    categories,
  });
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;
  const showBadge = shouldShowSuggestionBadge(manual) && suggestion !== null;
  const canSave =
    checked.canSave && activeCategoryId !== "" && !pending;
  const targetMonth = checked.dateValid
    ? jalaliMonthKeyLabel(effectiveMonthKey(form.occurredAt))
    : "—";
  const lockedCategory = lockedCategoryId
    ? (categories.find((c) => c.id === lockedCategoryId) ?? null)
    : null;
  const lockedEvent = lockedEventId
    ? (events.find((e) => e.id === lockedEventId) ?? null)
    : null;

  function set<K extends keyof ExpenseFormState>(key: K, value: ExpenseFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function lookupSuggestion() {
    if (manual) return;
    const answer = await fetchSuggestion(api, form.title);
    setSuggestion(answer);
  }

  async function refresh(previousOccurredAt: string | null, nextOccurredAt: string) {
    await invalidateDashboardScopes(
      queryClient,
      affectedScopesForExpenseSave({ previousOccurredAt, nextOccurredAt }),
    );
  }

  async function save() {
    if (!canSave || pending) return;
    setPending(true);
    setError(null);
    try {
      if (editRow) {
        const patch = buildUpdatePayload(form, { occurredAt: editRow.occurredAt });
        if (!patch) return;
        await saveSheetUpdate(api, editRow.id, {
          ...patch,
          categoryId: activeCategoryId,
          eventId: lockedEvent ? lockedEvent.id : form.eventId,
        });
        await refresh(editRow.occurredAt, form.occurredAt);
      } else {
        const payload = buildCreatePayload({
          ...form,
          categoryId: activeCategoryId,
          eventId: lockedEvent ? lockedEvent.id : form.eventId,
        });
        if (!payload) return;
        await saveSheetCreate(api, {
          ...form,
          categoryId: activeCategoryId,
          eventId: lockedEvent ? lockedEvent.id : form.eventId,
        });
        await refresh(null, form.occurredAt);
      }
      onClose();
    } catch (error) {
      setError(saveErrorMessage(error, EXPENSE_SHEET_MESSAGES.saveFailed));
    } finally {
      setPending(false);
    }
  }

  async function saveAndNew() {
    if (isEdit || !canSave || pending) return;
    setPending(true);
    setError(null);
    try {
      await saveSheetCreate(api, {
        ...form,
        categoryId: activeCategoryId,
        eventId: lockedEvent ? lockedEvent.id : form.eventId,
      });
      await refresh(null, form.occurredAt);
      const fresh = createSheetFormState(
        lockedCategoryId || lockedEventId
          ? {
              mode: "create",
              ...(lockedCategoryId ? { lockedCategoryId } : {}),
              ...(lockedEventId ? { lockedEventId } : {}),
            }
          : { mode: "create" },
        categories,
        monthKey,
      );
      setForm(fresh.form);
      setManual(fresh.manual);
      setPickedId(fresh.pickedId);
      setSuggestion(null);
      setOptsOpen(false);
      setError(null);
    } catch (error) {
      setError(saveErrorMessage(error, EXPENSE_SHEET_MESSAGES.saveFailed));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!editRow || pending) return;
    setPending(true);
    setError(null);
    try {
      await api.expenses.remove(editRow.id);
      await refresh(editRow.occurredAt, editRow.occurredAt);
      onClose();
    } catch {
      setError(EXPENSE_SHEET_MESSAGES.deleteFailed);
      setPending(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <UniversalSheet
      open
      onClose={onClose}
      title={isEdit ? "ویرایش خرج" : "ثبت خرج"}
      description={isEdit ? `ذخیره در ${targetMonth}` : `ثبت در ${targetMonth}`}
    >
      <ScrollView style={{ gap: FIELD_GAP, direction: "rtl" }}>
        <SheetField label="عنوان">
          <TextInput
            value={form.title}
            onChangeText={(v) => set("title", v)}
            onBlur={() => void lookupSuggestion()}
            placeholder="مثلاً نان و شیر"
            style={inputStyle}
          />
        </SheetField>

        <SheetField label="مبلغ (تومان)">
          <TextInput
            value={formatAmountInput(form.amountRaw)}
            onChangeText={(v) => set("amountRaw", normalizeAmountInput(v))}
            placeholder="به تومان"
            keyboardType="numeric"
            style={inputStyle}
          />
        </SheetField>

        <SheetField label="تعداد">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={formatQuantityInput(form.quantityRaw)}
              onChangeText={(v) => set("quantityRaw", normalizeQuantityInput(v))}
              placeholder="۱"
              keyboardType="decimal-pad"
              style={[inputStyle, { flex: 1 }]}
            />
            {(["piece", "kg"] as ExpenseUnit[]).map((unit) => (
              <Pressable
                key={unit}
                accessibilityLabel={unit === "piece" ? "عدد" : "کیلو"}
                onPress={() => set("unit", unit)}
                style={{
                  paddingHorizontal: 14,
                  justifyContent: "center",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: form.unit === unit ? "#1a7a5c" : "#d8d3c8",
                  backgroundColor: form.unit === unit ? "#e4f0e9" : "#fff",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700" }}>
                  {unit === "piece" ? "عدد" : "کیلو"}
                </Text>
              </Pressable>
            ))}
          </View>
          {!checked.quantityValid ? (
            <Text style={{ fontSize: 12, color: "#b3261e" }}>
              تعداد برای عدد باید صحیح باشد
            </Text>
          ) : null}
        </SheetField>

        <SheetField label="تاریخ وقوع">
          <Pressable
            accessibilityLabel="انتخاب تاریخ وقوع"
            accessibilityRole="button"
            onPress={() => setDatePickerOpen(true)}
            style={[inputStyle, { justifyContent: "center" }]}
          >
            <Text style={{ fontSize: 15 }}>
              {checked.dateValid
                ? formatJalali(fromISODate(form.occurredAt), "d MMMM yyyy")
                : "انتخاب تاریخ"}
            </Text>
          </Pressable>
          {!checked.dateValid ? (
            <Text style={{ fontSize: 12, color: "#b3261e" }}>
              تاریخ وقوع الزامی است
            </Text>
          ) : null}
        </SheetField>
        {datePickerOpen ? (
          <JalaliDatePicker
            value={form.occurredAt}
            onSelect={(iso) => set("occurredAt", iso)}
            onClose={() => setDatePickerOpen(false)}
          />
        ) : null}

        <SheetField label="دسته">
          {lockedCategory ? (
            <Text style={{ fontSize: 14, fontWeight: "700" }}>
              {lockedCategory.name} · دستهٔ این صفحه
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "700" }}>
                  {activeCategory?.name ?? "—"}
                </Text>
                {showBadge ? (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      backgroundColor: "#e4f0e9",
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    پیشنهاد
                  </Text>
                ) : null}
                <Pressable onPress={() => setOptsOpen((v) => !v)}>
                  <Text style={{ fontSize: 12.5, color: "#1a7a5c" }}>تغییر</Text>
                </Pressable>
              </View>
              {optsOpen ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {categories.map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityLabel={c.name}
                      onPress={() => {
                        const next = pickSheetCategory(c.id);
                        setManual(next.manual);
                        setPickedId(next.pickedId);
                        setForm((prev) => ({ ...prev, categoryId: c.id }));
                        setSuggestion(null);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: c.id === activeCategoryId ? 2 : 1,
                        borderColor: c.id === activeCategoryId ? "#1a7a5c" : "#d8d3c8",
                        // Every chip wears its own washed tint (web parity).
                        backgroundColor:
                          c.id === activeCategoryId ? "#e4f0e9" : tintOf(c.color),
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 4.5,
                            backgroundColor: c.color ?? FALLBACK_CATEGORY_COLOR,
                          }}
                        />
                        <Text style={{ fontSize: 13 }}>{c.name}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </SheetField>

        <SheetField label="رویداد">
          {lockedEvent ? (
            <Text style={{ fontSize: 14, fontWeight: "700" }}>
              {lockedEvent.title} · رویداد این صفحه
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                onPress={() => set("eventId", null)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: form.eventId === null ? "#1a7a5c" : "#d8d3c8",
                }}
              >
                <Text style={{ fontSize: 13 }}>بدون رویداد</Text>
              </Pressable>
              {events.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => set("eventId", e.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: form.eventId === e.id ? "#1a7a5c" : "#d8d3c8",
                    backgroundColor: form.eventId === e.id ? "#e4f0e9" : "#fff",
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{e.title}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </SheetField>

        {editRow && repeatNoticeFor(editRow) ? (
          <Text style={{ fontSize: 12, lineHeight: 22, color: "#6b6259" }}>
            {EXPENSE_SHEET_MESSAGES.fromTemplate}
          </Text>
        ) : null}

        {error ? (
          <Text accessibilityRole="alert" style={{ fontSize: 13, color: "#b3261e" }}>
            {error}
          </Text>
        ) : null}

        {confirmingDelete ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13.5 }}>{EXPENSE_SHEET_MESSAGES.deleteConfirm}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setConfirmingDelete(false)}
                style={ghostButton}
              >
                <Text>انصراف</Text>
              </Pressable>
              <Pressable
                onPress={() => void remove()}
                disabled={pending}
                style={[dangerButton, { opacity: pending ? 0.6 : 1 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>حذف</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {isEdit ? (
              <Pressable
                onPress={() => setConfirmingDelete(true)}
                style={[ghostButton, { borderColor: "#b3261e" }]}
              >
                <Text style={{ color: "#b3261e", fontWeight: "700" }}>حذف</Text>
              </Pressable>
            ) : null}
            {!isEdit ? (
              <Pressable
                onPress={() => void saveAndNew()}
                disabled={!canSave}
                style={[secondaryButton, { opacity: canSave ? 1 : 0.6 }]}
              >
                <Text style={{ color: "#1a7a5c", fontWeight: "800" }}>ثبت و جدید</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void save()}
              disabled={!canSave}
              style={[primaryButton, { opacity: canSave ? 1 : 0.6 }]}
            >
              {pending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {isEdit ? "ذخیره" : "ثبت"}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </UniversalSheet>
  );
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, marginBottom: FIELD_GAP }}>
      <Text style={{ fontSize: 13, fontWeight: "700" }}>{label}</Text>
      {children}
    </View>
  );
}

const inputStyle = {
  ...INPUT_FONT_STYLE,
  borderWidth: 1,
  borderColor: "#d8d3c8",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 16,
} as const;

const primaryButton = {
  backgroundColor: "#1a7a5c",
  borderRadius: 999,
  paddingHorizontal: 24,
  paddingVertical: 10,
  alignItems: "center",
} as const;

const secondaryButton = {
  borderWidth: 1,
  borderColor: "#1a7a5c",
  borderRadius: 999,
  paddingHorizontal: 20,
  paddingVertical: 10,
  alignItems: "center",
} as const;

const ghostButton = {
  borderWidth: 1,
  borderColor: "#d8d3c8",
  borderRadius: 999,
  paddingHorizontal: 20,
  paddingVertical: 10,
  alignItems: "center",
} as const;

const dangerButton = {
  backgroundColor: "#b3261e",
  borderRadius: 999,
  paddingHorizontal: 24,
  paddingVertical: 10,
  alignItems: "center",
} as const;
