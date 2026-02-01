import { Router, Response } from 'express';
import { db } from '../models/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../types';

const router = Router();

// Create report
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const reporterId = req.user!.userId;
  const { reported_user_id, reported_endorsement_id, reason, description } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'reason is required' });
  }

  if (!reported_user_id && !reported_endorsement_id) {
    return res.status(400).json({ error: 'Either reported_user_id or reported_endorsement_id is required' });
  }

  const now = Date.now();

  try {
    const stmt = db.prepare(`
      INSERT INTO reports (reporter_id, reported_user_id, reported_endorsement_id, reason, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

    const result = stmt.run(
      reporterId,
      reported_user_id || null,
      reported_endorsement_id || null,
      reason,
      description || null,
      now,
      now
    );

    const reportId = result.lastInsertRowid as number;
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);

    res.status(201).json(report);
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Get all reports (admin only)
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  // Check if user is admin
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user || !user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  let query = `
    SELECT 
      r.*,
      reporter.name as reporter_name,
      reported_user.name as reported_user_name
    FROM reports r
    JOIN users reporter ON r.reporter_id = reporter.id
    LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
  `;

  const params: any[] = [];

  if (status && ['pending', 'reviewed', 'resolved'].includes(status)) {
    query += ' WHERE r.status = ?';
    params.push(status);
  }

  query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const reports = stmt.all(...params) as any[];

  res.json({
    reports,
    limit,
    offset,
  });
});

// Update report status (admin only)
router.put('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const reportId = parseInt(req.params.id);
  const { status, admin_notes, hide_endorsement } = req.body;

  // Check if user is admin
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user || !user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as any;
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (status !== undefined) {
    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    updates.push('status = ?');
    values.push(status);
  }

  if (admin_notes !== undefined) {
    updates.push('admin_notes = ?');
    values.push(admin_notes);
  }

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(reportId);

  try {
    // Update report
    const stmt = db.prepare(`UPDATE reports SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    // Hide endorsement if requested
    if (hide_endorsement && report.reported_endorsement_id) {
      db.prepare('UPDATE endorsements SET is_hidden = 1 WHERE id = ?').run(report.reported_endorsement_id);
    }

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    res.json(updated);
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

export default router;
