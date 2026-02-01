import { db } from '../models/db';
import { Pillar, PILLARS, PillarScore, UserScore, Endorsement } from '../types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Calculate the credibility weight for a rater
 * For MVP: simple average of their own scores across pillars
 * New users (no endorsements received) have weight of 0.5
 */
function getRaterWeight(raterId: number): number {
  const stmt = db.prepare(`
    SELECT pillar, AVG(stars) as avg_stars, COUNT(*) as count
    FROM endorsements
    WHERE ratee_id = ? AND is_hidden = 0
    GROUP BY pillar
  `);
  
  const results = stmt.all(raterId) as { pillar: Pillar; avg_stars: number; count: number }[];
  
  if (results.length === 0) {
    return 0.5; // Neutral weight for new users
  }
  
  const avgScore = results.reduce((sum, r) => sum + (r.avg_stars / 5) * 100, 0) / results.length;
  return Math.max(0.1, Math.min(1.0, avgScore / 100));
}

/**
 * Calculate score for a specific pillar for a user
 */
function calculatePillarScore(userId: number, pillar: Pillar): PillarScore {
  const stmt = db.prepare(`
    SELECT e.*, u.id as rater_id
    FROM endorsements e
    JOIN users u ON e.rater_id = u.id
    WHERE e.ratee_id = ? AND e.pillar = ? AND e.is_hidden = 0
    ORDER BY e.created_at DESC
  `);
  
  const endorsements = stmt.all(userId, pillar) as Endorsement[];
  
  if (endorsements.length === 0) {
    return {
      pillar,
      score: 0,
      endorsement_count: 0,
      average_stars: 0,
    };
  }
  
  // Calculate weighted average
  let totalWeightedStars = 0;
  let totalWeight = 0;
  
  for (const endorsement of endorsements) {
    const weight = getRaterWeight(endorsement.rater_id);
    totalWeightedStars += endorsement.stars * weight;
    totalWeight += weight;
  }
  
  const weightedAvgStars = totalWeight > 0 ? totalWeightedStars / totalWeight : 0;
  const score = (weightedAvgStars / 5) * 100;
  const avgStars = endorsements.reduce((sum, e) => sum + e.stars, 0) / endorsements.length;
  
  return {
    pillar,
    score: Math.round(score * 10) / 10,
    endorsement_count: endorsements.length,
    average_stars: Math.round(avgStars * 10) / 10,
  };
}

/**
 * Calculate overall score for a user
 */
export function calculateUserScore(userId: number): UserScore {
  const pillarScores = PILLARS.map(pillar => calculatePillarScore(userId, pillar));
  
  const scoresWithEndorsements = pillarScores.filter(ps => ps.endorsement_count > 0);
  const overallScore = scoresWithEndorsements.length > 0
    ? scoresWithEndorsements.reduce((sum, ps) => sum + ps.score, 0) / scoresWithEndorsements.length
    : 0;
  
  return {
    overall_score: Math.round(overallScore * 10) / 10,
    pillar_scores: pillarScores,
  };
}

/**
 * Check if a user can endorse another user for a specific pillar
 * Rules: 
 * - No self-endorsement
 * - Only one endorsement per pillar per user every 30 days
 */
export function canEndorse(raterId: number, rateeId: number, pillar: Pillar): { can: boolean; reason?: string } {
  if (raterId === rateeId) {
    return { can: false, reason: 'Cannot endorse yourself' };
  }
  
  const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
  
  const stmt = db.prepare(`
    SELECT id, created_at
    FROM endorsements
    WHERE rater_id = ? AND ratee_id = ? AND pillar = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  
  const lastEndorsement = stmt.get(raterId, rateeId, pillar) as { id: number; created_at: number } | undefined;
  
  if (lastEndorsement && lastEndorsement.created_at > thirtyDaysAgo) {
    const daysLeft = Math.ceil((lastEndorsement.created_at + THIRTY_DAYS_MS - Date.now()) / (24 * 60 * 60 * 1000));
    return { can: false, reason: `You can endorse this user for ${pillar} again in ${daysLeft} days` };
  }
  
  return { can: true };
}
