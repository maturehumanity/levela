import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { feedApi } from '../services/api';
import { FeedItem, PILLAR_NAMES, PILLAR_ICONS } from '../types';
import UserAvatar from '../components/UserAvatar';
import { formatDate } from '../utils/format';

export default function HomeScreen({ navigation }: any) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      const data = await feedApi.getFeed(50);
      setFeed(data.feed);
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const renderEndorsement = (item: FeedItem) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('Profile', { userId: item.rater!.id })}
        >
          <UserAvatar
            name={item.rater!.name}
            avatar_url={item.rater!.avatar_url}
            size={40}
            isVerified={!!item.rater!.is_verified}
          />
          <View style={styles.userText}>
            <Text style={styles.userName}>{item.rater!.name}</Text>
            <Text style={styles.actionText}>endorsed</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
      </View>

      <TouchableOpacity
        style={styles.rateeContainer}
        onPress={() => navigation.navigate('Profile', { userId: item.ratee!.id })}
      >
        <UserAvatar
          name={item.ratee!.name}
          avatar_url={item.ratee!.avatar_url}
          size={32}
          isVerified={!!item.ratee!.is_verified}
        />
        <Text style={styles.rateeName}>{item.ratee!.name}</Text>
      </TouchableOpacity>

      <View style={styles.endorsementContent}>
        <View style={styles.pillarBadge}>
          <Text style={styles.pillarIcon}>{PILLAR_ICONS[item.pillar]}</Text>
          <Text style={styles.pillarText}>{PILLAR_NAMES[item.pillar]}</Text>
        </View>
        <View style={styles.starsContainer}>
          {[...Array(5)].map((_, i) => (
            <Text key={i} style={[styles.star, i < item.stars! && styles.starFilled]}>
              ★
            </Text>
          ))}
        </View>
      </View>

      {item.comment && <Text style={styles.comment}>{item.comment}</Text>}
    </View>
  );

  const renderEvidence = (item: FeedItem) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('Profile', { userId: item.user!.id })}
        >
          <UserAvatar
            name={item.user!.name}
            avatar_url={item.user!.avatar_url}
            size={40}
            isVerified={!!item.user!.is_verified}
          />
          <View style={styles.userText}>
            <Text style={styles.userName}>{item.user!.name}</Text>
            <Text style={styles.actionText}>added evidence</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
      </View>

      <View style={styles.evidenceContent}>
        <View style={styles.pillarBadge}>
          <Text style={styles.pillarIcon}>{PILLAR_ICONS[item.pillar]}</Text>
          <Text style={styles.pillarText}>{PILLAR_NAMES[item.pillar]}</Text>
        </View>
        <Text style={styles.evidenceTitle}>{item.title}</Text>
        {item.description && <Text style={styles.evidenceDescription}>{item.description}</Text>}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'endorsement') {
      return renderEndorsement(item);
    } else {
      return renderEvidence(item);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feed}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No activity yet</Text>
            <Text style={styles.emptySubtext}>Start endorsing others to see activity here</Text>
          </View>
        }
      />
    </View>
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
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userText: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  actionText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  rateeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 12,
  },
  rateeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  endorsementContent: {
    marginBottom: 8,
  },
  evidenceContent: {
    marginTop: 4,
  },
  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pillarIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  pillarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 20,
    color: '#d1d5db',
    marginRight: 2,
  },
  starFilled: {
    color: '#f59e0b',
  },
  comment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 8,
  },
  evidenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  evidenceDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
