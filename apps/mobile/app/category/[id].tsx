// Category drilldown (expo-mobile ticket 04): a tile's destination — the
// panel with this category's month total plus only its own rows, and the
// locked-category add that keeps context (the sheet opens on this id).
// Unbounded ?month= navigation like the dashboard; a future month with
// forecast rows wears the composite «ثبت‌شده + پیش‌بینی» note (decision 15).
// Tapping a خرج opens its edit sheet; forecast rows stay display-only
// estimates. Web parity: categories/[id]/page.tsx + drilldown panel.

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { T as Text } from "../../components/app-text";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocalSearchParams } from "expo-router";
import {
  currentJalaliMonthKey,
  jalaliMonthKeyLabel,
} from "@spend-tracker/shared/jalali";
import { formatNumber } from "@spend-tracker/shared/format";
import type {
  CategoryDto,
  EventDto,
  ExpenseDto,
  ForecastRowDto,
  MonthSummaryDto,
} from "@spend-tracker/shared/schemas/api";
import { useSession } from "../../src/session";
import { buildCategoryDrilldown } from "../../src/categories";
import {
  affectedScopesForCategoryMutation,
  invalidateCategoryScopes,
  loadCategoryDrilldown,
} from "../../src/category-queries";
import { shiftDashboardMonth } from "../../src/dashboard";
import type { SheetExpenseRef, SheetOpen } from "../../src/expense-sheet";
import { ExpenseSheetModal } from "../../components/expense-sheet-form";

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [monthKey, setMonthKey] = useState(() => currentJalaliMonthKey());
  const [sheet, setSheet] = useState<SheetOpen | null>(null);

  const drilldown = useQuery({
    // Under the categories prefix so category mutations refresh it.
    queryKey: ["categories", "drilldown", id, monthKey],
    queryFn: () =>
      loadCategoryDrilldown(api, monthKey) as Promise<{
        summary: MonthSummaryDto;
        expenses: ExpenseDto[];
        forecast: ForecastRowDto[];
        categories: CategoryDto[];
        events: EventDto[];
      }>,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await drilldown.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const data = drilldown.data;
  let panel: {
    category: CategoryDto;
    totalToman: number;
    hasForecast: boolean;
    expenses: ExpenseDto[];
    forecast: ForecastRowDto[];
    isEmpty: boolean;
    lockedCategoryId: string;
  } | null = null;
  let unknownCategory = false;
  if (data) {
    try {
      panel = buildCategoryDrilldown({
        monthKey,
        currentMonthKey: currentJalaliMonthKey(),
        categoryId: id,
        categories: data.categories,
        summary: data.summary,
        expenses: data.expenses,
        forecast: data.forecast,
      });
    } catch {
      unknownCategory = true;
    }
  }

  function openEdit(expenseId: string) {
    const source = data?.expenses.find((e) => e.id === expenseId);
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
    setSheet({ mode: "edit", expense: ref });
  }

  const sheetKey =
    sheet === null
      ? null
      : sheet.mode === "edit"
        ? `edit-${sheet.expense.id}`
        : `create-${panel?.lockedCategoryId ?? "open"}`;

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Link href="/categories" asChild>
          <Pressable>
            <Text style={{ fontSize: 13, color: "#6b6259" }}>‹ بازگشت به دسته‌ها</Text>
          </Pressable>
        </Link>

        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          accessibilityLabel="ناوبری ماه"
        >
          <Pressable
            accessibilityLabel="ماه قبل"
            onPress={() => setMonthKey((m) => shiftDashboardMonth(m, -1))}
            style={navButton}
          >
            <Text style={{ fontSize: 17 }}>‹</Text>
          </Pressable>
          <Text style={{ minWidth: 112, textAlign: "center", fontSize: 15, fontWeight: "700" }}>
            {jalaliMonthKeyLabel(monthKey)}
          </Text>
          <Pressable
            accessibilityLabel="ماه بعد"
            onPress={() => setMonthKey((m) => shiftDashboardMonth(m, 1))}
            style={navButton}
          >
            <Text style={{ fontSize: 17 }}>›</Text>
          </Pressable>
        </View>

        {drilldown.isPending ? (
          <ActivityIndicator />
        ) : drilldown.isError || unknownCategory || !panel || !data ? (
          <View style={{ gap: 8, paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 13.5, color: "#6b6259" }}>
              {unknownCategory
                ? "این دسته پیدا نشد."
                : "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید"}
            </Text>
            {!unknownCategory ? (
              <Pressable
                onPress={() => void onRefresh()}
                style={retryButton}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>تلاش دوباره</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <View
              style={{
                borderWidth: 1,
                borderColor: "#d8d3c8",
                borderRadius: 16,
                padding: 16,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: panel.category.color ?? "#82887e",
                  }}
                />
                <Text style={{ fontSize: 18, fontWeight: "800" }}>
                  {panel.category.name}
                </Text>
              </View>
              <Text style={{ fontSize: 34, fontWeight: "800" }}>
                {formatNumber(panel.totalToman)}
                <Text style={{ fontSize: 13, fontWeight: "400", color: "#6b6259" }}>
                  {"  "}تومان
                </Text>
              </Text>
              <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
                {jalaliMonthKeyLabel(monthKey)}
                {panel.hasForecast ? " — ثبت‌شده + پیش‌بینی" : ""}
              </Text>
            </View>

            <Pressable
              accessibilityLabel="افزودن به این دسته"
              onPress={() =>
                setSheet({ mode: "create", lockedCategoryId: panel.lockedCategoryId })
              }
              style={dashedButton}
            >
              <Text style={{ color: "#1a7a5c", fontWeight: "800" }}>
                + افزودن به این دسته
              </Text>
            </Pressable>

            {panel.isEmpty ? (
              <Text
                style={{
                  paddingVertical: 40,
                  textAlign: "center",
                  fontSize: 14,
                  color: "#6b6259",
                }}
              >
                {panel.category.name} در {jalaliMonthKeyLabel(monthKey)} خرجی ندارد.
              </Text>
            ) : (
              <View style={{ borderTopWidth: 2, borderTopColor: "#1c1a17" }}>
                {panel.expenses.map((row) => (
                  <Pressable
                    key={row.id}
                    accessibilityLabel={row.title}
                    onPress={() => openEdit(row.id)}
                    style={ledgerRow}
                  >
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700" }}>
                      {row.title}
                    </Text>
                    {row.sourceRecurringId ? (
                      <Text style={templateBadge}>از الگو</Text>
                    ) : null}
                    <Text style={{ fontSize: 13.5, fontWeight: "800" }}>
                      {formatNumber(row.amountToman)}
                    </Text>
                  </Pressable>
                ))}
                {panel.forecast.map((row) => (
                  <View key={row.templateId} style={ledgerRow}>
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700" }}>
                      {row.title}
                    </Text>
                    <Text style={forecastBadge}>پیش‌بینی</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: "800" }}>
                      {formatNumber(row.amountToman)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {sheet && data ? (
        <ExpenseSheetModal
          key={sheetKey}
          open={sheet}
          monthKey={monthKey}
          categories={data.categories}
          events={data.events}
          onClose={async () => {
            setSheet(null);
            await invalidateCategoryScopes(
              queryClient,
              affectedScopesForCategoryMutation(),
            );
          }}
        />
      ) : null}
    </View>
  );
}

const navButton = {
  width: 34,
  height: 34,
  borderRadius: 17,
  alignItems: "center",
  justifyContent: "center",
} as const;

const ledgerRow = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#e7e2d8",
  gap: 8,
} as const;

const retryButton = {
  backgroundColor: "#1a7a5c",
  borderRadius: 999,
  paddingHorizontal: 24,
  paddingVertical: 10,
} as const;

const dashedButton = {
  borderWidth: 1,
  borderColor: "#d8d3c8",
  borderStyle: "dashed",
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: "center",
} as const;

const templateBadge = {
  fontSize: 11,
  fontWeight: "800",
  backgroundColor: "#e4f0e9",
  borderRadius: 999,
  paddingHorizontal: 8,
  paddingVertical: 2,
} as const;

const forecastBadge = {
  fontSize: 11,
  fontWeight: "800",
  backgroundColor: "#f3e8cf",
  borderRadius: 999,
  paddingHorizontal: 8,
  paddingVertical: 2,
} as const;
