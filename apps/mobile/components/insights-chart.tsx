// Insights line chart (expo-mobile ticket 12).
//
// A vertical port of the web MonthlyChart geometry (W/H, pads, X/Y scales,
// dashed overall-average reference, weighted monthly polyline, per-point
// values + month names): weighted monthly averages with the overall average
// as the reference and readable Persian values. Touch replaces hover —
// tapping a dot pins its readout. Pure react-native-svg (Expo Go + web
// safe); the points math lives in the tested insights core, this component
// only renders it.

import { useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { formatNumber } from "@spend-tracker/shared/format";
import {
  formatToman,
  jalaliMonthKeyLabel,
  jalaliMonthNameFromKey,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";
import { T as Text } from "./app-text";
import { View } from "react-native";
import type { ProductInsight } from "../src/insights";

const W = 560;
const H = 240;
const PAD_SIDE = 20;
const PAD_TOP = 26;
const PAD_BOTTOM = 34;

const INK = "#1c1a17";
const MUTED = "#6b6259";
const ACCENT = "#1a7a5c";
const PAPER = "#fffdf9";

export function InsightsChart({ product }: { product: ProductInsight }) {
  const { width: windowWidth } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  const buckets = product.monthly;

  const width = Math.max(windowWidth - 64, 280);
  const height = (width * H) / W;

  const vals = buckets.map((b) => b.avgUnitPrice);
  const min = Math.min(...vals, product.overallAvgUnit);
  const max = Math.max(...vals, product.overallAvgUnit);
  const span = Math.max(max - min, 1);
  const X = (i: number) =>
    vals.length === 1
      ? W / 2
      : PAD_SIDE + (i / (vals.length - 1)) * (W - PAD_SIDE * 2);
  const Y = (v: number) =>
    H - PAD_BOTTOM - ((v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);
  const readout = selected !== null ? (buckets[selected] ?? null) : null;

  return (
    <View style={{ gap: 4 }}>
      <Text
        accessibilityLiveRegion="polite"
        style={{ fontSize: 13, color: MUTED, minHeight: 20 }}
      >
        {readout
          ? `${jalaliMonthKeyLabel(readout.monthKey)} · ${formatToman(readout.avgUnitPrice)} · ${toPersianDigits(readout.count)} خرید`
          : "روی هر نقطه بزن تا میانگین آن ماه را ببینی"}
      </Text>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        accessibilityLabel={`میانگین ماهانه ${product.displayTitle}`}
      >
        <Line
          x1={PAD_SIDE}
          x2={W - PAD_SIDE}
          y1={Y(product.overallAvgUnit)}
          y2={Y(product.overallAvgUnit)}
          stroke={MUTED}
          strokeOpacity={0.5}
          strokeDasharray="6 5"
          strokeWidth={1.5}
        />
        <Polyline
          points={vals.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2.5}
        />
        {buckets.map((b, i) => {
          const above = i % 2 === 0;
          const active = selected === i;
          const dimmed = selected !== null && !active;
          return (
            <G key={b.monthKey}>
              <SvgText
                x={X(i)}
                y={Y(b.avgUnitPrice) + (above ? -12 : 20)}
                textAnchor="middle"
                fontSize={12}
                fontWeight="800"
                fill={INK}
              >
                {formatNumber(b.avgUnitPrice)}
              </SvgText>
              <SvgText
                x={X(i)}
                y={H - 10}
                textAnchor="middle"
                fontSize={10.5}
                fill={MUTED}
              >
                {jalaliMonthNameFromKey(b.monthKey)}
              </SvgText>
              <Circle
                cx={X(i)}
                cy={Y(b.avgUnitPrice)}
                r={16}
                fill="transparent"
                // onPress on expo web wires PanResponder props that react-dom
                // rejects ("Unknown event handler property
                // `onResponderTerminate'"): clicks on web, presses on native.
                {...(Platform.OS === "web"
                  ? { onClick: () => setSelected(active ? null : i) }
                  : { onPress: () => setSelected(active ? null : i) })}
              />
              <Circle
                cx={X(i)}
                cy={Y(b.avgUnitPrice)}
                r={active ? 7 : 4.5}
                fill={ACCENT}
                fillOpacity={dimmed ? 0.45 : 1}
                strokeWidth={2}
                stroke={active ? PAPER : "none"}
              />
            </G>
          );
        })}
        {readout && selected !== null ? (
          <G>
            {(() => {
              const boxW = 132;
              const boxH = 44;
              const bx = Math.min(
                Math.max(X(selected) - boxW / 2, 4),
                W - boxW - 4,
              );
              const by = Y(readout.avgUnitPrice) - boxH - 30;
              const ty = by < 4 ? Y(readout.avgUnitPrice) + 26 : by;
              return (
                <G>
                  <Rect x={bx} y={ty} width={boxW} height={boxH} rx={10} fill={INK} />
                  <SvgText
                    x={bx + boxW / 2}
                    y={ty + 19}
                    textAnchor="middle"
                    fontSize={15}
                    fontWeight="900"
                    fill={PAPER}
                  >
                    {formatNumber(readout.avgUnitPrice)}
                  </SvgText>
                  <SvgText
                    x={bx + boxW / 2}
                    y={ty + 35}
                    textAnchor="middle"
                    fontSize={11}
                    fill={PAPER}
                    opacity={0.75}
                  >
                    {`${jalaliMonthKeyLabel(readout.monthKey)} · ${toPersianDigits(readout.count)} خرید`}
                  </SvgText>
                </G>
              );
            })()}
          </G>
        ) : null}
      </Svg>
      <Text style={{ fontSize: 11.5, color: MUTED }}>
        هر نقطه میانگین وزنی یک ماه است · خط‌چین میانگین کل
      </Text>
    </View>
  );
}
