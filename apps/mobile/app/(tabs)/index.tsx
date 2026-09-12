// Dashboard (expo-mobile ticket 03): the core daily loop — Jalali month
// navigation with totals plus forecast, per-category tiles, the interleaved
// recorded-plus-forecast ledger, and the Expense bottom sheet for
// create/edit. Pull-to-refresh recovers from network hiccups; every mutation
// invalidates its scopes (no restart). Tapping a ledger row opens its edit
// sheet; forecast rows stay display-only estimates (their edit lives in the
// ticket-05 templates surface).

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { currentJalaliMonthKey, formatToman } from "@spend-tracker/shared/jalali";
import { formatNumber, formatPercent } from "@spend-tracker/shared/format";
import type {
  CategoryDto,
  EventDto,
  ExpenseDto,
  ForecastRowDto,
  MonthSummaryDto,
} from "@spend-tracker/shared/schemas/api";
import { useSession } from "../../src/session";
import {
  buildDashboardViewModel,
  shiftDashboardMonth,
  type DashboardLedgerRow,
} from "../../src/dashboard";
import {
  dashboardKey,
  loadDashboardMonth,
  type DashboardMonth,
} from "../../src/queries";
import type { SheetExpenseRef, SheetOpen } from "../../src/expense-sheet";
import { ExpenseSheetModal } from "../../components/expense-sheet-form";

export default function HomeScreen() {
  const { api } = useSession();
  const [monthKey, setMonthKey] = useState(() => currentJalaliMonthKey());
  const [sheet, setSheet] = useState<SheetOpen | null>(null);

  const dashboard = useQuery({
    queryKey: dashboardKey(monthKey),
    queryFn: () => loadDashboardMonth(api, monthKey) as Promise<DashboardMonth>,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await dashboard.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const data = dashboard.data as
    | {
        summary: MonthSummaryDto;
        expenses: ExpenseDto[];
        forecast: ForecastRowDto[];
        categories: CategoryDto[];
        events: EventDto[];
      }
    | undefined;

  const vm = data
    ? buildDashboardViewModel({
        monthKey,
        summary: data.summary,
        expenses: data.expenses,
        forecast: data.forecast,
        categories: data.categories,
        events: data.events,
      })
    : null;

  function openEdit(row: Extract<DashboardLedgerRow, { kind: "expense" }>) {
    const source = data?.expenses.find((e) => e.id === row.id);
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
        : "create";

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
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
            {vm?.monthLabel ?? monthKey}
          </Text>
          <Pressable
            accessibilityLabel="ماه بعد"
            onPress={() => setMonthKey((m) => shiftDashboardMonth(m, 1))}
            style={navButton}
          >
            <Text style={{ fontSize: 17 }}>›</Text>
          </Pressable>
        </View>

        {dashboard.isPending ? (
          <ActivityIndicator />
        ) : dashboard.isError || !vm ? (
          <View style={{ gap: 8, paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 13.5, color: "#6b6259" }}>
              ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید
            </Text>
            <Pressable onPress={() => void onRefresh()} style={retryButton}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>تلاش دوباره</Text>
            </Pressable>
          </View>
        ) : vm.isEmpty ? (
          <Text style={{ paddingVertical: 48, textAlign: "center", fontSize: 14, color: "#6b6259" }}>
            برای {vm.monthLabel} خرجی ثبت نشده.
          </Text>
        ) : (
          <>
            <View>
              <Text style={{ fontSize: 40, fontWeight: "800" }}>
                {formatNumber(vm.totalToman)}
                <Text style={{ fontSize: 13, fontWeight: "400", color: "#6b6259" }}>
                  {"  "}تومان
                </Text>
              </Text>
              {vm.forecastToman !== undefined ? (
                <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
                  شامل پیش‌بینی الگوها: {formatToman(vm.forecastToman)}
                </Text>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {vm.tiles.map((tile) => (
                <Link
                  key={tile.categoryId}
                  href={tile.drilldown as "/category/[id]"}
                  asChild
                >
                  <Pressable
                    style={{
                      flexGrow: 1,
                      flexBasis: "45%",
                      borderWidth: 1,
                      borderColor: "#d8d3c8",
                      borderRadius: 16,
                      padding: 12,
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700" }}>{tile.name}</Text>
                    <Text style={{ fontSize: 16.5, fontWeight: "800" }}>
                      {formatNumber(tile.totalToman)}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#6b6259" }}>
                      {formatPercent(tile.share)}
                    </Text>
                  </Pressable>
                </Link>
              ))}
            </View>

            <View style={{ borderTopWidth: 2, borderTopColor: "#1c1a17" }}>
              {vm.ledger.map((row) =>
                row.kind === "expense" ? (
                  <Pressable
                    key={row.id}
                    accessibilityLabel={row.title}
                    onPress={() => openEdit(row)}
                    style={ledgerRow}
                  >
                    <LedgerRowBody row={row} />
                  </Pressable>
                ) : (
                  <View key={row.templateId} style={ledgerRow}>
                    <LedgerRowBody row={row} />
                  </View>
                ),
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Pressable
        accessibilityLabel="ثبت خرج"
        onPress={() => setSheet({ mode: "create" })}
        style={{
          position: "absolute",
          bottom: 24,
          insetInlineEnd: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#1a7a5c",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 27, fontWeight: "300" }}>+</Text>
      </Pressable>

      {sheet && data ? (
        <ExpenseSheetModal
          key={sheetKey}
          open={sheet}
          monthKey={monthKey}
          categories={data.categories}
          events={data.events}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

function LedgerRowBody({ row }: { row: DashboardLedgerRow }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
      <Text style={{ width: 66, fontSize: 11.5, color: "#6b6259" }}>{row.dayLabel}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", flexShrink: 1 }}>
            {row.title}
          </Text>
          {row.badge ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                backgroundColor: row.kind === "forecast" ? "#f3e8cf" : "#e4f0e9",
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              {row.badge}
            </Text>
          ) : null}
        </View>
        {row.kind === "expense" && (row.quantity !== 1 || row.unit === "kg") ? (
          <Text style={{ fontSize: 11.5, color: "#6b6259" }}>
            {row.unit === "kg"
              ? `${row.quantity} کیلو · هر کیلو ${formatToman(Math.round(row.amountToman / row.quantity))}`
              : `×${row.quantity} · هر عدد ${formatToman(Math.round(row.amountToman / row.quantity))}`}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 13.5, fontWeight: "800" }}>
        {formatNumber(row.amountToman)}
      </Text>
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
} as const;

const retryButton = {
  backgroundColor: "#1a7a5c",
  borderRadius: 999,
  paddingHorizontal: 24,
  paddingVertical: 10,
} as const;
