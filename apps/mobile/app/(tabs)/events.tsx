// Events list (expo-mobile ticket 06): named buckets (travel, …) with this
// month's total + count overlay per event, create with an optional note,
// rename, and unlink-only deletion behind a confirm (خرج‌ها می‌مانند).
// Each row links to its stack detail (back keeps context). Reads go through
// the typed v1 client (the frozen API); every mutation invalidates the
// event and dependent scopes (no restart). Web parity: events/page.tsx +
// manager island.
//
// Frozen-API note: totals are month-scoped (this month's ledger grouped
// client-side — the API exposes no event-summary read) and say so; the
// detail carries the unbounded month navigator for the rest.

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { T as Text } from "../../components/app-text";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useFocusEffect } from "expo-router";
import { currentJalaliMonthKey } from "@spend-tracker/shared/jalali";
import type {
  EventDto,
  ExpenseDto,
} from "@spend-tracker/shared/schemas/api";
import { useSession } from "../../src/session";
import { setLastTabLabel } from "../../src/last-tab";
import { INPUT_FONT_STYLE } from "../../components/app-text";
import {
  EVENT_MESSAGES,
  buildEventListViewModel,
  createEvent,
  removeEvent,
  renameEvent,
  validateEventTitle,
} from "../../src/events";
import {
  affectedScopesForEventMutation,
  eventsKey,
  invalidateEventScopes,
  loadEventsScreen,
} from "../../src/event-queries";

export default function EventsScreen() {
  const { api } = useSession();
  // Origin tracking for truthful back titles (ticket 18).
  useFocusEffect(
    useCallback(() => {
      setLastTabLabel("رویدادها");
    }, []),
  );
  const queryClient = useQueryClient();
  const [monthKey] = useState(() => currentJalaliMonthKey());
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screen = useQuery({
    queryKey: [...eventsKey(), monthKey],
    queryFn: () =>
      loadEventsScreen(api, monthKey) as Promise<{
        events: EventDto[];
        expenses: ExpenseDto[];
      }>,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    await invalidateEventScopes(
      queryClient,
      affectedScopesForEventMutation(),
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

  async function run(fn: () => Promise<void>, message: string = EVENT_MESSAGES.saveFailed) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch {
      setError(message);
    } finally {
      setPending(false);
    }
  }

  const data = screen.data;
  const vm = data
    ? buildEventListViewModel({ events: data.events, expenses: data.expenses })
    : null;

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Text style={{ fontSize: 20, fontWeight: "800" }}>رویدادها</Text>
        <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
          {EVENT_MESSAGES.monthScopedHint}
        </Text>

        {screen.isPending ? (
          <ActivityIndicator />
        ) : screen.isError || !vm ? (
          <View style={{ gap: 8, paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 13.5, color: "#6b6259" }}>
              ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید
            </Text>
            <Pressable onPress={() => void onRefresh()} style={primaryButton}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>تلاش دوباره</Text>
            </Pressable>
          </View>
        ) : vm.rows.length === 0 && !formOpen ? (
          <Text
            style={{
              paddingVertical: 40,
              textAlign: "center",
              fontSize: 14,
              color: "#6b6259",
            }}
          >
            {EVENT_MESSAGES.emptyList}
          </Text>
        ) : (
          <View style={{ borderTopWidth: 2, borderTopColor: "#1c1a17" }}>
            {vm.rows.map((row) =>
              editingId === row.id ? (
                <View key={row.id} style={rowStyle}>
                  <TextInput
                    aria-label="نام رویداد"
                    value={editTitle}
                    onChangeText={setEditTitle}
                    style={[inputStyle, { flex: 1 }]}
                  />
                  <Pressable onPress={() => setEditingId(null)} style={ghostButton}>
                    <Text>انصراف</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      void run(() =>
                        renameEvent(api, row.id, editTitle).then(() =>
                          setEditingId(null),
                        ),
                      )
                    }
                    disabled={!validateEventTitle(editTitle) || pending}
                    style={primaryButton}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>ذخیره</Text>
                  </Pressable>
                </View>
              ) : confirmingId === row.id ? (
                <View key={row.id} style={rowStyle}>
                  <Text style={{ flex: 1, fontSize: 13.5, color: "#6b6259" }}>
                    {EVENT_MESSAGES.deleteConfirm}
                  </Text>
                  <Pressable onPress={() => setConfirmingId(null)} style={ghostButton}>
                    <Text>انصراف</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      void run(() =>
                        removeEvent(api, row.id).then(() => setConfirmingId(null)),
                      )
                    }
                    disabled={pending}
                    style={dangerButton}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>حذف</Text>
                  </Pressable>
                </View>
              ) : (
                <View key={row.id} style={rowStyle}>
                  <Link href={row.drilldown as "/event/[id]"} asChild>
                    <Pressable style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: "700" }}>
                        {row.title}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6b6259" }}>
                        {row.overlayLabel}
                      </Text>
                    </Pressable>
                  </Link>
                  <Pressable
                    onPress={() => {
                      setEditingId(row.id);
                      setEditTitle(row.title);
                    }}
                  >
                    <Text style={{ fontSize: 12.5, color: "#1a7a5c" }}>تغییر نام</Text>
                  </Pressable>
                  <Pressable onPress={() => setConfirmingId(row.id)}>
                    <Text style={{ fontSize: 12.5, color: "#b3261e" }}>حذف</Text>
                  </Pressable>
                </View>
              ),
            )}
          </View>
        )}

        {error ? (
          <Text accessibilityRole="alert" style={{ fontSize: 13, color: "#b3261e" }}>
            {error}
          </Text>
        ) : null}

        {formOpen ? (
          <View style={{ borderTopWidth: 1, borderTopColor: "#e7e2d8", paddingTop: 12, gap: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: "700" }}>نام رویداد</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="مثلاً سفر اصفهان"
              style={inputStyle}
            />
            <Text style={{ fontSize: 13, fontWeight: "700" }}>یادداشت (اختیاری)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="مثلاً سه روزه با خانواده"
              style={inputStyle}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setFormOpen(false)} style={ghostButton}>
                <Text>انصراف</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void run(() =>
                    createEvent(api, { title, note }).then(() => {
                      setFormOpen(false);
                      setTitle("");
                      setNote("");
                    }),
                  )
                }
                disabled={!validateEventTitle(title) || pending}
                style={[primaryButton, { opacity: validateEventTitle(title) ? 1 : 0.6 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>افزودن</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="افزودن رویداد"
            onPress={() => setFormOpen(true)}
            style={dashedButton}
          >
            <Text style={{ color: "#1a7a5c", fontWeight: "800" }}>+ افزودن رویداد</Text>
          </Pressable>
        )}
      </ScrollView>
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

const dangerButton = {
  backgroundColor: "#b3261e",
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
