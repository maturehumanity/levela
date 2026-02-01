import { Router, Request, Response } from 'express';
import { db } from '../models/db';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { User } from '../types';

const router = Router();

// Register
router.post('/register', (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  // Check if user exists
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const passwordHash = hashPassword(password);
  const now = Date.now();

  try {
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(email, passwordHash, name, now, now);
    const userId = result.lastInsertRowid as number;

    const token = generateToken({ userId, email });

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        name,
        bio: null,
        avatar_url: null,
        is_verified: 0,
        is_admin: 0,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;

  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken({ userId: user.id, email: user.email });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      is_admin: user.is_admin,
    },
  });
});

export default router;
