// Categories list (expo-mobile ticket 04): full management with usage
// counts, creation with a color swatch, rename including system rows,
// reordering, and guarded deletion via move-expenses. Each row links to its
// stack drilldown (back keeps context). Reads go through the typed v1 client
// (the frozen API); every mutation invalidates the category and dashboard
// scopes (no restart). Web parity: categories/page.tsx + manager island.
//
// Frozen-API note: خرج counts are per-month (from the month summary — the
// API exposes no all-time GROUP-BY read) and say so; الگو counts are
// all-time, grouped client-side from the templates list.

import { useState } from "react";
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
import { Link } from "expo-router";
import { currentJalaliMonthKey } from "@spend-tracker/shared/jalali";
import type {
  CategoryDto,
  MonthSummaryDto,
  RecurringTemplateDto,
} from "@spend-tracker/shared/schemas/api";
import { useSession } from "../../src/session";
import { INPUT_FONT_STYLE } from "../../components/app-text";
import {
  CATEGORY_MESSAGES,
  MOBILE_CATEGORY_SWATCHES,
  buildCategoryListViewModel,
  countTemplatesByCategory,
  createCategory,
  moveCategoryExpensesThenRemove,
  moveTitleFor,
  removeCategory,
  renameCategory,
  reorderCategory,
  reorderPlan,
  validateCategoryName,
  type CategoryRow,
} from "../../src/categories";
import {
  affectedScopesForCategoryMutation,
  categoriesKey,
  invalidateCategoryScopes,
  loadCategoriesScreen,
} from "../../src/category-queries";

export default function CategoriesScreen() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [monthKey] = useState(() => currentJalaliMonthKey());
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(MOBILE_CATEGORY_SWATCHES[0]!.hex);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(MOBILE_CATEGORY_SWATCHES[0]!.hex);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screen = useQuery({
    queryKey: [...categoriesKey(), monthKey],
    queryFn: () =>
      loadCategoriesScreen(api, monthKey) as Promise<{
        categories: CategoryDto[];
        templates: RecurringTemplateDto[];
        summary: MonthSummaryDto;
      }>,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    await invalidateCategoryScopes(
      queryClient,
      affectedScopesForCategoryMutation(),
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

  async function run(fn: () => Promise<void>, message: string = CATEGORY_MESSAGES.saveFailed) {
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
    ? buildCategoryListViewModel({
        categories: data.categories,
        expenseCounts: Object.fromEntries(
          data.summary.byCategory.map((r) => [r.categoryId, r.count]),
        ),
        templateCounts: countTemplatesByCategory(data.templates),
      })
    : null;

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Text style={{ fontSize: 20, fontWeight: "800" }}>دسته‌ها</Text>
        <Text style={{ fontSize: 12.5, color: "#6b6259" }}>
          {CATEGORY_MESSAGES.systemHint} شمار خرج‌ها برای ماه جاری است.
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
        ) : (
          <View style={{ borderTopWidth: 2, borderTopColor: "#1c1a17" }}>
            {vm.rows.map((row, index) => (
              <CategoryRowView
                key={row.id}
                row={row}
                siblings={vm.rows}
                index={index}
                pending={pending}
                editing={editingId === row.id}
                editName={editName}
                editColor={editColor}
                moving={movingId === row.id}
                moveTarget={moveTarget}
                confirming={confirmingId === row.id}
                onStartEdit={() => {
                  setEditingId(row.id);
                  setEditName(row.name);
                  setEditColor(row.color ?? MOBILE_CATEGORY_SWATCHES[0]!.hex);
                }}
                onCancelEdit={() => setEditingId(null)}
                onEditName={setEditName}
                onEditColor={setEditColor}
                onRename={() =>
                  void run(() =>
                    renameCategory(api, row.id, {
                      name: editName,
                      color: editColor,
                    }).then(() => setEditingId(null)),
                  )
                }
                onReorder={(delta) =>
                  void run(
                    async () => {
                      const plan = reorderPlan(vm.rows, index, delta);
                      if (!plan) return;
                      await reorderCategory(api, plan);
                      // No local swap: the refresh below refetches the true
                      // order, so a failed reorder never leaves the list lying.
                    },
                    CATEGORY_MESSAGES.reorderFailed,
                  )
                }
                onStartMove={() => {
                  setMovingId(row.id);
                  setMoveTarget(null);
                }}
                onCancelMove={() => setMovingId(null)}
                onPickTarget={setMoveTarget}
                onMoveAndRemove={() =>
                  void run(async () => {
                    if (moveTarget === null) return;
                    await moveCategoryExpensesThenRemove(api, row.id, moveTarget);
                    setMovingId(null);
                  })
                }
                onAskDelete={() => setConfirmingId(row.id)}
                onCancelDelete={() => setConfirmingId(null)}
                onDelete={() =>
                  void run(() =>
                    removeCategory(api, row.id).then(() => setConfirmingId(null)),
                  )
                }
              />
            ))}
          </View>
        )}

        {error ? (
          <Text accessibilityRole="alert" style={{ fontSize: 13, color: "#b3261e" }}>
            {error}
          </Text>
        ) : null}

        {formOpen ? (
          <View style={{ borderTopWidth: 1, borderTopColor: "#e7e2d8", paddingTop: 12, gap: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: "700" }}>نام دسته</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="مثلاً ورزش"
              style={inputStyle}
            />
            <View
              role="radiogroup"
              aria-label="رنگ دسته"
              style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
            >
              {MOBILE_CATEGORY_SWATCHES.map((swatch) => (
                <Pressable
                  key={swatch.hex}
                  accessibilityLabel={swatch.name}
                  role="radio"
                  aria-checked={color === swatch.hex}
                  onPress={() => setColor(swatch.hex)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: swatch.hex,
                    borderWidth: 2,
                    borderColor: color === swatch.hex ? "#1c1a17" : "transparent",
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setFormOpen(false)} style={ghostButton}>
                <Text>انصراف</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void run(() =>
                    createCategory(api, { name, color }).then(() => {
                      setFormOpen(false);
                      setName("");
                      setColor(MOBILE_CATEGORY_SWATCHES[0]!.hex);
                    }),
                  )
                }
                disabled={!validateCategoryName(name) || pending}
                style={[primaryButton, { opacity: validateCategoryName(name) ? 1 : 0.6 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>افزودن</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="افزودن دسته"
            onPress={() => setFormOpen(true)}
            style={dashedButton}
          >
            <Text style={{ color: "#1a7a5c", fontWeight: "800" }}>+ افزودن دسته</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function CategoryRowView({
  row,
  siblings,
  index,
  pending,
  editing,
  editName,
  editColor,
  moving,
  moveTarget,
  confirming,
  onStartEdit,
  onCancelEdit,
  onEditName,
  onEditColor,
  onRename,
  onReorder,
  onStartMove,
  onCancelMove,
  onPickTarget,
  onMoveAndRemove,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  row: CategoryRow;
  siblings: CategoryRow[];
  index: number;
  pending: boolean;
  editing: boolean;
  editName: string;
  editColor: string;
  moving: boolean;
  moveTarget: string | null;
  confirming: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditName: (v: string) => void;
  onEditColor: (hex: string) => void;
  onRename: () => void;
  onReorder: (delta: -1 | 1) => void;
  onStartMove: () => void;
  onCancelMove: () => void;
  onPickTarget: (id: string) => void;
  onMoveAndRemove: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  if (editing) {
    return (
      <View style={[rowStyle, { flexDirection: "column", alignItems: "stretch" }]}>
        <TextInput
          aria-label="نام دسته"
          value={editName}
          onChangeText={onEditName}
          style={inputStyle}
        />
        <View
          role="radiogroup"
          aria-label="رنگ دسته"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
        >
          {MOBILE_CATEGORY_SWATCHES.map((swatch) => (
            <Pressable
              key={swatch.hex}
              accessibilityLabel={swatch.name}
              role="radio"
              aria-checked={editColor === swatch.hex}
              onPress={() => onEditColor(swatch.hex)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: swatch.hex,
                borderWidth: 2,
                borderColor: editColor === swatch.hex ? "#1c1a17" : "transparent",
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={onCancelEdit} style={ghostButton}>
            <Text>انصراف</Text>
          </Pressable>
          <Pressable
            onPress={onRename}
            disabled={!validateCategoryName(editName) || pending}
            style={primaryButton}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>ذخیره</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (moving) {
    return (
      <View style={[rowStyle, { flexDirection: "column", alignItems: "stretch" }]}>
        <Text style={{ fontSize: 13.5 }}>{moveTitleFor(row.name)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {siblings
            .filter((s) => s.id !== row.id)
            .map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onPickTarget(s.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: moveTarget === s.id ? "#1a7a5c" : "#d8d3c8",
                  backgroundColor: moveTarget === s.id ? "#e4f0e9" : "#fff",
                }}
              >
                <Text style={{ fontSize: 13 }}>{s.name}</Text>
              </Pressable>
            ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={onCancelMove} style={ghostButton}>
            <Text>انصراف</Text>
          </Pressable>
          <Pressable
            onPress={onMoveAndRemove}
            disabled={moveTarget === null || pending}
            style={dangerButton}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>انتقال و حذف</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (confirming) {
    return (
      <View style={rowStyle}>
        <Text style={{ flex: 1, fontSize: 13.5, color: "#6b6259" }}>
          {row.name} {CATEGORY_MESSAGES.deleteConfirm.replace("این دسته ", "")}
        </Text>
        <Pressable onPress={onCancelDelete} style={ghostButton}>
          <Text>انصراف</Text>
        </Pressable>
        <Pressable onPress={onDelete} disabled={pending} style={dangerButton}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>حذف</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={rowStyle}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: row.color ?? "#82887e",
        }}
      />
      <Link href={row.drilldown as "/category/[id]"} asChild>
        <Pressable style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 14.5, fontWeight: "700" }}>{row.name}</Text>
          <Text style={{ fontSize: 12, color: "#6b6259" }}>{row.usageLabel}</Text>
          {row.deleteHint ? (
            <Text style={{ fontSize: 11.5, color: "#6b6259" }}>{row.deleteHint}</Text>
          ) : null}
        </Pressable>
      </Link>
      <Pressable
        accessibilityLabel={`${row.name} به بالا`}
        disabled={index === 0 || pending}
        onPress={() => onReorder(-1)}
        style={{ paddingHorizontal: 2, opacity: index === 0 ? 0.3 : 1 }}
      >
        <Text>↑</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`${row.name} به پایین`}
        disabled={index === siblings.length - 1 || pending}
        onPress={() => onReorder(1)}
        style={{ paddingHorizontal: 2, opacity: index === siblings.length - 1 ? 0.3 : 1 }}
      >
        <Text>↓</Text>
      </Pressable>
      <Pressable onPress={onStartEdit}>
        <Text style={{ fontSize: 12.5, color: "#1a7a5c" }}>ویرایش</Text>
      </Pressable>
      {row.deleteState.kind === "allowed" ? (
        <Pressable onPress={onAskDelete}>
          <Text style={{ fontSize: 12.5, color: "#b3261e" }}>حذف</Text>
        </Pressable>
      ) : row.deleteState.kind === "needs-move" ? (
        <>
          <Text
            accessibilityLabel="حذف غیرفعال: دستهٔ پُر"
            style={{ fontSize: 12.5, color: "#6b6259", opacity: 0.6 }}
          >
            حذف
          </Text>
          <Pressable onPress={onStartMove}>
            <Text style={{ fontSize: 12.5, color: "#1a7a5c" }}>انتقال همهٔ خرج‌ها</Text>
          </Pressable>
        </>
      ) : row.deleteState.kind === "blocked-template" ? (
        <Text
          accessibilityLabel="حذف غیرفعال: الگوی تکرار به این دسته اشاره می‌کند"
          style={{ fontSize: 12.5, color: "#6b6259", opacity: 0.6 }}
        >
          حذف
        </Text>
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
