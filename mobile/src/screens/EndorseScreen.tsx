import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { endorsementsApi } from '../services/api';
import { Pillar, PILLAR_NAMES, PILLAR_ICONS } from '../types';
import Button from '../components/Button';

export default function EndorseScreen({ route, navigation }: any) {
  const { userId, userName } = route.params;
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [canEndorse, setCanEndorse] = useState<{ [key in Pillar]?: { can: boolean; reason?: string } }>({});
  const [checkingPillar, setCheckingPillar] = useState(false);

  useEffect(() => {
    if (selectedPillar) {
      checkCanEndorse(selectedPillar);
    }
  }, [selectedPillar]);

  const checkCanEndorse = async (pillar: Pillar) => {
    if (canEndorse[pillar]) return;

    setCheckingPillar(true);
    try {
      const result = await endorsementsApi.canEndorse(userId, pillar);
      setCanEndorse((prev) => ({ ...prev, [pillar]: result }));
    } catch (error) {
      console.error('Failed to check endorsement eligibility:', error);
    } finally {
      setCheckingPillar(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPillar) {
      Alert.alert('Error', 'Please select a pillar');
      return;
    }

    if (stars === 0) {
      Alert.alert('Error', 'Please select a star rating');
      return;
    }

    const eligibility = canEndorse[selectedPillar];
    if (eligibility && !eligibility.can) {
      Alert.alert('Cannot Endorse', eligibility.reason || 'You cannot endorse this user for this pillar at this time');
      return;
    }

    setLoading(true);
    try {
      await endorsementsApi.create({
        ratee_id: userId,
        pillar: selectedPillar,
        stars,
        comment: comment.trim() || undefined,
      });

      Alert.alert('Success', 'Endorsement submitted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit endorsement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Endorse {userName}</Text>
        <Text style={styles.subtitle}>Share your experience and build trust</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Select Pillar *</Text>
        <View style={styles.pillarsGrid}>
          {Object.entries(PILLAR_NAMES).map(([key, name]) => {
            const pillar = key as Pillar;
            const isSelected = selectedPillar === pillar;
            const eligibility = canEndorse[pillar];
            const isDisabled = eligibility && !eligibility.can;

            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.pillarCard,
                  isSelected && styles.pillarCardSelected,
                  isDisabled && styles.pillarCardDisabled,
                ]}
                onPress={() => setSelectedPillar(pillar)}
                disabled={isDisabled}
              >
                <Text style={styles.pillarCardIcon}>{PILLAR_ICONS[pillar]}</Text>
                <Text style={[styles.pillarCardText, isSelected && styles.pillarCardTextSelected]}>{name}</Text>
                {isDisabled && <Text style={styles.disabledText}>Cooldown</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedPillar && checkingPillar && (
          <View style={styles.checkingContainer}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.checkingText}>Checking eligibility...</Text>
          </View>
        )}
        {selectedPillar && canEndorse[selectedPillar] && !canEndorse[selectedPillar]!.can && (
          <Text style={styles.errorText}>{canEndorse[selectedPillar]!.reason}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Rating *</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity key={value} onPress={() => setStars(value)} style={styles.starButton}>
              <Text style={[styles.star, value <= stars && styles.starFilled]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.starsLabel}>
          {stars === 0 && 'Tap to rate'}
          {stars === 1 && '1 - Needs Improvement'}
          {stars === 2 && '2 - Fair'}
          {stars === 3 && '3 - Good'}
          {stars === 4 && '4 - Very Good'}
          {stars === 5 && '5 - Excellent'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Comment (Optional)</Text>
        <TextInput
          style={styles.textArea}
          value={comment}
          onChangeText={setComment}
          placeholder="Share specific examples of their contribution..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{comment.length}/500</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>📋 Endorsement Guidelines</Text>
        <Text style={styles.infoText}>• Be honest and specific</Text>
        <Text style={styles.infoText}>• Base your rating on direct experience</Text>
        <Text style={styles.infoText}>• You can endorse each pillar once per 30 days</Text>
        <Text style={styles.infoText}>• Your endorsement helps build community trust</Text>
      </View>

      <Button
        title="Submit Endorsement"
        onPress={handleSubmit}
        loading={loading}
        disabled={!selectedPillar || stars === 0 || loading}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pillarCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pillarCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  pillarCardDisabled: {
    opacity: 0.5,
  },
  pillarCardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  pillarCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  pillarCardTextSelected: {
    color: '#3b82f6',
  },
  disabledText: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 4,
  },
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkingText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 40,
    color: '#d1d5db',
  },
  starFilled: {
    color: '#f59e0b',
  },
  starsLabel: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    color: '#111827',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    marginBottom: 4,
  },
  submitButton: {
    marginBottom: 24,
  },
});
