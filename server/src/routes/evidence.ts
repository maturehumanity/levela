import { Router, Response } from 'express';
import { db } from '../models/db';
import { authenticateToken, AuthRequest, optionalAuth } from '../middleware/auth';
import { Pillar, PILLARS, Evidence } from '../types';

const router = Router();

// Create evidence
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { pillar, title, description, file_uri, file_type, visibility } = req.body;

  if (!pillar || !title) {
    return res.status(400).json({ error: 'pillar and title are required' });
  }

  if (!PILLARS.includes(pillar)) {
    return res.status(400).json({ error: 'Invalid pillar' });
  }

  if (visibility && !['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: 'visibility must be public or private' });
  }

  const now = Date.now();

  try {
    const stmt = db.prepare(`
      INSERT INTO evidence (user_id, pillar, title, description, file_uri, file_type, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      pillar,
      title,
      description || null,
      file_uri || null,
      file_type || null,
      visibility || 'public',
      now,
      now
    );

    const evidenceId = result.lastInsertRowid as number;
    const evidence = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId);

    res.status(201).json(evidence);
  } catch (error) {
    console.error('Create evidence error:', error);
    res.status(500).json({ error: 'Failed to create evidence' });
  }
});

// Get evidence for a user
router.get('/user/:userId', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.userId);
  const pillar = req.query.pillar as Pillar | undefined;
  const requesterId = req.user?.userId;

  let query = 'SELECT * FROM evidence WHERE user_id = ?';
  const params: any[] = [userId];

  // Only show public evidence unless viewing own profile
  if (requesterId !== userId) {
    query += ' AND visibility = ?';
    params.push('public');
  }

  if (pillar && PILLARS.includes(pillar)) {
    query += ' AND pillar = ?';
    params.push(pillar);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  const evidence = stmt.all(...params) as Evidence[];

  res.json({ evidence });
});

// Get single evidence
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  const evidenceId = parseInt(req.params.id);
  const requesterId = req.user?.userId;

  const evidence = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId) as Evidence | undefined;

  if (!evidence) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  // Check visibility
  if (evidence.visibility === 'private' && evidence.user_id !== requesterId) {
    return res.status(403).json({ error: 'This evidence is private' });
  }

  res.json(evidence);
});

// Update evidence
router.put('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const evidenceId = parseInt(req.params.id);
  const userId = req.user!.userId;
  const { title, description, visibility } = req.body;

  const evidence = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId) as Evidence | undefined;

  if (!evidence) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  if (evidence.user_id !== userId) {
    return res.status(403).json({ error: 'You can only update your own evidence' });
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (visibility !== undefined) {
    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'visibility must be public or private' });
    }
    updates.push('visibility = ?');
    values.push(visibility);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(evidenceId);

  try {
    const stmt = db.prepare(`UPDATE evidence SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    const updated = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId);
    res.json(updated);
  } catch (error) {
    console.error('Update evidence error:', error);
    res.status(500).json({ error: 'Failed to update evidence' });
  }
});

// Delete evidence
router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const evidenceId = parseInt(req.params.id);
  const userId = req.user!.userId;

  const evidence = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId) as Evidence | undefined;

  if (!evidence) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  if (evidence.user_id !== userId) {
    return res.status(403).json({ error: 'You can only delete your own evidence' });
  }

  try {
    db.prepare('DELETE FROM evidence WHERE id = ?').run(evidenceId);
    res.json({ message: 'Evidence deleted successfully' });
  } catch (error) {
    console.error('Delete evidence error:', error);
    res.status(500).json({ error: 'Failed to delete evidence' });
  }
});

export default router;
