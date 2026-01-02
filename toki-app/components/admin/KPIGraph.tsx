/**
 * KPIGraph - Composant de graphique simple pour les KPI
 * Supporte les graphiques en ligne, barres et camembert
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { Colors } from '../../constants/theme';
import { Card } from '../ui/Card';

export type GraphType = 'line' | 'bar' | 'pie';

export interface GraphDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface KPIGraphProps {
  title: string;
  type: GraphType;
  data: GraphDataPoint[];
  height?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_WIDTH = SCREEN_WIDTH - 80; // Padding
const DEFAULT_HEIGHT = 200;

export function KPIGraph({ title, type, data, height = DEFAULT_HEIGHT }: KPIGraphProps) {
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];

  if (data.length === 0) {
    return (
      <Card variant="elevated" padding="md" style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={[styles.emptyState, { height }]}>
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            Aucune donnée disponible
          </Text>
        </View>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card variant="elevated" padding="md" style={styles.card}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={[styles.graphContainer, { height }]}>
        {type === 'line' && <LineGraph data={data} maxValue={maxValue} colors={colors} />}
        {type === 'bar' && <BarGraph data={data} maxValue={maxValue} colors={colors} />}
        {type === 'pie' && <PieGraph data={data} totalValue={totalValue} colors={colors} />}
      </View>
      <View style={styles.legend}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: item.color || getColorForIndex(index, colors) },
              ]}
            />
            <Text style={[styles.legendLabel, { color: colors.text }]}>
              {item.label}: {item.value.toLocaleString('fr-FR')}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function LineGraph({
  data,
  maxValue,
  colors,
}: {
  data: GraphDataPoint[];
  maxValue: number;
  colors: any;
}) {
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1 || 1)) * GRAPH_WIDTH;
    const y = height - (item.value / maxValue) * (height - 40);
    return { x, y, value: item.value };
  });

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <View style={styles.lineGraphContainer}>
      <View style={styles.lineGraph}>
        {/* Lignes de grille */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <View
            key={i}
            style={[
              styles.gridLine,
              {
                top: ratio * (height - 40),
                borderColor: colors.border,
              },
            ]}
          />
        ))}
        {/* Ligne du graphique - version simplifiée avec View */}
        <View style={styles.linePath}>
          {points.map((point, index) => (
            <View
              key={index}
              style={[
                styles.linePoint,
                {
                  left: point.x - 4,
                  top: point.y - 4,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          ))}
        </View>
        {/* Labels X */}
        <View style={styles.xLabels}>
          {data.map((item, index) => (
            <Text
              key={index}
              style={[
                styles.xLabel,
                {
                  left: (index / (data.length - 1 || 1)) * GRAPH_WIDTH - 20,
                  color: colors.icon,
                },
              ]}
            >
              {item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function BarGraph({
  data,
  maxValue,
  colors,
}: {
  data: GraphDataPoint[];
  maxValue: number;
  colors: any;
}) {
  const barWidth = (GRAPH_WIDTH - (data.length - 1) * 8) / data.length;

  return (
    <View style={styles.barGraphContainer}>
      <View style={styles.barGraph}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 60);
          return (
            <View key={index} style={styles.barGroup}>
              <View
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height: barHeight,
                    backgroundColor: item.color || getColorForIndex(index, colors),
                  },
                ]}
              />
              <Text
                style={[
                  styles.barValue,
                  {
                    color: colors.text,
                    fontSize: barWidth < 30 ? 8 : 10,
                  },
                ]}
              >
                {item.value}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PieGraph({
  data,
  totalValue,
  colors,
}: {
  data: GraphDataPoint[];
  totalValue: number;
  colors: any;
}) {
  // Version simplifiée : afficher les segments comme des barres horizontales
  return (
    <View style={styles.pieGraphContainer}>
      {data.map((item, index) => {
        const percentage = (item.value / totalValue) * 100;
        return (
          <View key={index} style={styles.pieSegment}>
            <View style={styles.pieSegmentBar}>
              <View
                style={[
                  styles.pieSegmentFill,
                  {
                    width: `${percentage}%`,
                    backgroundColor: item.color || getColorForIndex(index, colors),
                  },
                ]}
              />
            </View>
            <Text style={[styles.pieSegmentLabel, { color: colors.text }]}>
              {item.label}: {percentage.toFixed(1)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function getColorForIndex(index: number, colors: any): string {
  const colorPalette = [
    colors.primary,
    colors.secondary,
    colors.success,
    colors.warning,
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f59e0b', // Amber
  ];
  return colorPalette[index % colorPalette.length];
}

const height = DEFAULT_HEIGHT;

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  graphContainer: {
    width: '100%',
    marginBottom: 12,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  legend: {
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 12,
  },
  // Line graph styles
  lineGraphContainer: {
    width: '100%',
    height: '100%',
  },
  lineGraph: {
    width: GRAPH_WIDTH,
    height: '100%',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  linePath: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  linePoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  xLabels: {
    position: 'absolute',
    bottom: -20,
    width: '100%',
    height: 20,
  },
  xLabel: {
    position: 'absolute',
    fontSize: 10,
    width: 40,
    textAlign: 'center',
  },
  // Bar graph styles
  barGraphContainer: {
    width: '100%',
    height: '100%',
  },
  barGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingBottom: 40,
  },
  barGroup: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 4,
    marginBottom: 4,
  },
  barValue: {
    marginTop: 4,
    textAlign: 'center',
  },
  // Pie graph styles
  pieGraphContainer: {
    width: '100%',
  },
  pieSegment: {
    marginBottom: 12,
  },
  pieSegmentBar: {
    height: 20,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  pieSegmentFill: {
    height: '100%',
    borderRadius: 10,
  },
  pieSegmentLabel: {
    fontSize: 12,
  },
});
