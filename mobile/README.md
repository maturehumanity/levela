# Levela Mobile App

React Native mobile app built with Expo for the Levela MVP.

## Features

- Cross-platform (iOS, Android, Web)
- TypeScript for type safety
- React Navigation for routing
- React Query for data fetching
- AsyncStorage for local persistence
- Modern, clean UI

## Scripts

```bash
# Start Expo development server
pnpm start

# Start with cache cleared
pnpm start --clear

# Run on specific platform
pnpm run ios
pnpm run android
pnpm run web
```

## Configuration

### API Connection

Update `src/services/api.ts` for your environment:

```typescript
// For web/simulator
export const API_BASE_URL = 'http://localhost:3000/api';

// For physical device
export const API_BASE_URL = 'http://192.168.1.100:3000/api';
```

## Project Structure

```
src/
├── screens/          # App screens
├── components/       # Reusable UI components
├── navigation/       # Navigation setup
├── contexts/         # React contexts
├── services/         # API service layer
├── types/           # TypeScript types
└── utils/           # Utility functions
```

## Key Screens

- **LoginScreen** - Authentication
- **RegisterScreen** - New user signup
- **HomeScreen** - Activity feed
- **SearchScreen** - User search
- **ProfileScreen** - User profiles (self/other)
- **EndorseScreen** - Endorse users
- **AddEvidenceScreen** - Add evidence
- **EditProfileScreen** - Edit profile
- **SettingsScreen** - App settings

## Development Tips

- Use Expo Go app for quick testing on physical devices
- Hot reload is enabled by default
- Check console for API errors
- Use React DevTools for debugging
