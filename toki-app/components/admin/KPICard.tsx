/**
 * KPICard - Carte de métrique KPI avec valeur, label et variation optionnelle
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { Colors } from '../../constants/theme';
import { Card } from '../ui/Card';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number; // Variation en pourcentage
    label?: string;
  };
  icon?: string;
}

export function KPICard({ title, value, subtitle, trend, icon }: KPICardProps) {
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];

  const trendColor = trend && trend.value > 0 
    ? colors.success 
    : trend && trend.value < 0 
    ? colors.error 
    : colors.icon;

  const trendIcon = trend && trend.value > 0 
    ? '↑' 
    : trend && trend.value < 0 
    ? '↓' 
    : '→';

  return (
    <Card variant="elevated" padding="md" style={styles.card}>
      <View style={styles.content}>
        {icon && (
          <Text style={[styles.icon, { color: colors.primary }]}>{icon}</Text>
        )}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.icon }]}>{title}</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.icon }]}>{subtitle}</Text>
          )}
          {trend && (
            <View style={styles.trend}>
              <Text style={[styles.trendText, { color: trendColor }]}>
                {trendIcon} {Math.abs(trend.value).toFixed(1)}%
              </Text>
              {trend.label && (
                <Text style={[styles.trendLabel, { color: colors.icon }]}>
                  {trend.label}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trendLabel: {
    fontSize: 11,
  },
});
