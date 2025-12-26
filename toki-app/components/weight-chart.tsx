import React, { useState } from 'react';
import { View, LayoutChangeEvent, StyleSheet } from 'react-native';

type Props = {
  values: number[]; // in kg
  labels?: string[]; // optional date labels aligned with values
  height?: number;
  color?: string;
  axisColor?: string;
};

export function WeightChart({ values, labels = [], height = 140, color = '#3b82f6', axisColor = '#9ca3af' }: Props) {
  const [width, setWidth] = useState(0);
  const padding = 12;
  const contentWidth = Math.max(0, width - padding * 2);
  const contentHeight = Math.max(0, height - padding * 2);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = Math.max(0.1, max - min);
  const mid = min + range / 2;

  const xStep = values.length > 1 ? contentWidth / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = padding + i * xStep;
    const y = padding + (contentHeight - ((v - min) / range) * contentHeight);
    return { x, y };
  });

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {/* Axes */}
      <View style={[styles.axisLine, { left: padding, top: padding, height: contentHeight, backgroundColor: axisColor }]} />
      <View style={[styles.axisLine, { left: padding, top: padding + contentHeight, width: contentWidth, height: 2, backgroundColor: axisColor }]} />

      {/* Y ticks and labels (min/mid/max) */}
      {(() => {
        const ticks = [max, mid, min];
        return ticks.map((val, idx) => {
          const y = padding + (contentHeight - ((val - min) / range) * contentHeight);
          return (
            <React.Fragment key={`yt-${idx}`}>
              <View style={{ position: 'absolute', left: padding - 4, top: y - 1, width: 4, height: 2, backgroundColor: axisColor }} />
              <View style={{ position: 'absolute', left: 0, top: y - 8, width: padding - 6, alignItems: 'flex-end' }}>
                {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                {/* @ts-ignore */}
                <TextLike value={`${val.toFixed(1)}`} color={axisColor} align="right" />
              </View>
            </React.Fragment>
          );
        });
      })()}

      {/* Line segments */}
      {points.length >= 2 && points.map((p1, i) => {
        if (i === points.length - 1) return null;
        const p2 = points[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        return (
          <View
            key={`seg-${i}`}
            style={{
              position: 'absolute',
              left: midX - len / 2,
              top: midY,
              width: len,
              height: 2,
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }, { translateY: -1 }],
            }}
          />
        );
      })}

      {/* Points */}
      {points.map((p, i) => (
        <View key={`pt-${i}`} style={[styles.point, { left: p.x - 3, top: p.y - 3, backgroundColor: color }]} />
      ))}

      {/* X labels: first, middle, last if provided */}
      {labels.length > 0 && (
        <>
          {(() => {
            const indices = [0, Math.floor(labels.length / 2), labels.length - 1];
            return indices.map((idx, i) => {
              const x = padding + (idx / Math.max(1, labels.length - 1)) * contentWidth;
              const lbl = (labels[idx] || '').slice(5, 10); // show MM-DD
              return (
                <View key={`xl-${i}`} style={{ position: 'absolute', left: x - 16, top: padding + contentHeight + 6 }}>
                  {/* @ts-ignore */}
                  <TextLike value={lbl} color={axisColor} />
                </View>
              );
            });
          })()}
        </>
      )}
    </View>
  );
}

// Lightweight text-like element using View+data for RN/Web consistency
function TextLike({ value, color, align = 'left' }: { value: string; color: string; align?: 'left' | 'right' }) {
  return <View style={{ minWidth: 1, minHeight: 1 }} aria-label={value}><span style={{ color, fontSize: 10, position: 'relative', textAlign: align, display: 'inline-block', minWidth: 26 }}>{value}</span></View> as any;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  axisLine: {
    position: 'absolute',
    width: 2,
  },
  point: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
