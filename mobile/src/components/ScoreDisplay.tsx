import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserScore, PILLAR_NAMES, PILLAR_ICONS } from '../types';
import { formatScore, getScoreColor, getScoreLabel } from '../utils/format';

interface ScoreDisplayProps {
  score: UserScore;
  compact?: boolean;
}

export default function ScoreDisplay({ score, compact = false }: ScoreDisplayProps) {
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={[styles.compactScore, { color: getScoreColor(score.overall_score) }]}>
          {formatScore(score.overall_score)}
        </Text>
        <Text style={styles.compactLabel}>{getScoreLabel(score.overall_score)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.overallContainer}>
        <Text style={styles.overallLabel}>Overall Trust Score</Text>
        <Text style={[styles.overallScore, { color: getScoreColor(score.overall_score) }]}>
          {formatScore(score.overall_score)}
        </Text>
        <Text style={styles.overallSubtext}>{getScoreLabel(score.overall_score)}</Text>
      </View>

      <View style={styles.pillarsContainer}>
        {score.pillar_scores.map((pillarScore) => (
          <View key={pillarScore.pillar} style={styles.pillarItem}>
            <View style={styles.pillarHeader}>
              <Text style={styles.pillarIcon}>{PILLAR_ICONS[pillarScore.pillar]}</Text>
              <View style={styles.pillarInfo}>
                <Text style={styles.pillarName}>{PILLAR_NAMES[pillarScore.pillar]}</Text>
                <Text style={styles.pillarCount}>
                  {pillarScore.endorsement_count} endorsement{pillarScore.endorsement_count !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <View style={styles.pillarScoreContainer}>
              <Text style={[styles.pillarScore, { color: getScoreColor(pillarScore.score) }]}>
                {formatScore(pillarScore.score)}
              </Text>
              {pillarScore.endorsement_count > 0 && (
                <Text style={styles.pillarStars}>★ {pillarScore.average_stars.toFixed(1)}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  compactContainer: {
    alignItems: 'center',
  },
  compactScore: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  compactLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  overallContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  overallLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  overallScore: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  overallSubtext: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  pillarsContainer: {
    marginTop: 16,
  },
  pillarItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pillarIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  pillarInfo: {
    flex: 1,
  },
  pillarName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  pillarCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  pillarScoreContainer: {
    alignItems: 'flex-end',
  },
  pillarScore: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  pillarStars: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 2,
  },
});
