// Repeat-purchase insights (expo-mobile ticket 08): the top-products board
// with overall weighted average unit price and count, monthly
// average-unit-price trends with the overall average as reference, and
// per-product purchase history. Reads go through the frozen month ledger —
// the frozen API exposes no insights read — so the loader fans out the
// trailing 12 Jalali months and groups client-side (see insights-queries.ts);
// the board labels the window honestly («۱۲ ماه اخیر»). History is
// read-only like the web board; every expense mutation invalidates the
// "insights" scope (no restart). Web parity: insights/page.tsx + board.

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { T as Text } from "../../components/app-text";
import { useQuery } from "@tanstack/react-query";
import {
  currentJalaliMonthKey,
  formatJalaliISODate,
  formatToman,
  jalaliMonthKeyLabel,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";
import { formatNumber } from "@spend-tracker/shared/format";
import { canonical } from "@spend-tracker/shared/normalize";
import type { ExpenseDto } from "@spend-tracker/shared/schemas/api";
import { useSession } from "../../src/session";
import { INPUT_FONT_STYLE } from "../../components/app-text";
import {
  INSIGHT_MESSAGES,
  buildProductInsights,
  historyFor,
  type InsightExpenseLike,
} from "../../src/insights";
import {
  insightsKey,
  loadInsightsScreen,
  type InsightsScreenData,
} from "../../src/insights-queries";

interface InsightsData extends InsightsScreenData {
  expenses: ExpenseDto[];
  monthKeys: string[];
}

export default function InsightsScreen() {
  const { api } = useSession();
  const [currentMonthKey] = useState(() => currentJalaliMonthKey());
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const insights = useQuery({
    queryKey: insightsKey(),
    queryFn: () => loadInsightsScreen(api, currentMonthKey) as Promise<InsightsData>,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await insights.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const products = useMemo(
    () =>
      buildProductInsights(
        (insights.data?.expenses ?? []) as InsightExpenseLike[],
      ),
    [insights.data],
  );
  const filtered = useMemo(() => {
    const needle = canonical(filter);
    if (needle === "") return products;
    return products.filter((p) => canonical(p.displayTitle).includes(needle));
  }, [products, filter]);
  const active =
    filtered.find((p) => p.key === openKey) ?? filtered[0] ?? null;
  const history = useMemo(
    () => (active ? historyFor(active) : []),
    [active],
  );
  // Bar scale: the hottest month fills the track; every value stays readable
  // in Persian digits next to its bar (web parity: readable values).
  const maxBucketAvg = useMemo(
    () =>
      active
        ? Math.max(...active.monthly.map((b) => b.avgUnitPrice), 1)
        : 1,
    [active],
  );

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Text style={{ fontSize: 20, fontWeight: "800" }}>بینش محصول‌ها</Text>
        <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
          میانگین هر عدد برای پرتکرارترین عنوان‌ها · {INSIGHT_MESSAGES.windowHint}
        </Text>

        {insights.isPending ? (
          <ActivityIndicator />
        ) : insights.isError || !insights.data ? (
          <View style={{ gap: 8, paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 13.5, color: "#6b6259" }}>
              {INSIGHT_MESSAGES.loadFailed}
            </Text>
            <Pressable onPress={() => void onRefresh()} style={primaryButton}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>تلاش دوباره</Text>
            </Pressable>
          </View>
        ) : products.length === 0 ? (
          <Text
            style={{
              paddingVertical: 40,
              textAlign: "center",
              fontSize: 14,
              color: "#6b6259",
            }}
          >
            {INSIGHT_MESSAGES.emptyList}
          </Text>
        ) : (
          <>
            <TextInput
              accessibilityLabel="جست‌وجوی محصول"
              placeholder="جست‌وجوی محصول… مثلاً نان"
              value={filter}
              onChangeText={setFilter}
              style={inputStyle}
            />
            {filtered.length === 0 ? (
              <Text
                style={{ paddingVertical: 24, textAlign: "center", fontSize: 14, color: "#6b6259" }}
              >
                {INSIGHT_MESSAGES.noFilterHits}
              </Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {filtered.map((p) => {
                  const isOpen = active?.key === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      accessibilityLabel={p.displayTitle}
                      accessibilityRole="button"
                      onPress={() => setOpenKey(p.key)}
                      style={[
                        cardStyle,
                        isOpen ? { borderColor: "#1a7a5c" } : null,
                      ]}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700" }}>
                        {p.displayTitle}
                      </Text>
                      <Text style={{ fontSize: 19, fontWeight: "800" }}>
                        {formatNumber(p.overallAvgUnit)}
                      </Text>
                      <Text style={{ fontSize: 11, color: "#6b6259" }}>
                        میانگین هر عدد · {toPersianDigits(p.count)} خرید
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {active ? (
              <View style={{ borderTopWidth: 2, borderTopColor: "#1c1a17", paddingTop: 12, gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "800" }}>
                  {active.displayTitle} · {toPersianDigits(active.count)} خرید
                </Text>
                <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
                  جمع {formatToman(active.totalToman)} · میانگین{" "}
                  {formatToman(active.overallAvgUnit)}
                </Text>

                <View accessibilityLabel={`میانگین ماهانه ${active.displayTitle}`} style={{ gap: 10 }}>
                  {active.monthly.map((bucket) => (
                    <View key={bucket.monthKey} style={{ gap: 3 }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                        <Text style={{ flex: 1, fontSize: 12.5 }}>
                          {jalaliMonthKeyLabel(bucket.monthKey)} ·{" "}
                          {toPersianDigits(bucket.count)} خرید
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: "800" }}>
                          {formatToman(bucket.avgUnitPrice)}
                        </Text>
                      </View>
                      <View
                        style={{
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: "#ece7db",
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: "#1a7a5c",
                            width: `${Math.max(Math.round((bucket.avgUnitPrice / maxBucketAvg) * 100), 4)}%`,
                          }}
                        />
                      </View>
                    </View>
                  ))}
                  <View style={ledgerRow}>
                    <Text style={{ flex: 1, fontSize: 13, color: "#6b6259" }}>
                      میانگین کل (۱۲ ماه اخیر)
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: "800", color: "#1a7a5c" }}>
                      {formatToman(active.overallAvgUnit)}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 14, fontWeight: "800", marginTop: 4 }}>
                  تاریخچه خریدها
                </Text>
                <View accessibilityLabel="تاریخچه خریدها">
                  {history.map((point) => (
                    <View key={point.expenseId} style={ledgerRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700" }}>
                          {formatJalaliISODate(point.occurredAt)}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: "#6b6259" }}>
                          {jalaliMonthKeyLabel(point.monthKey)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13.5, fontWeight: "800" }}>
                        {formatToman(point.amountToman)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const inputStyle = {
  ...INPUT_FONT_STYLE,
  borderWidth: 1,
  borderColor: "#d8d3c8",
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 10,
  fontSize: 14,
  textAlign: "right",
} as const;

const cardStyle = {
  borderWidth: 1,
  borderColor: "#d8d3c8",
  borderRadius: 16,
  backgroundColor: "#fff",
  paddingHorizontal: 14,
  paddingVertical: 10,
  gap: 2,
  minWidth: 140,
} as const;

const ledgerRow = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#e7e2d8",
  gap: 8,
} as const;

const primaryButton = {
  backgroundColor: "#1a7a5c",
  borderRadius: 999,
  paddingHorizontal: 24,
  paddingVertical: 10,
  alignItems: "center",
} as const;
