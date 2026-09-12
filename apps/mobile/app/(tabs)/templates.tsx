// Templates surface (expo-mobile ticket 05): the recurring list with
// pause/resume, the «خرج این ماه تولید شد» jump into the generated expense's
// edit sheet, the three-month future preview with clamped days, and the
// Template bottom sheet for create/edit. Reads go through the typed v1
// client (the frozen API); every mutation invalidates the template and
// dashboard scopes (no restart). Web parity: templates/page.tsx + manager
// island. The jump opens the generated خرج inline (mobile has no
// cross-screen ?expense= deep-link) — same destination, one tap.

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { T as Text } from "../../components/app-text";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  currentJalaliMonthKey,
  jalaliMonthNameFromKey,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";
import { formatNumber } from "@spend-tracker/shared/format";
import type {
  CategoryDto,
  EventDto,
  ExpenseDto,
  ForecastRowDto,
  RecurringTemplateDto,
} from "@spend-tracker/shared/schemas/api";
import { useFocusEffect } from "expo-router";
import { useSession } from "../../src/session";
import { setLastTabLabel } from "../../src/last-tab";
import {
  TEMPLATE_MESSAGES,
  buildGeneratedThisMonth,
  buildTemplateListViewModel,
  buildTemplatePreviewSections,
  pauseLabelFor,
  rhythmLabelFor,
  toggleTemplateActive,
  type TemplateRow,
} from "../../src/templates";
import {
  affectedScopesForTemplateMutation,
  invalidateTemplateScopes,
  loadTemplatesScreen,
  templatesKey,
  type TemplatePreviewMonth,
} from "../../src/template-queries";
import type { SheetExpenseRef, SheetOpen } from "../../src/expense-sheet";
import { ExpenseSheetModal } from "../../components/expense-sheet-form";
import {
  TemplateSheetModal,
  type TemplateSheetOpen,
} from "../../components/template-sheet-form";

interface TemplatesScreenData {
  templates: RecurringTemplateDto[];
  categories: CategoryDto[];
  expenses: ExpenseDto[];
  events: EventDto[];
  previews: TemplatePreviewMonth[];
}

export default function TemplatesScreen() {
  const { api } = useSession();
  // Origin tracking for truthful back titles (ticket 18).
  useFocusEffect(
    useCallback(() => {
      setLastTabLabel("الگوها");
    }, []),
  );
  const queryClient = useQueryClient();
  const [currentMonthKey] = useState(() => currentJalaliMonthKey());
  const [sheet, setSheet] = useState<TemplateSheetOpen | null>(null);
  const [expenseSheet, setExpenseSheet] = useState<SheetOpen | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const screen = useQuery({
    queryKey: [...templatesKey(), currentMonthKey],
    queryFn: () =>
      loadTemplatesScreen(api, currentMonthKey) as Promise<TemplatesScreenData>,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    await invalidateTemplateScopes(
      queryClient,
      affectedScopesForTemplateMutation(),
    );
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await screen.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function toggle(row: TemplateRow) {
    if (pendingId !== null) return;
    setPendingId(row.id);
    setError(null);
    try {
      await toggleTemplateActive(api, row);
      await refresh();
    } catch {
      setError(TEMPLATE_MESSAGES.saveFailed);
    } finally {
      setPendingId(null);
    }
  }

  const data = screen.data;
  const vm = data
    ? buildTemplateListViewModel({
        templates: data.templates,
        generatedThisMonth: buildGeneratedThisMonth(data.expenses),
      })
    : null;
  const sections = data
    ? buildTemplatePreviewSections({
        currentMonthKey,
        previews: data.previews as {
          monthKey: string;
          rows: ForecastRowDto[];
        }[],
      })
    : [];
  const colorOf = new Map((data?.categories ?? []).map((c) => [c.id, c.color]));

  function openGenerated(row: TemplateRow) {
    const source = data?.expenses.find((e) => e.id === row.generatedExpenseId);
    if (!source) return;
    const ref: SheetExpenseRef = {
      id: source.id,
      title: source.title,
      amountToman: source.amountToman,
      quantity: source.quantity,
      unit: source.unit,
      occurredAt: source.occurredAt,
      categoryId: source.categoryId,
      eventId: source.eventId,
      sourceRecurringId: source.sourceRecurringId,
    };
    setExpenseSheet({ mode: "edit", expense: ref });
  }

  const templateSheetKey =
    sheet === null
      ? null
      : sheet.mode === "edit"
        ? `edit-${sheet.template.id}`
        : "create";
  const expenseSheetKey =
    expenseSheet === null
      ? null
      : expenseSheet.mode === "edit"
        ? `edit-${expenseSheet.expense.id}`
        : "create";

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Text style={{ fontSize: 20, fontWeight: "800" }}>الگوهای تکرار</Text>
        <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
          هر الگو در ماه‌های فعالش خودکار خرج می‌سازد؛ ساختن و ویرایش الگو به
          دسته‌بندی یاد می‌دهد.
        </Text>

        {screen.isPending ? (
          <ActivityIndicator />
        ) : screen.isError || !vm || !data ? (
          <View style={{ gap: 8, paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 13.5, color: "#6b6259" }}>
              ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید
            </Text>
            <Pressable onPress={() => void onRefresh()} style={primaryButton}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>تلاش دوباره</Text>
            </Pressable>
          </View>
        ) : vm.rows.length === 0 ? (
          <Text
            style={{
              paddingVertical: 40,
              textAlign: "center",
              fontSize: 14,
              color: "#6b6259",
            }}
          >
            {TEMPLATE_MESSAGES.emptyList}
          </Text>
        ) : (
          <View style={{ borderTopWidth: 2, borderTopColor: "#1c1a17" }}>
            {vm.rows.map((row) => (
              <View key={row.id} style={rowStyle}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colorOf.get(row.categoryId) ?? "#82887e",
                  }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: "700", flexShrink: 1 }}>
                      {row.title}
                    </Text>
                    {row.stateBadge ? (
                      <Text style={pausedBadge}>{row.stateBadge}</Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 12, color: "#6b6259" }}>
                    {rhythmLabelFor(row)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {row.generatedExpenseId !== null ? (
                    <Pressable onPress={() => openGenerated(row)}>
                      <Text style={{ fontSize: 12.5, color: "#1a7a5c" }}>
                        {TEMPLATE_MESSAGES.generatedJump}
                      </Text>
                    </Pressable>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Pressable
                      onPress={() => void toggle(row)}
                      disabled={pendingId !== null}
                    >
                      <Text
                        style={{ fontSize: 12.5, color: "#1a7a5c", opacity: pendingId !== null ? 0.6 : 1 }}
                      >
                        {pauseLabelFor(row)}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setSheet({ mode: "edit", template: row })}>
                      <Text style={{ fontSize: 12.5, color: "#1a7a5c" }}>ویرایش</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {error ? (
          <Text accessibilityRole="alert" style={{ fontSize: 13, color: "#b3261e" }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityLabel="افزودن الگو"
          onPress={() => setSheet({ mode: "create" })}
          style={dashedButton}
        >
          <Text style={{ color: "#1a7a5c", fontWeight: "800" }}>+ افزودن الگو</Text>
        </Pressable>

        {sections.length > 0 ? (
          <View style={{ gap: 12, marginTop: 8 }} accessibilityLabel="پیش‌بینی ماه‌های آینده">
            <Text style={{ fontSize: 14, fontWeight: "800" }}>پیش‌بینی ماه‌های آینده</Text>
            {sections.map((section) => (
              <View key={section.monthKey} style={{ gap: 4 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#6b6259" }}>
                  {section.monthLabel}
                </Text>
                <View style={{ borderTopWidth: 1, borderTopColor: "#e7e2d8" }}>
                  {section.rows.map((forecast) => (
                    <View key={forecast.templateId} style={ledgerRow}>
                      <Text style={{ width: 66, fontSize: 11.5, color: "#6b6259" }}>
                        {toPersianDigits(forecast.day)}{" "}
                        {jalaliMonthNameFromKey(section.monthKey)}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700" }}>
                        {forecast.title}
                      </Text>
                      <Text style={forecastBadge}>پیش‌بینی</Text>
                      <Text style={{ fontSize: 13.5, fontWeight: "800" }}>
                        {formatNumber(forecast.amountToman)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {sheet && data ? (
        <TemplateSheetModal
          key={templateSheetKey}
          open={sheet}
          categories={data.categories}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {expenseSheet && data ? (
        <ExpenseSheetModal
          key={expenseSheetKey}
          open={expenseSheet}
          monthKey={currentMonthKey}
          categories={data.categories}
          events={data.events}
          onClose={() => {
            setExpenseSheet(null);
            // The jump sheet edits this month's ledger: refresh the
            // generated map, previews, and dashboards (no restart).
            void invalidateTemplateScopes(
              queryClient,
              affectedScopesForTemplateMutation(),
            );
          }}
        />
      ) : null}
    </View>
  );
}

const rowStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: "#e7e2d8",
  gap: 10,
} as const;

const ledgerRow = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#e7e2d8",
  gap: 8,
} as const;

const pausedBadge = {
  fontSize: 10,
  fontWeight: "700",
  borderWidth: 1,
  borderColor: "#d8d3c8",
  backgroundColor: "#f5f2ea",
  color: "#6b6259",
  borderRadius: 999,
  paddingHorizontal: 8,
  paddingVertical: 1,
} as const;

const forecastBadge = {
  fontSize: 11,
  fontWeight: "800",
  backgroundColor: "#f3e8cf",
  borderRadius: 999,
  paddingHorizontal: 8,
  paddingVertical: 2,
} as const;

const primaryButton = {
  backgroundColor: "#1a7a5c",
  borderRadius: 999,
  paddingHorizontal: 24,
  paddingVertical: 10,
  alignItems: "center",
} as const;

const dashedButton = {
  borderWidth: 1,
  borderColor: "#d8d3c8",
  borderStyle: "dashed",
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: "center",
} as const;
