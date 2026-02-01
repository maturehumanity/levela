# Levela Backend API

Node.js + Express + TypeScript backend for the Levela mobile MVP.

## Features

- RESTful API with Express
- SQLite database with better-sqlite3
- JWT authentication
- TypeScript for type safety
- Transparent scoring algorithm
- Anti-gaming guardrails

## Scripts

```bash
# Development with hot reload
pnpm dev

# Build TypeScript to JavaScript
pnpm build

# Run production build
pnpm start

# Seed/reset database
pnpm seed
```

## Environment Variables

Create a `.env` file (optional):

```
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
```

## Database Schema

### Users
- id, email, password_hash, name, bio, avatar_url
- is_verified, is_admin
- created_at, updated_at

### Endorsements
- id, rater_id, ratee_id, pillar, stars, comment
- is_hidden
- created_at, updated_at

### Evidence
- id, user_id, pillar, title, description
- file_uri, file_type, visibility
- endorsement_id (optional link)
- created_at, updated_at

### Reports
- id, reporter_id, reported_user_id, reported_endorsement_id
- reason, description, status, admin_notes
- created_at, updated_at

## API Documentation

See main README.md for complete API endpoint documentation.
