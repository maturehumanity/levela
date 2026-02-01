import { Router, Response } from 'express';
import { db } from '../models/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { canEndorse } from '../utils/scoring';
import { Pillar, PILLARS, Endorsement, User } from '../types';

const router = Router();

// Create endorsement
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const raterId = req.user!.userId;
  const { ratee_id, pillar, stars, comment, evidence_ids } = req.body;

  if (!ratee_id || !pillar || !stars) {
    return res.status(400).json({ error: 'ratee_id, pillar, and stars are required' });
  }

  if (!PILLARS.includes(pillar)) {
    return res.status(400).json({ error: 'Invalid pillar' });
  }

  if (stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Stars must be between 1 and 5' });
  }

  // Check if endorsement is allowed
  const endorseCheck = canEndorse(raterId, ratee_id, pillar);
  if (!endorseCheck.can) {
    return res.status(400).json({ error: endorseCheck.reason });
  }

  const now = Date.now();

  try {
    const stmt = db.prepare(`
      INSERT INTO endorsements (rater_id, ratee_id, pillar, stars, comment, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(raterId, ratee_id, pillar, stars, comment || null, now, now);
    const endorsementId = result.lastInsertRowid as number;

    // Link evidence if provided
    if (evidence_ids && Array.isArray(evidence_ids) && evidence_ids.length > 0) {
      const updateStmt = db.prepare('UPDATE evidence SET endorsement_id = ? WHERE id = ? AND user_id = ?');
      for (const evidenceId of evidence_ids) {
        updateStmt.run(endorsementId, evidenceId, ratee_id);
      }
    }

    const endorsement = db.prepare('SELECT * FROM endorsements WHERE id = ?').get(endorsementId);

    res.status(201).json(endorsement);
  } catch (error) {
    console.error('Create endorsement error:', error);
    res.status(500).json({ error: 'Failed to create endorsement' });
  }
});

// Get endorsements for a user
router.get('/user/:userId', (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.userId);
  const pillar = req.query.pillar as Pillar | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  let query = `
    SELECT e.*, 
           rater.id as rater_id, rater.name as rater_name, rater.avatar_url as rater_avatar_url, rater.is_verified as rater_is_verified
    FROM endorsements e
    JOIN users rater ON e.rater_id = rater.id
    WHERE e.ratee_id = ? AND e.is_hidden = 0
  `;
  const params: any[] = [userId];

  if (pillar && PILLARS.includes(pillar)) {
    query += ' AND e.pillar = ?';
    params.push(pillar);
  }

  query += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const endorsements = stmt.all(...params) as any[];

  const formatted = endorsements.map(e => ({
    id: e.id,
    rater: {
      id: e.rater_id,
      name: e.rater_name,
      avatar_url: e.rater_avatar_url,
      is_verified: e.rater_is_verified,
    },
    pillar: e.pillar,
    stars: e.stars,
    comment: e.comment,
    created_at: e.created_at,
  }));

  res.json({
    endorsements: formatted,
    limit,
    offset,
  });
});

// Get endorsements given by a user
router.get('/by-user/:userId', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.userId);
  const requesterId = req.user!.userId;

  // Only allow users to see their own given endorsements
  if (userId !== requesterId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const stmt = db.prepare(`
    SELECT e.*, 
           ratee.id as ratee_id, ratee.name as ratee_name, ratee.avatar_url as ratee_avatar_url
    FROM endorsements e
    JOIN users ratee ON e.ratee_id = ratee.id
    WHERE e.rater_id = ?
    ORDER BY e.created_at DESC
  `);

  const endorsements = stmt.all(userId) as any[];

  const formatted = endorsements.map(e => ({
    id: e.id,
    ratee: {
      id: e.ratee_id,
      name: e.ratee_name,
      avatar_url: e.ratee_avatar_url,
    },
    pillar: e.pillar,
    stars: e.stars,
    comment: e.comment,
    created_at: e.created_at,
  }));

  res.json({ endorsements: formatted });
});

// Check if user can endorse
router.get('/can-endorse/:rateeId/:pillar', authenticateToken, (req: AuthRequest, res: Response) => {
  const raterId = req.user!.userId;
  const rateeId = parseInt(req.params.rateeId);
  const pillar = req.params.pillar as Pillar;

  if (!PILLARS.includes(pillar)) {
    return res.status(400).json({ error: 'Invalid pillar' });
  }

  const result = canEndorse(raterId, rateeId, pillar);
  res.json(result);
});

export default router;
