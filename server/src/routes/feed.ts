import { Router, Response } from 'express';
import { db } from '../models/db';
import { optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Get activity feed
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const requesterId = req.user?.userId;

  // Get recent endorsements
  const endorsementsStmt = db.prepare(`
    SELECT 
      'endorsement' as type,
      e.id,
      e.created_at,
      e.pillar,
      e.stars,
      e.comment,
      rater.id as rater_id,
      rater.name as rater_name,
      rater.avatar_url as rater_avatar_url,
      rater.is_verified as rater_is_verified,
      ratee.id as ratee_id,
      ratee.name as ratee_name,
      ratee.avatar_url as ratee_avatar_url,
      ratee.is_verified as ratee_is_verified
    FROM endorsements e
    JOIN users rater ON e.rater_id = rater.id
    JOIN users ratee ON e.ratee_id = ratee.id
    WHERE e.is_hidden = 0
    ORDER BY e.created_at DESC
    LIMIT ?
  `);

  const endorsements = endorsementsStmt.all(limit * 2) as any[];

  // Get recent public evidence
  const evidenceStmt = db.prepare(`
    SELECT 
      'evidence' as type,
      ev.id,
      ev.created_at,
      ev.pillar,
      ev.title,
      ev.description,
      ev.file_type,
      u.id as user_id,
      u.name as user_name,
      u.avatar_url as user_avatar_url,
      u.is_verified as user_is_verified
    FROM evidence ev
    JOIN users u ON ev.user_id = u.id
    WHERE ev.visibility = 'public'
    ORDER BY ev.created_at DESC
    LIMIT ?
  `);

  const evidence = evidenceStmt.all(limit * 2) as any[];

  // Combine and sort by timestamp
  const combined = [...endorsements, ...evidence]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(offset, offset + limit);

  const formatted = combined.map(item => {
    if (item.type === 'endorsement') {
      return {
        type: 'endorsement',
        id: item.id,
        created_at: item.created_at,
        rater: {
          id: item.rater_id,
          name: item.rater_name,
          avatar_url: item.rater_avatar_url,
          is_verified: item.rater_is_verified,
        },
        ratee: {
          id: item.ratee_id,
          name: item.ratee_name,
          avatar_url: item.ratee_avatar_url,
          is_verified: item.ratee_is_verified,
        },
        pillar: item.pillar,
        stars: item.stars,
        comment: item.comment,
      };
    } else {
      return {
        type: 'evidence',
        id: item.id,
        created_at: item.created_at,
        user: {
          id: item.user_id,
          name: item.user_name,
          avatar_url: item.user_avatar_url,
          is_verified: item.user_is_verified,
        },
        pillar: item.pillar,
        title: item.title,
        description: item.description,
        file_type: item.file_type,
      };
    }
  });

  res.json({
    feed: formatted,
    limit,
    offset,
  });
});

export default router;
