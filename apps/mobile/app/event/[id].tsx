// Event detail (expo-mobile ticket 06): the overlay panel (this month's
// total + count), the event's own rows with their دسته chips, the
// locked-event add that keeps context (the sheet opens on this id), and
// unlink-only deletion behind a confirm (خرج‌ها می‌مانند — rows keep their
// category and month). Unbounded ?month= navigation like the category
// drilldown; tapping a خرج opens its edit sheet. Web parity:
// events/[id]/page.tsx + detail panel.

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import {
  currentJalaliMonthKey,
  formatJalali,
  fromISODate,
  jalaliMonthKeyLabel,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";
import { formatNumber } from "@spend-tracker/shared/format";
import type {
  CategoryDto,
  EventDto,
  ExpenseDto,
} from "@spend-tracker/shared/schemas/api";
import { useSession } from "../../src/session";
import { EVENT_MESSAGES, buildEventDetail, removeEvent } from "../../src/events";
import type { EventDetailPanel } from "../../src/events";
import {
  affectedScopesForEventMutation,
  invalidateEventScopes,
  loadEventDetail,
} from "../../src/event-queries";
import { shiftDashboardMonth } from "../../src/dashboard";
import type { SheetExpenseRef, SheetOpen } from "../../src/expense-sheet";
import { ExpenseSheetModal } from "../../components/expense-sheet-form";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(() => currentJalaliMonthKey());
  const [sheet, setSheet] = useState<SheetOpen | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({
    // Under the events prefix so event mutations refresh it.
    queryKey: ["events", "detail", id, monthKey],
    queryFn: () =>
      loadEventDetail(api, monthKey) as Promise<{
        events: EventDto[];
        expenses: ExpenseDto[];
        categories: CategoryDto[];
      }>,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await detail.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function refresh() {
    await invalidateEventScopes(queryClient, affectedScopesForEventMutation());
  }

  async function onDelete() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await removeEvent(api, id);
      await refresh();
      router.replace("/events");
    } catch {
      setError(EVENT_MESSAGES.saveFailed);
    } finally {
      setPending(false);
    }
  }

  const data = detail.data;
  let panel: EventDetailPanel<ExpenseDto> | null = null;
  let unknownEvent = false;
  if (data) {
    try {
      panel = buildEventDetail({ eventId: id, events: data.events, expenses: data.expenses });
    } catch {
      unknownEvent = true;
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
        : `create-${panel?.lockedEventId ?? "open"}`;

  const categoryName = (categoryId: string) =>
    data?.categories.find((c) => c.id === categoryId)?.name ?? "";

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Link href="/events" asChild>
          <Pressable>
            <Text style={{ fontSize: 13, color: "#6b6259" }}>‹ بازگشت به رویدادها</Text>
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

        {detail.isPending ? (
          <ActivityIndicator />
        ) : detail.isError || unknownEvent || !panel || !data ? (
          <View style={{ gap: 8, paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 13.5, color: "#6b6259" }}>
              {unknownEvent
                ? "این رویداد پیدا نشد."
                : "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید"}
            </Text>
            {!unknownEvent ? (
              <Pressable onPress={() => void onRefresh()} style={retryButton}>
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
              <Text style={{ fontSize: 18, fontWeight: "800" }}>{panel.event.title}</Text>
              {panel.event.note ? (
                <Text style={{ fontSize: 13, color: "#6b6259" }}>{panel.event.note}</Text>
              ) : null}
              {panel.event.startDate || panel.event.endDate ? (
                <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
                  {panel.event.startDate
                    ? formatJalali(fromISODate(panel.event.startDate), "d MMMM yyyy")
                    : ""}
                  {panel.event.startDate && panel.event.endDate ? " تا " : ""}
                  {panel.event.endDate
                    ? formatJalali(fromISODate(panel.event.endDate), "d MMMM yyyy")
                    : ""}
                </Text>
              ) : null}
              <Text style={{ fontSize: 34, fontWeight: "800" }}>
                {formatNumber(panel.totalToman)}
                <Text style={{ fontSize: 13, fontWeight: "400", color: "#6b6259" }}>
                  {"  "}تومان
                </Text>
              </Text>
              <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
                {toPersianDigits(panel.count)} خرج در {jalaliMonthKeyLabel(monthKey)}
              </Text>
            </View>

            <Pressable
              accessibilityLabel="افزودن به این رویداد"
              onPress={() =>
                setSheet({ mode: "create", lockedEventId: panel.lockedEventId })
              }
              style={dashedButton}
            >
              <Text style={{ color: "#1a7a5c", fontWeight: "800" }}>
                + افزودن به این رویداد
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
                {panel.event.title} در {jalaliMonthKeyLabel(monthKey)} خرجی ندارد.
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
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "700" }}>
                        {row.title}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: "#6b6259" }}>
                        {categoryName(row.categoryId)}
                      </Text>
                    </View>
                    {row.sourceRecurringId ? (
                      <Text style={templateBadge}>از الگو</Text>
                    ) : null}
                    <Text style={{ fontSize: 13.5, fontWeight: "800" }}>
                      {formatNumber(row.amountToman)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={{ borderTopWidth: 1, borderTopColor: "#e7e2d8", paddingTop: 12 }}>
              {confirming ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 13.5, color: "#6b6259" }}>
                    {EVENT_MESSAGES.deleteConfirm}
                  </Text>
                  <Pressable onPress={() => setConfirming(false)} style={ghostButton}>
                    <Text>انصراف</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void onDelete()}
                    disabled={pending}
                    style={dangerButton}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>حذف</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityLabel="حذف رویداد"
                  onPress={() => setConfirming(true)}
                  style={dangerOutline}
                >
                  <Text style={{ color: "#b3261e", fontWeight: "800" }}>حذف رویداد</Text>
                </Pressable>
              )}
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ marginTop: 8, fontSize: 13, color: "#b3261e" }}
                >
                  {error}
                </Text>
              ) : null}
            </View>
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
            await refresh();
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

const dangerOutline = {
  borderWidth: 1,
  borderColor: "#b3261e",
  borderRadius: 999,
  paddingVertical: 10,
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
