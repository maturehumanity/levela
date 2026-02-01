import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, endorsementsApi, evidenceApi } from '../services/api';
import { User, Endorsement, Evidence, Pillar, PILLAR_NAMES, PILLAR_ICONS } from '../types';
import UserAvatar from '../components/UserAvatar';
import ScoreDisplay from '../components/ScoreDisplay';
import Button from '../components/Button';
import { formatDate } from '../utils/format';

export default function ProfileScreen({ route, navigation }: any) {
  const { user: currentUser, logout } = useAuth();
  const userId = route.params?.userId || currentUser?.id;
  const isOwnProfile = userId === currentUser?.id;

  const [user, setUser] = useState<User | null>(null);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const userData = isOwnProfile ? await usersApi.getMe() : await usersApi.getUser(userId);
      setUser(userData);

      const [endorsementsData, evidenceData] = await Promise.all([
        endorsementsApi.getUserEndorsements(userId, selectedPillar || undefined),
        evidenceApi.getUserEvidence(userId, selectedPillar || undefined),
      ]);

      setEndorsements(endorsementsData.endorsements);
      setEvidence(evidenceData.evidence);
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.header}>
        <UserAvatar name={user.name} avatar_url={user.avatar_url} size={80} isVerified={!!user.is_verified} />
        <Text style={styles.name}>{user.name}</Text>
        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

        {isOwnProfile ? (
          <View style={styles.buttonRow}>
            <Button
              title="Edit Profile"
              onPress={() => navigation.navigate('EditProfile')}
              variant="outline"
              style={styles.actionButton}
            />
            <Button title="Logout" onPress={handleLogout} variant="secondary" style={styles.actionButton} />
          </View>
        ) : (
          <Button
            title="Endorse"
            onPress={() => navigation.navigate('Endorse', { userId: user.id, userName: user.name })}
            style={styles.endorseButton}
          />
        )}
      </View>

      {user.score && (
        <View style={styles.section}>
          <ScoreDisplay score={user.score} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Filter by Pillar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillarsScroll}>
          <TouchableOpacity
            style={[styles.pillarChip, !selectedPillar && styles.pillarChipActive]}
            onPress={() => {
              setSelectedPillar(null);
              loadProfile();
            }}
          >
            <Text style={[styles.pillarChipText, !selectedPillar && styles.pillarChipTextActive]}>All</Text>
          </TouchableOpacity>
          {Object.keys(PILLAR_NAMES).map((pillar) => (
            <TouchableOpacity
              key={pillar}
              style={[styles.pillarChip, selectedPillar === pillar && styles.pillarChipActive]}
              onPress={() => {
                setSelectedPillar(pillar as Pillar);
                loadProfile();
              }}
            >
              <Text style={styles.pillarChipIcon}>{PILLAR_ICONS[pillar as Pillar]}</Text>
              <Text style={[styles.pillarChipText, selectedPillar === pillar && styles.pillarChipTextActive]}>
                {PILLAR_NAMES[pillar as Pillar].split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Endorsements ({endorsements.length})</Text>
        {endorsements.length === 0 ? (
          <Text style={styles.emptyText}>No endorsements yet</Text>
        ) : (
          endorsements.map((endorsement) => (
            <View key={endorsement.id} style={styles.endorsementCard}>
              <View style={styles.endorsementHeader}>
                <TouchableOpacity
                  style={styles.endorserInfo}
                  onPress={() => navigation.push('Profile', { userId: endorsement.rater.id })}
                >
                  <UserAvatar
                    name={endorsement.rater.name}
                    avatar_url={endorsement.rater.avatar_url}
                    size={40}
                    isVerified={!!endorsement.rater.is_verified}
                  />
                  <View style={styles.endorserText}>
                    <Text style={styles.endorserName}>{endorsement.rater.name}</Text>
                    <Text style={styles.endorsementDate}>{formatDate(endorsement.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.endorsementContent}>
                <View style={styles.pillarBadge}>
                  <Text style={styles.pillarIcon}>{PILLAR_ICONS[endorsement.pillar]}</Text>
                  <Text style={styles.pillarText}>{PILLAR_NAMES[endorsement.pillar]}</Text>
                </View>
                <View style={styles.starsContainer}>
                  {[...Array(5)].map((_, i) => (
                    <Text key={i} style={[styles.star, i < endorsement.stars && styles.starFilled]}>
                      ★
                    </Text>
                  ))}
                </View>
              </View>
              {endorsement.comment && <Text style={styles.endorsementComment}>{endorsement.comment}</Text>}
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Evidence ({evidence.length})</Text>
          {isOwnProfile && (
            <TouchableOpacity onPress={() => navigation.navigate('AddEvidence')}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {evidence.length === 0 ? (
          <Text style={styles.emptyText}>No evidence yet</Text>
        ) : (
          evidence.map((item) => (
            <View key={item.id} style={styles.evidenceCard}>
              <View style={styles.pillarBadge}>
                <Text style={styles.pillarIcon}>{PILLAR_ICONS[item.pillar]}</Text>
                <Text style={styles.pillarText}>{PILLAR_NAMES[item.pillar]}</Text>
              </View>
              <Text style={styles.evidenceTitle}>{item.title}</Text>
              {item.description && <Text style={styles.evidenceDescription}>{item.description}</Text>}
              <View style={styles.evidenceMeta}>
                <Text style={styles.evidenceDate}>{formatDate(item.created_at)}</Text>
                <Text style={styles.evidenceVisibility}>
                  {item.visibility === 'public' ? '🌐 Public' : '🔒 Private'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 12,
  },
  bio: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  endorseButton: {
    marginTop: 16,
    width: '100%',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  pillarsScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  pillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  pillarChipActive: {
    backgroundColor: '#3b82f6',
  },
  pillarChipIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  pillarChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  pillarChipTextActive: {
    color: '#fff',
  },
  endorsementCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  endorsementHeader: {
    marginBottom: 8,
  },
  endorserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  endorserText: {
    marginLeft: 12,
  },
  endorserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  endorsementDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  endorsementContent: {
    marginBottom: 8,
  },
  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pillarIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  pillarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 16,
    color: '#d1d5db',
    marginRight: 2,
  },
  starFilled: {
    color: '#f59e0b',
  },
  endorsementComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 18,
  },
  evidenceCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  evidenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  evidenceDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 8,
  },
  evidenceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  evidenceDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  evidenceVisibility: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
});
