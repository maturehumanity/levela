import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { evidenceApi } from '../services/api';
import { Pillar, PILLAR_NAMES, PILLAR_ICONS } from '../types';
import Button from '../components/Button';

export default function AddEvidenceScreen({ navigation }: any) {
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDocument(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPillar) {
      Alert.alert('Error', 'Please select a pillar');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setLoading(true);
    try {
      await evidenceApi.create({
        pillar: selectedPillar,
        title: title.trim(),
        description: description.trim() || undefined,
        file_uri: document?.uri,
        file_type: document?.mimeType,
        visibility: isPublic ? 'public' : 'private',
      });

      Alert.alert('Success', 'Evidence added successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add evidence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Evidence</Text>
        <Text style={styles.subtitle}>Document your contributions and achievements</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Select Pillar *</Text>
        <View style={styles.pillarsGrid}>
          {Object.entries(PILLAR_NAMES).map(([key, name]) => {
            const pillar = key as Pillar;
            const isSelected = selectedPillar === pillar;

            return (
              <TouchableOpacity
                key={key}
                style={[styles.pillarCard, isSelected && styles.pillarCardSelected]}
                onPress={() => setSelectedPillar(pillar)}
              >
                <Text style={styles.pillarCardIcon}>{PILLAR_ICONS[pillar]}</Text>
                <Text style={[styles.pillarCardText, isSelected && styles.pillarCardTextSelected]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Certification, Award, Project Completion"
          maxLength={100}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textArea}
          value={description}
          onChangeText={setDescription}
          placeholder="Provide details about this evidence..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Attach Document (Optional)</Text>
        {document ? (
          <View style={styles.documentCard}>
            <Text style={styles.documentName} numberOfLines={1}>
              📎 {document.name}
            </Text>
            <TouchableOpacity onPress={() => setDocument(null)}>
              <Text style={styles.removeButton}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Button title="Pick Document" onPress={pickDocument} variant="outline" />
        )}
        <Text style={styles.helperText}>For MVP: Document metadata is stored, file is referenced locally</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.visibilityRow}>
          <View style={styles.visibilityInfo}>
            <Text style={styles.label}>Public Visibility</Text>
            <Text style={styles.helperText}>
              {isPublic ? 'Everyone can see this evidence' : 'Only you can see this evidence'}
            </Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 Evidence Tips</Text>
        <Text style={styles.infoText}>• Add certificates, awards, or project documentation</Text>
        <Text style={styles.infoText}>• Public evidence strengthens your profile</Text>
        <Text style={styles.infoText}>• Evidence can be linked to endorsements</Text>
        <Text style={styles.infoText}>• Keep titles clear and descriptive</Text>
      </View>

      <Button
        title="Add Evidence"
        onPress={handleSubmit}
        loading={loading}
        disabled={!selectedPillar || !title.trim() || loading}
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
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
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
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  removeButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visibilityInfo: {
    flex: 1,
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
