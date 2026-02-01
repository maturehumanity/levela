import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface UserAvatarProps {
  name: string;
  avatar_url?: string | null;
  size?: number;
  isVerified?: boolean;
}

export default function UserAvatar({ name, avatar_url, size = 40, isVerified = false }: UserAvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {avatar_url ? (
        <Image source={{ uri: avatar_url }} style={[styles.avatar, { width: size, height: size }]} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
        </View>
      )}
      {isVerified && (
        <View style={[styles.badge, { width: size * 0.3, height: size * 0.3, right: -2, bottom: -2 }]}>
          <Text style={[styles.badgeText, { fontSize: size * 0.2 }]}>✓</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    borderRadius: 999,
  },
  placeholder: {
    borderRadius: 999,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    backgroundColor: '#10b981',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
