// Levela Scoring System
// Pillar score: (avgStars / 5) * 100
// Overall score = average of pillar scores

import type { PillarId } from './constants';

export interface Endorsement {
  id: string;
  endorser_id: string;
  endorsed_id: string;
  pillar: PillarId;
  stars: number;
  comment?: string;
  created_at: string;
  endorser?: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface PillarScore {
  pillar: PillarId;
  score: number;
  endorsementCount: number;
  averageStars: number;
}

export interface LevelaScore {
  overall: number;
  pillars: PillarScore[];
  totalEndorsements: number;
}

export function calculatePillarScore(endorsements: Endorsement[], pillar: PillarId): PillarScore {
  const pillarEndorsements = endorsements.filter(e => e.pillar === pillar);
  
  if (pillarEndorsements.length === 0) {
    return {
      pillar,
      score: 0,
      endorsementCount: 0,
      averageStars: 0,
    };
  }
  
  const totalStars = pillarEndorsements.reduce((sum, e) => sum + e.stars, 0);
  const averageStars = totalStars / pillarEndorsements.length;
  const score = (averageStars / 5) * 100;
  
  return {
    pillar,
    score: Math.round(score * 10) / 10,
    endorsementCount: pillarEndorsements.length,
    averageStars: Math.round(averageStars * 10) / 10,
  };
}

export function calculateLevelaScore(endorsements: Endorsement[]): LevelaScore {
  const pillars: PillarId[] = [
    'education_skills',
    'culture_ethics',
    'responsibility_reliability',
    'environment_community',
    'economy_contribution',
  ];
  
  const pillarScores = pillars.map(pillar => calculatePillarScore(endorsements, pillar));
  
  const activePillars = pillarScores.filter(p => p.endorsementCount > 0);
  const overallScore = activePillars.length > 0
    ? activePillars.reduce((sum, p) => sum + p.score, 0) / activePillars.length
    : 0;
  
  return {
    overall: Math.round(overallScore * 10) / 10,
    pillars: pillarScores,
    totalEndorsements: endorsements.length,
  };
}

export function canEndorse(
  existingEndorsements: Endorsement[],
  endorserId: string,
  endorsedId: string,
  pillar: PillarId
): { canEndorse: boolean; reason?: string; nextAvailable?: Date } {
  // Rule: No self-endorsement
  if (endorserId === endorsedId) {
    return { canEndorse: false, reason: 'You cannot endorse yourself' };
  }
  
  // Rule: 30-day cooldown per pillar per user pair
  const relevantEndorsement = existingEndorsements.find(
    e => e.endorser_id === endorserId && 
         e.endorsed_id === endorsedId && 
         e.pillar === pillar
  );
  
  if (relevantEndorsement) {
    const endorsedDate = new Date(relevantEndorsement.created_at);
    const cooldownEnd = new Date(endorsedDate);
    cooldownEnd.setDate(cooldownEnd.getDate() + 30);
    
    if (cooldownEnd > new Date()) {
      return {
        canEndorse: false,
        reason: `You can endorse again on ${cooldownEnd.toLocaleDateString()}`,
        nextAvailable: cooldownEnd,
      };
    }
  }
  
  return { canEndorse: true };
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}
