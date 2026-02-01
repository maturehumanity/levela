# Levela MVP - Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)

## Step 1: Install Dependencies

```bash
# Install server dependencies
cd server
pnpm install

# Install mobile dependencies
cd ../mobile
pnpm install
```

## Step 2: Start the Backend

```bash
cd server
pnpm dev
```

The server will:
- Start on http://localhost:3000
- Automatically initialize the database
- Be ready to accept requests

**Verify it's running:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":...}
```

## Step 3: Seed Demo Data (if needed)

If the database is empty, seed it:

```bash
cd server
pnpm seed
```

This creates 10 demo users with realistic data.

## Step 4: Start the Mobile App

In a new terminal:

```bash
cd mobile
pnpm start
```

Then press:
- **w** for web browser
- **i** for iOS Simulator (Mac only)
- **a** for Android Emulator
- Scan QR code with Expo Go app on your phone

## Step 5: Login

Use any of these demo accounts:

- **Email:** alice@levela.demo
- **Password:** demo123

Or bob, carol, david, emma, frank, grace, henry, iris, or jack (all @levela.demo with password demo123)

## What to Try

1. **View the Feed** - See endorsements and evidence from demo users
2. **Search Users** - Find and view other user profiles
3. **View Profiles** - Check out scores and endorsements
4. **Endorse Someone** - Give an endorsement (respects 30-day cooldown)
5. **Add Evidence** - Document your contributions
6. **Edit Profile** - Update your bio

## Troubleshooting

**Mobile app can't connect?**
- Make sure server is running on port 3000
- For physical devices, update API_BASE_URL in `mobile/src/services/api.ts` to your computer's IP

**Port 3000 in use?**
- Kill the process: `lsof -i :3000` then `kill -9 <PID>`

**Database issues?**
- Reset: `rm server/levela.db && cd server && pnpm seed`

## Next Steps

- Read the full README.md for detailed documentation
- Explore the codebase
- Check out the API endpoints
- Review the scoring algorithm

Happy building! 🎯
