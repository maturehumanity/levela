export type Pillar = 'education' | 'culture' | 'responsibility' | 'environment' | 'economy';

export const PILLARS: Pillar[] = ['education', 'culture', 'responsibility', 'environment', 'economy'];

export const PILLAR_NAMES: Record<Pillar, string> = {
  education: 'Education & Skills',
  culture: 'Culture & Ethics',
  responsibility: 'Responsibility & Reliability',
  environment: 'Environment & Community',
  economy: 'Economy & Contribution',
};

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  is_verified: number;
  is_admin: number;
  created_at: number;
  updated_at: number;
}

export interface Endorsement {
  id: number;
  rater_id: number;
  ratee_id: number;
  pillar: Pillar;
  stars: number;
  comment: string | null;
  is_hidden: number;
  created_at: number;
  updated_at: number;
}

export interface Evidence {
  id: number;
  user_id: number;
  pillar: Pillar;
  title: string;
  description: string | null;
  file_uri: string | null;
  file_type: string | null;
  visibility: 'public' | 'private';
  endorsement_id: number | null;
  created_at: number;
  updated_at: number;
}

export interface Report {
  id: number;
  reporter_id: number;
  reported_user_id: number | null;
  reported_endorsement_id: number | null;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  admin_notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface PillarScore {
  pillar: Pillar;
  score: number;
  endorsement_count: number;
  average_stars: number;
}

export interface UserScore {
  overall_score: number;
  pillar_scores: PillarScore[];
}

export interface AuthPayload {
  userId: number;
  email: string;
}
