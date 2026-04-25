import type { SpecialistCouncilResult } from '@/lib/specialist-orchestration';

export type SpecialistDiscussionTurn = {
  id: string;
  requestText: string;
  createdAt: string;
  result: SpecialistCouncilResult;
};

export type SpecialistDiscussionSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: SpecialistDiscussionTurn[];
};

const STORAGE_KEY = 'levela-specialist-discussions-v1';
const MAX_SESSIONS = 20;

function safeNowIso() {
  return new Date().toISOString();
}

function safeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDiscussionSession(initialRequest: string): SpecialistDiscussionSession {
  const now = safeNowIso();
  return {
    id: safeId('session'),
    title: initialRequest.slice(0, 64) || 'New specialist discussion',
    createdAt: now,
    updatedAt: now,
    turns: [],
  };
}

export function createDiscussionTurn(requestText: string, result: SpecialistCouncilResult): SpecialistDiscussionTurn {
  return {
    id: safeId('turn'),
    requestText,
    createdAt: safeNowIso(),
    result,
  };
}

export function readDiscussionSessions(): SpecialistDiscussionSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SpecialistDiscussionSession[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeDiscussionSessions(sessions: SpecialistDiscussionSession[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // Ignore local persistence failures.
  }
}

export function appendTurnToSession(
  sessions: SpecialistDiscussionSession[],
  sessionId: string,
  turn: SpecialistDiscussionTurn,
): SpecialistDiscussionSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const nextTurns = [...session.turns, turn];
    return {
      ...session,
      title: session.turns.length === 0 ? turn.requestText.slice(0, 64) : session.title,
      turns: nextTurns,
      updatedAt: turn.createdAt,
    };
  });
}

export function upsertSession(
  sessions: SpecialistDiscussionSession[],
  session: SpecialistDiscussionSession,
): SpecialistDiscussionSession[] {
  const existing = sessions.find((item) => item.id === session.id);
  if (!existing) return [session, ...sessions].slice(0, MAX_SESSIONS);
  return sessions.map((item) => (item.id === session.id ? session : item));
}

export function buildContextualRequest(session: SpecialistDiscussionSession, currentInput: string) {
  if (session.turns.length === 0) return currentInput;
  const recentTurns = session.turns.slice(-3);
  const history = recentTurns.map((turn) => turn.requestText).join(' | ');
  return `Context from prior discussion: ${history}. New request: ${currentInput}`;
}
