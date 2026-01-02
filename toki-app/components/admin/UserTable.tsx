/**
 * UserTable - Tableau de données utilisateurs avec tri et filtres
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { Colors } from '../../constants/theme';
import { UserKPI } from '../../lib/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export type SortField = 'email' | 'createdAt' | 'totalMeals' | 'currentStreak' | 'lastActivityDate';
export type SortDirection = 'asc' | 'desc';

export interface UserTableProps {
  data: UserKPI[];
  onRowPress?: (userKPI: UserKPI) => void;
  sortable?: boolean;
}

export function UserTable({ data, onRowPress, sortable = true }: UserTableProps) {
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedData = useMemo(() => {
    if (!sortable) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'email':
          aValue = a.user.email || '';
          bValue = b.user.email || '';
          break;
        case 'createdAt':
          aValue = new Date(a.user.createdAt || 0).getTime();
          bValue = new Date(b.user.createdAt || 0).getTime();
          break;
        case 'totalMeals':
          aValue = a.stats.totalMeals;
          bValue = b.stats.totalMeals;
          break;
        case 'currentStreak':
          aValue = a.stats.currentStreak;
          bValue = b.stats.currentStreak;
          break;
        case 'lastActivityDate':
          aValue = a.stats.lastActivityDate 
            ? new Date(a.stats.lastActivityDate).getTime() 
            : 0;
          bValue = b.stats.lastActivityDate 
            ? new Date(b.stats.lastActivityDate).getTime() 
            : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortDirection, sortable]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <Card variant="elevated" padding="none" style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.headerCell, styles.emailCell]}
              onPress={() => sortable && handleSort('email')}
              disabled={!sortable}
            >
              <Text style={[styles.headerText, { color: colors.text }]}>
                Email {sortable && getSortIcon('email')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.dateCell]}
              onPress={() => sortable && handleSort('createdAt')}
              disabled={!sortable}
            >
              <Text style={[styles.headerText, { color: colors.text }]}>
                Créé {sortable && getSortIcon('createdAt')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.statsCell]}
              onPress={() => sortable && handleSort('totalMeals')}
              disabled={!sortable}
            >
              <Text style={[styles.headerText, { color: colors.text }]}>
                Repas {sortable && getSortIcon('totalMeals')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.statsCell]}
              onPress={() => sortable && handleSort('currentStreak')}
              disabled={!sortable}
            >
              <Text style={[styles.headerText, { color: colors.text }]}>
                Streak {sortable && getSortIcon('currentStreak')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.dateCell]}
              onPress={() => sortable && handleSort('lastActivityDate')}
              disabled={!sortable}
            >
              <Text style={[styles.headerText, { color: colors.text }]}>
                Dernière activité {sortable && getSortIcon('lastActivityDate')}
              </Text>
            </TouchableOpacity>
            <View style={[styles.headerCell, styles.subscriptionCell]}>
              <Text style={[styles.headerText, { color: colors.text }]}>Abonnement</Text>
            </View>
          </View>

          {/* Rows */}
          <ScrollView style={styles.body}>
            {sortedData.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={[styles.emptyText, { color: colors.icon }]}>
                  Aucun utilisateur trouvé
                </Text>
              </View>
            ) : (
              sortedData.map((userKPI, index) => (
                <TouchableOpacity
                  key={userKPI.user.userId || index}
                  style={[
                    styles.row,
                    index % 2 === 0 && { backgroundColor: colors.surface },
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => onRowPress?.(userKPI)}
                  disabled={!onRowPress}
                >
                  <View style={[styles.cell, styles.emailCell]}>
                    <Text style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                      {userKPI.user.email || 'N/A'}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.dateCell]}>
                    <Text style={[styles.cellText, { color: colors.icon }]}>
                      {formatDate(userKPI.user.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.statsCell]}>
                    <Text style={[styles.cellText, { color: colors.text }]}>
                      {userKPI.stats.totalMeals}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.statsCell]}>
                    <Text style={[styles.cellText, { color: colors.text }]}>
                      {userKPI.stats.currentStreak}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.dateCell]}>
                    <Text style={[styles.cellText, { color: colors.icon }]}>
                      {formatDate(userKPI.stats.lastActivityDate)}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.subscriptionCell]}>
                    {userKPI.user.subscription ? (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor:
                              userKPI.user.subscription.status === 'active'
                                ? colors.success
                                : userKPI.user.subscription.status === 'trialing'
                                ? colors.warning
                                : colors.error,
                          },
                        ]}
                      >
                        <Text style={styles.badgeText}>
                          {userKPI.user.subscription.tier === 'paid' ? '💰' : '🧪'}{' '}
                          {userKPI.user.subscription.status}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.cellText, { color: colors.icon }]}>-</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 600,
  },
  header: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerCell: {
    paddingHorizontal: 8,
    minWidth: 100,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  body: {
    maxHeight: 500,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  cell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    minWidth: 100,
  },
  cellText: {
    fontSize: 13,
  },
  emailCell: {
    minWidth: 180,
    maxWidth: 180,
  },
  dateCell: {
    minWidth: 120,
  },
  statsCell: {
    minWidth: 80,
    alignItems: 'center',
  },
  subscriptionCell: {
    minWidth: 140,
  },
  emptyRow: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
