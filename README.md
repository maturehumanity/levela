# Levela Mobile MVP

A mobile-first civic-tech and personal development platform that allows users to build a Trust & Contribution profile using a 5-pillar rating system.

## Overview

Levela enables users to endorse others based on five key pillars of contribution, creating transparent and evidence-based trust profiles. The platform implements anti-gaming measures and fairness by design.

### The Five Pillars

1. **Education & Skills** 📚
2. **Culture & Ethics** 🎭
3. **Responsibility & Reliability** ⚖️
4. **Environment & Community** 🌍
5. **Economy & Contribution** 💼

## Tech Stack

### Mobile App
- **React Native** with Expo
- **TypeScript**
- **React Navigation** (Stack + Bottom Tabs)
- **React Query** for state management
- **Axios** for API communication
- **AsyncStorage** for local data persistence

### Backend API
- **Node.js** with Express
- **TypeScript**
- **SQLite** (MVP, Postgres-ready)
- **better-sqlite3** for database
- **JWT** for authentication
- **bcryptjs** for password hashing

## Features

### ✅ Implemented

- **Authentication & Onboarding**
  - Email/password registration and login
  - Secure JWT-based authentication
  - Profile management

- **User Profiles**
  - View self and other user profiles
  - Display trust scores across all pillars
  - Edit profile information (name, bio)

- **Endorsement System**
  - Endorse users on any of the 5 pillars
  - 1-5 star ratings with optional comments
  - Cooldown period (30 days per pillar per user)
  - No self-endorsement
  - View endorsements received and given

- **Evidence Management**
  - Add evidence for each pillar
  - Public/private visibility control
  - Document attachment support (metadata stored)
  - View evidence on profiles

- **Activity Feed**
  - Real-time feed of endorsements and evidence
  - Filter by pillar
  - Navigate to user profiles

- **Search**
  - Search users by name or email
  - View search results with scores

- **Scoring System**
  - Transparent score calculation (0-100 per pillar)
  - Weighted by rater credibility
  - Overall score = average of pillar scores
  - "How Scoring Works" explanation in app

- **Safety & Moderation**
  - Report users and endorsements
  - Admin moderation interface (basic)
  - Hide inappropriate endorsements

### 🎯 Core Guardrails

- ❌ No self-endorsement
- ⏰ One endorsement per pillar per user every 30 days
- 🆕 New users have neutral credibility weight (0.5)
- 📅 All actions timestamped for transparency

## Prerequisites

- **Node.js** 18+ and pnpm
- **Expo CLI** (installed globally or via npx)
- **iOS Simulator** (Mac only) or **Android Emulator** or **Expo Go** app on physical device

## Installation

### 1. Clone/Extract the Repository

```bash
cd levela-mvp
```

### 2. Install Server Dependencies

```bash
cd server
pnpm install
```

### 3. Install Mobile Dependencies

```bash
cd ../mobile
pnpm install
```

## Running the Application

### Start the Backend Server

```bash
cd server
pnpm dev
```

The server will start on `http://localhost:3000`

**API Health Check:**
```bash
curl http://localhost:3000/health
```

### Start the Mobile App

In a new terminal:

```bash
cd mobile
pnpm start
```

This will start the Expo development server. You can then:

- Press `w` to open in web browser
- Press `i` to open in iOS Simulator (Mac only)
- Press `a` to open in Android Emulator
- Scan QR code with Expo Go app on your phone

**Important for Physical Devices:**

If testing on a physical device, update the API URL in `mobile/src/services/api.ts`:

```typescript
export const API_BASE_URL = 'http://YOUR_COMPUTER_IP:3000/api';
```

Replace `YOUR_COMPUTER_IP` with your local network IP (e.g., `192.168.1.100`).

## Database Management

### Seed Demo Data

The database is automatically seeded when you first run the server. To reseed:

```bash
cd server
pnpm seed
```

This creates:
- 10 demo users (alice, bob, carol, david, emma, frank, grace, henry, iris, jack)
- 32 realistic endorsements across all pillars
- 7 evidence items

### Reset Database

To completely reset and reseed the database:

```bash
cd server
rm levela.db
pnpm seed
```

## Demo Login Credentials

| Email | Password | Role |
|-------|----------|------|
| alice@levela.demo | demo123 | Admin |
| bob@levela.demo | demo123 | User |
| carol@levela.demo | demo123 | User |
| david@levela.demo | demo123 | User |
| emma@levela.demo | demo123 | User |
| frank@levela.demo | demo123 | User |
| grace@levela.demo | demo123 | User |
| henry@levela.demo | demo123 | User |
| iris@levela.demo | demo123 | User |
| jack@levela.demo | demo123 | User |

**All demo accounts use password:** `demo123`

## Project Structure

```
levela-mvp/
├── server/                 # Backend API
│   ├── src/
│   │   ├── models/        # Database models and initialization
│   │   ├── routes/        # API route handlers
│   │   ├── middleware/    # Auth and other middleware
│   │   ├── utils/         # Utility functions (auth, scoring)
│   │   ├── types.ts       # TypeScript type definitions
│   │   ├── index.ts       # Express server entry point
│   │   └── seed.ts        # Database seed script
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                # React Native mobile app
│   ├── src/
│   │   ├── screens/       # App screens (Login, Home, Profile, etc.)
│   │   ├── components/    # Reusable UI components
│   │   ├── navigation/    # Navigation configuration
│   │   ├── contexts/      # React contexts (Auth)
│   │   ├── services/      # API service layer
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   ├── App.tsx            # App entry point
│   ├── app.json           # Expo configuration
│   └── package.json
│
└── README.md              # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user profile
- `GET /api/users/:id` - Get user by ID
- `GET /api/users?q=query` - Search users

### Endorsements
- `POST /api/endorsements` - Create endorsement
- `GET /api/endorsements/user/:userId` - Get endorsements for user
- `GET /api/endorsements/by-user/:userId` - Get endorsements given by user
- `GET /api/endorsements/can-endorse/:rateeId/:pillar` - Check if can endorse

### Evidence
- `POST /api/evidence` - Create evidence
- `GET /api/evidence/user/:userId` - Get evidence for user
- `GET /api/evidence/:id` - Get single evidence
- `PUT /api/evidence/:id` - Update evidence
- `DELETE /api/evidence/:id` - Delete evidence

### Feed
- `GET /api/feed` - Get activity feed

### Reports
- `POST /api/reports` - Create report
- `GET /api/reports` - Get all reports (admin only)
- `PUT /api/reports/:id` - Update report status (admin only)

## How Scoring Works

Levela uses a transparent, evidence-based scoring system:

1. **Star Ratings**: Each endorsement is 1-5 stars
2. **Pillar Score**: `(avgStars / 5) * 100` for each pillar
3. **Weighted Average**: Scores are weighted by rater credibility
4. **Rater Weight**: Based on the rater's own average scores (new users = 0.5)
5. **Overall Score**: Average of all pillar scores with endorsements

### Example Calculation

If Alice receives:
- Education: 3 endorsements averaging 4.5 stars → Score: 90
- Culture: 2 endorsements averaging 4.0 stars → Score: 80
- Responsibility: 1 endorsement with 5 stars → Score: 100

Overall Score = (90 + 80 + 100) / 3 = **90.0**

## Development Notes

### File Uploads (MVP)

For the MVP, file uploads are simplified:
- Document picker allows users to select files
- File metadata (URI, type) is stored in the database
- Actual file storage uses local URIs
- Production version should implement S3 or similar cloud storage

### Database

SQLite is used for MVP simplicity. The schema is designed to be easily migrated to PostgreSQL:
- All timestamps use INTEGER (Unix milliseconds)
- Foreign keys are properly defined
- Indexes on frequently queried columns

### Security

- Passwords are hashed with bcrypt (10 rounds)
- JWT tokens expire after 30 days
- API endpoints are protected with authentication middleware
- Input validation on all endpoints

## Next Steps & Roadmap

### Verification & Anti-Fraud
- Identity verification system
- Verified badge criteria
- Enhanced fraud detection
- Reputation decay over time

### Organizations & Projects
- Organization profiles
- Project-based endorsements
- Team collaboration features
- Mission tracking

### Advanced Features
- AI-assisted moderation
- Smart endorsement suggestions
- Skill matching
- Impact metrics

### Governance
- Community guidelines
- Decentralized governance mechanisms
- Appeal process for reports
- Transparency reports

### Technical Improvements
- Push notifications
- Real-time updates (WebSocket)
- Offline support
- Performance optimization
- Comprehensive test suite

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use: `lsof -i :3000`
- Ensure all dependencies are installed: `pnpm install`

### Mobile app can't connect to API
- Verify server is running: `curl http://localhost:3000/health`
- Check API_BASE_URL in `mobile/src/services/api.ts`
- For physical devices, use your computer's local IP, not localhost

### Database issues
- Reset database: `rm server/levela.db && pnpm seed`
- Check database file permissions

### Expo issues
- Clear cache: `pnpm start --clear`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`

## Contributing

This is an MVP. Future contributions should focus on:
- Test coverage
- Performance optimization
- Security enhancements
- User experience improvements

## License

MIT License - See LICENSE file for details

## Contact & Support

For questions or issues, please refer to the project documentation or contact the development team.

---

**Built with ❤️ for building trust through contribution**
