import { describe, expect, it } from 'vitest';

import { runSpecialistCouncil } from '@/lib/specialist-orchestration';
import {
  appendTurnToSession,
  buildContextualRequest,
  createDiscussionSession,
  createDiscussionTurn,
} from '@/lib/specialist-discussions';

describe('specialist discussions', () => {
  it('creates a session and appends turns', () => {
    const session = createDiscussionSession('Need legal help with policy.');
    const result = runSpecialistCouncil('Need legal help with policy.');
    const turn = createDiscussionTurn('Need legal help with policy.', result);
    const updated = appendTurnToSession([session], session.id, turn);
    expect(updated[0].turns).toHaveLength(1);
    expect(updated[0].title.length).toBeGreaterThan(0);
  });

  it('builds contextual requests using recent turns', () => {
    const session = createDiscussionSession('First');
    const first = createDiscussionTurn('First question', runSpecialistCouncil('First question'));
    const secondSession = appendTurnToSession([session], session.id, first)[0];
    const contextual = buildContextualRequest(secondSession, 'Next question');
    expect(contextual).toContain('Context from prior discussion');
    expect(contextual).toContain('Next question');
  });
});
