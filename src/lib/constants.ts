// Levela Constants

export const PILLARS = [
  {
    id: 'education_skills',
    name: 'Education & Skills',
    shortName: 'Education',
    description: 'Knowledge, learning, and professional competencies',
    icon: 'GraduationCap',
    colorClass: 'pillar-education',
    bgColorClass: 'bg-pillar-education',
  },
  {
    id: 'culture_ethics',
    name: 'Culture & Ethics',
    shortName: 'Culture',
    description: 'Values, integrity, and ethical behavior',
    icon: 'Heart',
    colorClass: 'pillar-culture',
    bgColorClass: 'bg-pillar-culture',
  },
  {
    id: 'responsibility_reliability',
    name: 'Responsibility & Reliability',
    shortName: 'Responsibility',
    description: 'Dependability, accountability, and follow-through',
    icon: 'Shield',
    colorClass: 'pillar-responsibility',
    bgColorClass: 'bg-pillar-responsibility',
  },
  {
    id: 'environment_community',
    name: 'Environment & Community',
    shortName: 'Community',
    description: 'Social impact and community engagement',
    icon: 'Users',
    colorClass: 'pillar-environment',
    bgColorClass: 'bg-pillar-environment',
  },
  {
    id: 'economy_contribution',
    name: 'Economy & Contribution',
    shortName: 'Economy',
    description: 'Economic value and professional contribution',
    icon: 'TrendingUp',
    colorClass: 'pillar-economy',
    bgColorClass: 'bg-pillar-economy',
  },
] as const;

export type PillarId = typeof PILLARS[number]['id'];

export function getPillarName(pillarId: PillarId): string {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    const pillar = PILLARS.find(p => p.id === pillarId);
    return pillar?.name || pillarId;
  }
  
  const customCustomizations = JSON.parse(localStorage.getItem('customPillarCustomizations') || '{}');
  const pillar = PILLARS.find(p => p.id === pillarId);
  return customCustomizations[pillarId]?.categoryName || pillar?.name || pillarId;
}

export function getPillarShortName(pillarId: PillarId): string {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    const pillar = PILLARS.find(p => p.id === pillarId);
    return pillar?.shortName || pillarId;
  }
  
  const customCustomizations = JSON.parse(localStorage.getItem('customPillarCustomizations') || '{}');
  const pillar = PILLARS.find(p => p.id === pillarId);
  return customCustomizations[pillarId]?.displayName || pillar?.shortName || pillarId;
}

export function getPillarDescription(pillarId: PillarId): string {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    const pillar = PILLARS.find(p => p.id === pillarId);
    return pillar?.description || '';
  }
  
  const customCustomizations = JSON.parse(localStorage.getItem('customPillarCustomizations') || '{}');
  const pillar = PILLARS.find(p => p.id === pillarId);
  return customCustomizations[pillarId]?.description || pillar?.description || '';
}

export const ENDORSEMENT_COOLDOWN_DAYS = 30;

export const SCORE_THRESHOLDS = {
  low: 40,
  medium: 70,
  high: 100,
} as const;

export function getScoreColor(score: number): string {
  if (score < SCORE_THRESHOLDS.low) return 'text-destructive';
  if (score < SCORE_THRESHOLDS.medium) return 'text-accent';
  return 'text-primary';
}
