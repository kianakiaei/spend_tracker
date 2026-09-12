// Whole-ledger search (expo-mobile ticket 07): title search with the same
// Persian normalization the categorization engine uses, hit metadata
// (مبلغ، ماهِ جلالی وقوع, دسته), and tap-to-edit in the shared Expense
// sheet. Reads go through the frozen GET /api/v1/search?q= (per debounced
// keystroke — the frozen API has no listAll read); the fetched page is also
// narrowed client-side with the shared canonical rule so the list stays
// consistent between keystrokes (web parity: search/page.tsx + board).
// A save in the edit sheet invalidates the "search" scope, so hits refresh
// without restart.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { T as Text } from "../components/app-text";
import { useQuery } from "@tanstack/react-query";
import { currentJalaliMonthKey } from "@spend-tracker/shared/jalali";
import type {
  CategoryDto,
  EventDto,
  SearchResultDto,
} from "@spend-tracker/shared/schemas/api";
import { useNavigation } from "expo-router";
import { useSession } from "../src/session";
import { getLastTabLabel } from "../src/last-tab";
import { INPUT_FONT_STYLE } from "../components/app-text";
import {
  SEARCH_MESSAGES,
  buildSearchViewModel,
  narrowHits,
  type SearchHit,
  type SearchRow,
} from "../src/search";
import {
  loadSearchScreen,
  searchKey,
  type SearchScreenData,
} from "../src/search-queries";
import type { SheetOpen } from "../src/expense-sheet";
import { ExpenseSheetModal } from "../components/expense-sheet-form";

interface SearchData extends SearchScreenData {
  hits: SearchResultDto[];
  categories: CategoryDto[];
  events: EventDto[];
}

/** Server round-trip per debounced keystroke (the frozen API filters). */
const DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const { api } = useSession();
  const navigation = useNavigation();
  // Truthful back title (ticket 18): the focused origin tab at push time.
  useEffect(() => {
    navigation.setOptions({ headerBackTitle: getLastTabLabel() });
  }, [navigation]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sheet, setSheet] = useState<SheetOpen | null>(null);
  // The tapped hit's own وقوع month, captured at tap time: the sheet opens
  // on a real month even if the list re-narrows underneath (never query text).
  const [sheetMonthKey, setSheetMonthKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useQuery({
    queryKey: searchKey(debounced),
    queryFn: () => loadSearchScreen(api, debounced) as Promise<SearchData>,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await search.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const data = search.data;
  const narrowed = useMemo(
    () => narrowHits((data?.hits ?? []) as SearchHit[], query),
    [data, query],
  );
  const vm = useMemo(() => buildSearchViewModel({ hits: narrowed }), [narrowed]);
  const isBlank = query.trim() === "";

  const sheetKey =
    sheet === null
      ? null
      : sheet.mode === "edit"
        ? `edit-${sheet.expense.id}`
        : "create";

  function openEdit(row: SearchRow) {
    setSheet({ mode: "edit", expense: row.editRef });
    setSheetMonthKey(row.monthKey);
  }

  function closeSheet() {
    setSheet(null);
    setSheetMonthKey(null);
  }

  return (
    <View style={{ flex: 1, direction: 'rtl' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 20, fontWeight: "800", textAlign: 'left' }}>جست‌وجو در همه ماه‌ها</Text>
        <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
          عنوانِ یک قلم را بنویس تا ببینی در کدام ماه و با چه قیمتی خریده شده
        </Text>

        <TextInput
          accessibilityLabel="جست‌وجوی خرج"
          placeholder="جست‌وجو… مثلاً نان"
          value={query}
          onChangeText={setQuery}
          style={{
            ...INPUT_FONT_STYLE,
            borderWidth: 1,
            borderColor: "#d8d3c8",
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 16,
            textAlign: "right",
          }}
        />

        {search.isPending ? (
          <ActivityIndicator />
        ) : search.isError || !data ? (
          <View style={{ gap: 8, paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 13.5, color: "#6b6259" }}>
              {SEARCH_MESSAGES.loadFailed}
            </Text>
            <Pressable onPress={() => void onRefresh()} style={primaryButton}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>تلاش دوباره</Text>
            </Pressable>
          </View>
        ) : isBlank ? (
          <Text
            style={{
              paddingVertical: 40,
              textAlign: "center",
              fontSize: 14,
              color: "#6b6259",
            }}
          >
            {SEARCH_MESSAGES.emptyQuery}
          </Text>
        ) : vm.rows.length === 0 ? (
          <Text
            style={{
              paddingVertical: 40,
              textAlign: "center",
              fontSize: 14,
              color: "#6b6259",
            }}
          >
            {SEARCH_MESSAGES.noHits}
          </Text>
        ) : (
          <View accessibilityLabel="نتایج جست‌وجو" style={{ borderTopWidth: 1, borderTopColor: "#e7e2d8" }}>
            {vm.rows.map((row) => (
              <Pressable
                key={row.expenseId}
                accessibilityLabel={`ویرایش ${row.title}`}
                onPress={() => openEdit(row)}
                style={ledgerRow}
              >
                <View style={{ flex: 1, gap: 2, direction: 'ltr' }}>
                  <Text style={{ fontSize: 13.5, fontWeight: "700" }}>
                    {row.title}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: "#6b6259" }}>
                    {row.categoryName}
                    {row.eventTitle ? ` · ${row.eventTitle}` : ""} ·{" "}
                    {row.occurredLabel}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: "800" }}>
                    {row.amountLabel}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: "#6b6259" }}>
                    {row.monthLabel}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {sheet && data ? (
        <ExpenseSheetModal
          key={sheetKey}
          open={sheet}
          monthKey={sheetMonthKey ?? currentJalaliMonthKey()}
          categories={data.categories}
          events={data.events}
          onClose={closeSheet}
        />
      ) : null}
    </View>
  );
}

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
