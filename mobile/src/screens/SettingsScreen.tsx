import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  const showScoringInfo = () => {
    Alert.alert(
      'How Scoring Works',
      `Levela uses a transparent, evidence-based scoring system:\n\n` +
        `• Each pillar is scored 0-100 based on endorsements\n` +
        `• Scores are weighted by rater credibility\n` +
        `• New users have neutral weight (0.5)\n` +
        `• Overall score is the average of pillar scores\n` +
        `• More endorsements = more reliable score\n\n` +
        `Guardrails:\n` +
        `• No self-endorsement\n` +
        `• One endorsement per pillar per user every 30 days\n` +
        `• All actions are timestamped and transparent`,
      [{ text: 'Got it' }]
    );
  };

  const showAbout = () => {
    Alert.alert(
      'About Levela',
      `Levela MVP v1.0\n\n` +
        `A mobile-first platform for building trust through contribution.\n\n` +
        `Core Principles:\n` +
        `• Evidence-based trust\n` +
        `• Transparency\n` +
        `• Anti-gaming by design\n` +
        `• Human-centered\n\n` +
        `Built with React Native + Node.js`,
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={styles.itemText}>Edit Profile</Text>
          <Text style={styles.itemArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.item}>
          <Text style={styles.itemText}>Email</Text>
          <Text style={styles.itemValue}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Information</Text>
        <TouchableOpacity style={styles.item} onPress={showScoringInfo}>
          <Text style={styles.itemText}>How Scoring Works</Text>
          <Text style={styles.itemArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={showAbout}>
          <Text style={styles.itemText}>About Levela</Text>
          <Text style={styles.itemArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity style={styles.item} onPress={handleLogout}>
          <Text style={[styles.itemText, styles.dangerText]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Levela MVP v1.0</Text>
        <Text style={styles.footerText}>Build Trust Through Contribution</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemText: {
    fontSize: 16,
    color: '#111827',
  },
  itemValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  itemArrow: {
    fontSize: 24,
    color: '#9ca3af',
  },
  dangerText: {
    color: '#ef4444',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});
