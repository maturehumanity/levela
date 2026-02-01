import { Router, Response } from 'express';
import { db } from '../models/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { calculateUserScore } from '../utils/scoring';
import { User } from '../types';

const router = Router();

// Get current user profile
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const score = calculateUserScore(userId);
  
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    bio: user.bio,
    avatar_url: user.avatar_url,
    is_verified: user.is_verified,
    is_admin: user.is_admin,
    score,
  });
});

// Update current user profile
router.put('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { name, bio, avatar_url } = req.body;
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (bio !== undefined) {
    updates.push('bio = ?');
    values.push(bio);
  }
  if (avatar_url !== undefined) {
    updates.push('avatar_url = ?');
    values.push(avatar_url);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(userId);
  
  try {
    const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    const score = calculateUserScore(userId);
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      is_admin: user.is_admin,
      score,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user by ID
router.get('/:id', (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const score = calculateUserScore(userId);
  
  res.json({
    id: user.id,
    name: user.name,
    bio: user.bio,
    avatar_url: user.avatar_url,
    is_verified: user.is_verified,
    score,
  });
});

// Search users
router.get('/', (req: AuthRequest, res: Response) => {
  const query = req.query.q as string || '';
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  
  const stmt = db.prepare(`
    SELECT id, name, bio, avatar_url, is_verified
    FROM users
    WHERE name LIKE ? OR email LIKE ?
    ORDER BY name
    LIMIT ? OFFSET ?
  `);
  
  const searchPattern = `%${query}%`;
  const users = stmt.all(searchPattern, searchPattern, limit, offset) as User[];
  
  const usersWithScores = users.map(user => ({
    id: user.id,
    name: user.name,
    bio: user.bio,
    avatar_url: user.avatar_url,
    is_verified: user.is_verified,
    score: calculateUserScore(user.id),
  }));
  
  res.json({
    users: usersWithScores,
    limit,
    offset,
  });
});

export default router;
