// Template sheet form (expo-mobile ticket 05): title, whole-Toman amount,
// day of month 1..31, category, mandatory start date, and optional end date
// — over the typed v1 client with invalidation of the template scopes (no
// restart). Web parity: templates-manager.tsx TemplateSheet (full payload on
// create and edit, one Persian failure voice, every field kept on error).
// Backfill and day-clamping stay server business; the description says so.

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  View,
} from "react-native";
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { T as Text } from "./app-text";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatJalali,
  formatToman,
  fromISODate,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";
import {
  FALLBACK_CATEGORY_COLOR,
  tintOf,
} from "@spend-tracker/shared/color";
import type { CategoryDto } from "@spend-tracker/shared/schemas/api";
import { useSession } from "../src/session";
import {
  TEMPLATE_MESSAGES,
  buildCreateTemplatePayload,
  buildUpdateTemplatePayload,
  createTemplate,
  saveTemplateUpdate,
  validateTemplateForm,
  type TemplateFormState,
  type TemplateLike,
} from "../src/templates";
import {
  affectedScopesForTemplateMutation,
  invalidateTemplateScopes,
} from "../src/template-queries";
import {
  formatAmountInput,
  normalizeAmountInput,
} from "../src/expense-sheet";
import { UniversalSheet } from "./universal-sheet";
import { INPUT_FONT_STYLE } from "./app-text";
import { JalaliDatePicker } from "./jalali-date-picker";

/** Jalali display of an ISO field, or the placeholder while empty/invalid. */
function displayDate(iso: string | null, placeholder: string): string {
  if (iso === null || iso === "") return placeholder;
  try {
    return formatJalali(fromISODate(iso), "d MMMM yyyy");
  } catch {
    return placeholder;
  }
}

export type TemplateSheetOpen =
  | { mode: "create" }
  | { mode: "edit"; template: TemplateLike };

export function TemplateSheetModal({
  open,
  categories,
  onClose,
}: {
  open: TemplateSheetOpen;
  categories: CategoryDto[];
  onClose: () => void;
}) {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const isEdit = open.mode === "edit";
  const source = isEdit ? open.template : null;

  const [form, setForm] = useState<TemplateFormState>({
    title: source?.title ?? "",
    amountRaw: source ? String(source.amountToman) : "",
    dayRaw: source ? String(source.dayOfMonth) : "",
    categoryId: source?.categoryId ?? categories[0]?.id ?? "",
    startDate: source?.startDate ?? "",
    endDate: source?.endDate ?? null,
  });
  const [endEnabled, setEndEnabled] = useState(source?.endDate != null);
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effective: TemplateFormState = {
    ...form,
    endDate: endEnabled ? form.endDate : null,
  };
  const checked = validateTemplateForm(effective);
  const canSave = checked.canSave && !pending;

  function set<K extends keyof TemplateFormState>(
    key: K,
    value: TemplateFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!canSave || pending) return;
    setPending(true);
    setError(null);
    try {
      if (source) {
        const payload = buildUpdateTemplatePayload(effective);
        if (!payload) return;
        await saveTemplateUpdate(api, source.id, effective);
      } else {
        const payload = buildCreateTemplatePayload(effective);
        if (!payload) return;
        await createTemplate(api, effective);
      }
      await invalidateTemplateScopes(
        queryClient,
        affectedScopesForTemplateMutation(),
      );
      onClose();
    } catch {
      setError(TEMPLATE_MESSAGES.saveFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <UniversalSheet
      open
      onClose={onClose}
      title={isEdit ? "ویرایش الگو" : "الگوی تکرار"}
      description={TEMPLATE_MESSAGES.sheetDescription}
    >
      <BottomSheetScrollView
        style={{ gap: 12, direction: "rtl" }}
        keyboardShouldPersistTaps="handled"
      >
        <SheetField label="عنوان">
          <BottomSheetTextInput
            value={form.title}
            onChangeText={(v) => set("title", v)}
            placeholder="مثلاً قسط وام"
            style={inputStyle}
          />
        </SheetField>

        <SheetField label="مبلغ (تومان)">
          <BottomSheetTextInput
            value={formatAmountInput(form.amountRaw)}
            onChangeText={(v) => set("amountRaw", normalizeAmountInput(v))}
            placeholder="به تومان"
            keyboardType="numeric"
            style={inputStyle}
          />
          {checked.amount !== null ? (
            <Text style={{ fontSize: 12, color: "#6b6259" }}>
              {formatToman(checked.amount)}
            </Text>
          ) : null}
        </SheetField>

        <SheetField label="روز ماه (۱ تا ۳۱)">
          <BottomSheetTextInput
            value={toPersianDigits(normalizeAmountInput(form.dayRaw))}
            onChangeText={(v) => set("dayRaw", normalizeAmountInput(v))}
            placeholder="مثلاً ۵"
            keyboardType="numeric"
            style={inputStyle}
          />
          {form.dayRaw !== "" && checked.day === null ? (
            <Text style={{ fontSize: 12, color: "#b3261e" }}>
              روز ماه باید بین ۱ تا ۳۱ باشد
            </Text>
          ) : null}
        </SheetField>

        <SheetField label="دسته">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map((c) => (
              <Pressable
                key={c.id}
                accessibilityLabel={c.name}
                onPress={() => set("categoryId", c.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: c.id === form.categoryId ? 2 : 1,
                  borderColor: c.id === form.categoryId ? "#1a7a5c" : "#d8d3c8",
                  // Every chip wears its own washed tint (web parity).
                  backgroundColor:
                    c.id === form.categoryId ? "#e4f0e9" : tintOf(c.color),
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
        </SheetField>

        <SheetField label="تاریخ شروع">
          <Pressable
            accessibilityLabel="انتخاب تاریخ شروع"
            accessibilityRole="button"
            onPress={() => setPicker("start")}
            style={[inputStyle, { justifyContent: "center" }]}
          >
            <Text style={{ fontSize: 15 }}>
              {displayDate(form.startDate, "انتخاب تاریخ")}
            </Text>
          </Pressable>
        </SheetField>

        <SheetField label="تاریخ پایان (اختیاری)">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityLabel="بدون پایان"
              onPress={() => setEndEnabled(false)}
              style={{
                paddingHorizontal: 14,
                justifyContent: "center",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: !endEnabled ? "#1a7a5c" : "#d8d3c8",
                backgroundColor: !endEnabled ? "#e4f0e9" : "#fff",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700" }}>بدون پایان</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="انتخاب تاریخ پایان"
              accessibilityRole="button"
              onPress={() => {
                setEndEnabled(true);
                setPicker("end");
              }}
              style={[inputStyle, { flex: 1, justifyContent: "center" }]}
            >
              <Text style={{ fontSize: 15 }}>
                {displayDate(form.endDate, "انتخاب تاریخ")}
              </Text>
            </Pressable>
          </View>
          {!checked.windowValid ? (
            <Text style={{ fontSize: 12, color: "#b3261e" }}>
              تاریخ پایان نباید قبل از شروع باشد
            </Text>
          ) : null}
        </SheetField>

        {picker !== null ? (
          <JalaliDatePicker
            value={picker === "start" ? form.startDate : (form.endDate ?? "")}
            onSelect={(iso) => {
              if (picker === "start") set("startDate", iso);
              else {
                setEndEnabled(true);
                set("endDate", iso);
              }
            }}
            onClose={() => setPicker(null)}
          />
        ) : null}

        {error ? (
          <Text accessibilityRole="alert" style={{ fontSize: 13, color: "#b3261e" }}>
            {error}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={onClose} style={ghostButton}>
            <Text>انصراف</Text>
          </Pressable>
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
      </BottomSheetScrollView>
    </UniversalSheet>
  );
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, marginBottom: 12 }}>
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

const ghostButton = {
  borderWidth: 1,
  borderColor: "#d8d3c8",
  borderRadius: 999,
  paddingHorizontal: 20,
  paddingVertical: 10,
  alignItems: "center",
} as const;
