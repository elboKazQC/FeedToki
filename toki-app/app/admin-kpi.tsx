/**
 * Admin KPI Dashboard - Système complet de KPI pour gérer toutes les informations des utilisateurs
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { checkIsAdmin } from '../lib/admin-utils';
import {
  fetchAllUsers,
  fetchUserKPI,
  calculateGlobalKPIs,
  filterUserKPIs,
  exportToCSV,
  exportToJSON,
} from '../lib/admin-kpi-utils';
import { UserKPI, GlobalKPIs, KPIFilter } from '../lib/types';
import { KPICard } from '../components/admin/KPICard';
import { KPIGraph, GraphDataPoint } from '../components/admin/KPIGraph';
import { UserTable } from '../components/admin/UserTable';
import { Button } from '../components/ui/Button';

type TabType = 'dashboard' | 'users' | 'engagement' | 'subscriptions' | 'usage';

export default function AdminKPIScreen() {
  const { profile, user } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  const colorValue = (c: any): string => (typeof c === 'string' ? c : (c && typeof c.primary === 'string' ? c.primary : String(c)) );

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [userKPIs, setUserKPIs] = useState<UserKPI[]>([]);
  const [globalKPIs, setGlobalKPIs] = useState<GlobalKPIs | null>(null);
  const [filteredKPIs, setFilteredKPIs] = useState<UserKPI[]>([]);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<KPIFilter>({});

  const userEmail = profile?.email || (user as any)?.email || '';
  const isAdmin = checkIsAdmin(user, profile);

  // Charger les données
  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Charger tous les utilisateurs
      const allUsers = await fetchAllUsers();
      setUsers(allUsers);

      // Charger les KPI pour chaque utilisateur (par batch pour performance)
      const kpis: UserKPI[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < allUsers.length; i += batchSize) {
        const batch = allUsers.slice(i, i + batchSize);
        const batchKPIs = await Promise.all(
          batch.map(u => fetchUserKPI(u.userId || '', u))
        );
        kpis.push(...batchKPIs);
      }

      setUserKPIs(kpis);

      // Calculer les KPI globaux
      const global = await calculateGlobalKPIs(allUsers, kpis);
      setGlobalKPIs(global);
    } catch (error) {
      console.error('[Admin KPI] Erreur chargement données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données KPI.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  // Appliquer les filtres
  useEffect(() => {
    const newFilter: KPIFilter = {
      ...filter,
      searchQuery: searchQuery || undefined,
    };
    const filtered = filterUserKPIs(userKPIs, newFilter);
    setFilteredKPIs(filtered);
  }, [userKPIs, filter, searchQuery]);

  // Préparer les données pour les graphiques (AVANT tout return conditionnel)
  const usersOverTimeData: GraphDataPoint[] = useMemo(() => {
    if (!globalKPIs) return [];
    return globalKPIs.usersOverTime.map(item => ({
      label: new Date(item.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      value: item.count,
    }));
  }, [globalKPIs]);

  const newUsersByDayData: GraphDataPoint[] = useMemo(() => {
    if (!globalKPIs) return [];
    return globalKPIs.newUsersByDay.slice(-14).map(item => ({
      label: new Date(item.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      value: item.count,
    }));
  }, [globalKPIs]);

  const weightGoalsData: GraphDataPoint[] = useMemo(() => {
    const goals: Record<string, number> = {};
    userKPIs.forEach(kpi => {
      const goal = kpi.user.weightGoal || 'unknown';
      goals[goal] = (goals[goal] || 0) + 1;
    });
    return Object.entries(goals).map(([label, value]) => ({
      label: label === 'maintenance' ? 'Maintien' : label === 'lose-1lb' ? '-1lb/sem' : label === 'lose-2lb' ? '-2lb/sem' : label === 'lose-3lb' ? '-3lb/sem' : label,
      value,
    }));
  }, [userKPIs]);

  const subscriptionStatusData: GraphDataPoint[] = useMemo(() => {
    const statuses: Record<string, number> = {};
    userKPIs.forEach(kpi => {
      const status = kpi.user.subscription?.status || 'none';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    return Object.entries(statuses).map(([label, value]) => ({
      label: label === 'active' ? 'Actif' : label === 'trialing' ? 'Essai' : label === 'past_due' ? 'En retard' : label === 'canceled' ? 'Annulé' : 'Aucun',
      value,
    }));
  }, [userKPIs]);


  // Vérifier si admin (APRÈS tous les hooks)
  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={styles.accessDeniedEmoji}>🔒</Text>
        <Text style={[styles.accessDeniedText, { color: colors.text.primary }]}>
          Accès réservé aux administrateurs
        </Text>
        <TouchableOpacity style={styles.backButtonCentered} onPress={() => router.back()}>
          <Text style={styles.backButtonCenteredText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleExport = (format: 'csv' | 'json') => {
    const data = filteredKPIs.map(kpi => ({
      email: kpi.user.email,
      displayName: kpi.user.displayName,
      createdAt: kpi.user.createdAt,
      onboardingCompleted: kpi.stats.onboardingCompleted,
      weightGoal: kpi.user.weightGoal,
      subscription: kpi.user.subscription?.tier || 'none',
      subscriptionStatus: kpi.user.subscription?.status || 'none',
      totalMeals: kpi.stats.totalMeals,
      activeDays: kpi.stats.activeDays,
      currentStreak: kpi.stats.currentStreak,
      longestStreak: kpi.stats.longestStreak,
      lastActivityDate: kpi.stats.lastActivityDate,
      currentPointsBalance: kpi.stats.currentPointsBalance,
      totalPointsEarned: kpi.stats.totalPointsEarned,
      customFoodsCount: kpi.stats.customFoodsCount,
      aiLogsCount: kpi.stats.aiLogsCount,
      averageParsingTimeMs: kpi.stats.averageParsingTimeMs || 0,
      totalParsingTimeMs: kpi.stats.totalParsingTimeMs || 0,
      averageSessionsPerDay: kpi.stats.averageSessionsPerDay || 0,
      totalSessions: kpi.stats.totalSessions || 0,
    }));

    const filename = `feedtoki-kpi-${new Date().toISOString().split('T')[0]}.${format}`;
    
    if (format === 'csv') {
      exportToCSV(data, filename);
    } else {
      exportToJSON(data, filename);
    }

    Alert.alert('✅ Export réussi', `Les données ont été exportées dans ${filename}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text.primary }]}>Chargement des KPI...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: colors.tint }]}>← Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>📊 Dashboard KPI</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.refreshButtonText, { color: colors.primary }]}>🔄</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border }]}>
        {(['dashboard', 'users', 'engagement', 'subscriptions', 'usage'] as TabType[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.icon },
              ]}
            >
              {tab === 'dashboard' ? '📊 Dashboard' :
               tab === 'users' ? '👥 Utilisateurs' :
               tab === 'engagement' ? '🔥 Engagement' :
               tab === 'subscriptions' ? '💰 Abonnements' :
               '📈 Usage'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' && globalKPIs && (
          <View style={styles.dashboard}>
            {/* KPI Cards */}
            <View style={styles.kpiGrid}>
              <KPICard
                title="Total Utilisateurs"
                value={globalKPIs.totalUsers}
                icon="👥"
              />
              <KPICard
                title="Actifs (7j)"
                value={globalKPIs.activeUsers7d}
                subtitle={`${globalKPIs.activeUsers30d} actifs (30j)`}
                icon="🔥"
              />
              <KPICard
                title="Nouveaux (7j)"
                value={globalKPIs.newUsers7d}
                subtitle={`${globalKPIs.newUsers30d} nouveaux (30j)`}
                icon="✨"
              />
              <KPICard
                title="Rétention J7"
                value={`${globalKPIs.retentionRate7d}%`}
                subtitle={`J30: ${globalKPIs.retentionRate30d}%`}
                icon="📈"
              />
              <KPICard
                title="Abonnements Actifs"
                value={globalKPIs.activeSubscriptions}
                subtitle={`${globalKPIs.paidSubscriptions} payants`}
                icon="💰"
              />
              <KPICard
                title="MRR"
                value={`$${globalKPIs.mrr.toFixed(2)}`}
                subtitle={`${globalKPIs.conversionRate}% conversion`}
                icon="💵"
              />
              <KPICard
                title="Total Repas"
                value={globalKPIs.totalMeals}
                subtitle={`${globalKPIs.averageMealsPerDay.toFixed(1)} repas/jour moyen`}
                icon="🍽️"
              />
              <KPICard
                title="Streak Moyen"
                value={globalKPIs.averageStreak}
                subtitle={`${globalKPIs.averageActiveDays.toFixed(1)} jours actifs moyen`}
                icon="🔥"
              />
              <KPICard
                title="Temps Parsing Moyen"
                value={globalKPIs.averageParsingTimeMs > 0 ? `${(globalKPIs.averageParsingTimeMs / 1000).toFixed(1)}s` : 'N/A'}
                subtitle="Temps moyen pour parser un repas"
                icon="⏱️"
              />
              <KPICard
                title="Sessions/Jour Moyen"
                value={globalKPIs.averageSessionsPerDay.toFixed(1)}
                subtitle="Moyenne de connexions par jour"
                icon="📱"
              />
            </View>

            {/* Graphs */}
            <KPIGraph
              title="Évolution des Utilisateurs"
              type="line"
              data={usersOverTimeData}
            />
            <KPIGraph
              title="Nouveaux Utilisateurs (14 derniers jours)"
              type="bar"
              data={newUsersByDayData}
            />
            <KPIGraph
              title="Répartition des Objectifs Poids"
              type="pie"
              data={weightGoalsData}
            />
            <KPIGraph
              title="Statuts d'Abonnement"
              type="pie"
              data={subscriptionStatusData}
            />
          </View>
        )}

        {activeTab === 'users' && (
          <View style={styles.tableView}>
            <View style={styles.filters}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.text.primary, borderColor: colors.border }]}
                placeholder="Rechercher par email..."
                placeholderTextColor={colors.icon}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <View style={styles.exportButtons}>
                <Button
                  label="Export CSV"
                  onPress={() => handleExport('csv')}
                  variant="secondary"
                  size="small"
                />
                <View style={{ width: 8 }} />
                <Button
                  label="Export JSON"
                  onPress={() => handleExport('json')}
                  variant="secondary"
                  size="small"
                />
              </View>
            </View>
            <UserTable data={filteredKPIs} />
            <Text style={[styles.countText, { color: colors.icon }]}>
              {filteredKPIs.length} utilisateur{filteredKPIs.length !== 1 ? 's' : ''} affiché{filteredKPIs.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {activeTab === 'engagement' && (
          <View style={styles.tableView}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Utilisateurs par Engagement</Text>
            <UserTable
              data={[...filteredKPIs].sort((a, b) => b.stats.currentStreak - a.stats.currentStreak).slice(0, 50)}
            />
          </View>
        )}

        {activeTab === 'subscriptions' && (
          <View style={styles.tableView}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Abonnements</Text>
            <UserTable
              data={filteredKPIs.filter(kpi => kpi.user.subscription)}
            />
          </View>
        )}

        {activeTab === 'usage' && (
          <View style={styles.tableView}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Usage et Points</Text>
            <UserTable
              data={[...filteredKPIs].sort((a, b) => b.stats.totalPointsEarned - a.stats.totalPointsEarned)}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: 60,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  dashboard: {
    padding: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  tableView: {
    padding: 16,
  },
  filters: {
    marginBottom: 16,
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  exportButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  countText: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  accessDeniedEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  accessDeniedText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 24,
  },
  backButtonCentered: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonCenteredText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
