import { describe, expect, it } from 'vitest';

import {
  buildCuratedStoryList,
  buildReaderFacingSummary,
  featureTitleLooksUnclear,
  isFeatureStory,
} from '@/lib/development-story-curation';
import type { DevelopmentStory } from '@/lib/development-stories';

function story(overrides: Partial<DevelopmentStory> & Pick<DevelopmentStory, 'originalInstruction'>): DevelopmentStory {
  const ins = overrides.originalInstruction;
  return {
    id: overrides.id ?? 's1',
    requestedAt: overrides.requestedAt ?? '2026-04-25T12:00:00.000Z',
    storyKind: 'development',
    section: overrides.section ?? 'General',
    area: overrides.area ?? 'Product Evolution',
    title: overrides.title ?? ins.slice(0, 100),
    originalInstruction: ins,
    rephrasedDescription:
      overrides.rephrasedDescription ?? `User-requested change captured from chat history: ${ins}`,
    createdFeatures: overrides.createdFeatures ?? ['Backfilled from chat transcript'],
    expectedBehavior:
      overrides.expectedBehavior ??
      `This change should be visible in app behavior and aligned with the request: ${ins}`,
  };
}

describe('development-story-curation', () => {
  it('excludes planning-only agreement lines from the journal', () => {
    const ins = "Ok, let's make a plan out of your recommendations and start implementing it.";
    const row = story({ id: 'plan1', originalInstruction: ins });
    expect(isFeatureStory(row)).toBe(false);
    expect(buildCuratedStoryList([row])).toHaveLength(0);
  });

  it('turns short "why does…" questions into actionable titles', () => {
    const ins = 'Why does it keep displaying that error message?';
    const row = story({ id: 'why1', originalInstruction: ins });
    expect(isFeatureStory(row)).toBe(true);
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle).toMatch(/fix recurring ui message|resolve:/i);
  });

  it('routes user-vs-agent messaging clarification to a clear feature title', () => {
    const ins =
      "I'm not talking about chats with the agent, I'm talking about users messaging and calls.";
    const row = story({ id: 'msg1', originalInstruction: ins });
    expect(isFeatureStory(row)).toBe(true);
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle).toContain('Separate user messaging');
  });

  it('still lists substantive work with search keywords', () => {
    const ins =
      'Please extend search so multi-keyword AND matching is supported in Study results.';
    const row = story({ id: 'search1', originalInstruction: ins, section: 'Search', area: 'Navigation + Discovery' });
    expect(isFeatureStory(row)).toBe(true);
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle).toMatch(/search/i);
  });

  it('maps migration + VPS handoff to a concrete ops title (not chat preamble)', () => {
    const ins =
      'Move on as per your recommendations. And apply the migration whenever it is appropriate. I assume you can SSH into the VPS and do it.';
    const row = story({ id: 'migrate1', originalInstruction: ins });
    expect(isFeatureStory(row)).toBe(true);
    const [curated] = buildCuratedStoryList([row]);
    expect(featureTitleLooksUnclear(curated.featureTitle)).toBe(false);
    expect(curated.featureTitle).toMatch(/migration|vps/i);
  });

  it('drops pure "move on as per recommendations" with no concrete work', () => {
    const row = story({ id: 'meta-move', originalInstruction: 'Move on as per your recommendations.' });
    expect(isFeatureStory(row)).toBe(false);
    expect(buildCuratedStoryList([row])).toHaveLength(0);
  });

  it('groups shell icon / swap requests under a clear navigation title', () => {
    const ins =
      'Swap Messaging and Market icons with places. The Messaging icon takes up more space than the rest on Home.';
    const row = story({ id: 'nav1', originalInstruction: ins, section: 'Home', area: 'Navigation + Discovery' });
    expect(isFeatureStory(row)).toBe(true);
    const [curated] = buildCuratedStoryList([row]);
    expect(featureTitleLooksUnclear(curated.featureTitle)).toBe(false);
    expect(curated.featureTitle.toLowerCase()).toMatch(/navigation|icon/);
  });

  it('groups decentralization-related chat (typos and different phrasing) into one story', () => {
    const list = buildCuratedStoryList([
      story({
        id: 'dec1',
        originalInstruction:
          "Move on, but it's not good that after your work the Decentralization doesn't move forward as I expected.",
      }),
      story({
        id: 'dec2',
        originalInstruction:
          'Now move on to the next slice, and from now on display the overall Decentralizaiton % and the separate percentage of each slice.',
      }),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].relatedCount).toBe(2);
    expect(list[0].featureTitle).toMatch(/decentralization/i);
  });

  it('excludes “next slice now” and similar process-only chatter', () => {
    const slice1 = story({
      id: 'slice1',
      originalInstruction: 'So, can we move on to the next slice now?',
    });
    const slice2 = story({
      id: 'slice2',
      originalInstruction: "Move on to the next slice now, if we're done with the previous one.",
    });
    const slice3 = story({
      id: 'slice3',
      originalInstruction: 'Move on, and at the end of every rerport summarize what was done.',
    });
    expect(buildCuratedStoryList([slice1, slice2, slice3])).toHaveLength(0);
  });

  it('keeps preload follow-ups when the user names preload explicitly', () => {
    const ins = 'Did you take all necessary measures to have it preload critical views on cold start?';
    const row = story({ id: 'preload1', originalInstruction: ins });
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle).toMatch(/preload|startup/i);
  });

  it('uses the curated feature title as summary for vague preload check-in phrasing', () => {
    const ins = 'Did you take all necessary measures to have it preload to avoid any errors?';
    const row = story({ id: 'preload2', originalInstruction: ins });
    const [curated] = buildCuratedStoryList([row]);
    expect(buildReaderFacingSummary(curated)).toBe(curated.featureTitle);
  });

  it('excludes chunk-plan typos (chunds / chuncks)', () => {
    expect(
      buildCuratedStoryList([
        story({ id: 'ty1', originalInstruction: 'Move on with larger chunds if possible.' }),
        story({ id: 'ty2', originalInstruction: 'Divide the plan into possible larger chuncks and implement that way.' }),
      ]),
    ).toHaveLength(0);
  });

  it('summarizes restart + connection failure with a stability headline when the user asks for a fix', () => {
    const ins =
      'I just restarted the application, but this time it failed to connect. Please check and fix the issue.';
    const row = story({ id: 'conn1', originalInstruction: ins, section: 'General', area: 'Stability + Bug Fixes' });
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle).toMatch(/connectivity|connection/i);
  });

  it('hides low-signal git manifest chore commits from the journal', () => {
    const row = story({
      id: 'git1',
      title: 'Chore: refresh android-testing update manifest for v0.1.29 Made-with: Cursor',
      originalInstruction: 'chore: refresh android-testing update manifest for v0.1.29\n\nMade-with: Cursor',
      rephrasedDescription:
        'Implemented repository change: chore: refresh android-testing update manifest for v0.1.29.',
    });
    expect(isFeatureStory(row)).toBe(false);
    expect(buildCuratedStoryList([row])).toHaveLength(0);
  });

  it('routes founder / citizen access instructions to a governance headline', () => {
    const ins =
      'Since at least in this stage there are no other authorities to develop, see improve and manage the functionality of the app. The Founder should see all pages and Citizens and Departments have limited access.';
    const row = story({ id: 'gov1', originalInstruction: ins, section: 'General', area: 'Security + Access' });
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle).toMatch(/governance|founder|access/i);
  });

  it('routes Home Stories tab wording tweaks to a copy headline', () => {
    const ins =
      'Remove the wording "Development Stories" — move the explanative sentence "Requests and implemented outcomes, documented…" above the list.';
    const row = story({ id: 'copy1', originalInstruction: ins });
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle).toMatch(/stories|helper|copy|labels/i);
  });

  it('strips duplicate list markers from curated titles', () => {
    const row = story({
      id: 'bul1',
      originalInstruction: '• - Remove redundant labels from the Settings header for clarity.',
    });
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle.startsWith('•')).toBe(false);
    expect(curated?.featureTitle).toMatch(/^remove redundant labels/i);
  });

  it('groups SSH / VPS access asks under one infrastructure title', () => {
    const ins =
      'Is there a way you could set up a persistent SSH access to the VPS so we can debug migrations without re-keying each time?';
    const row = story({ id: 'ssh1', originalInstruction: ins });
    const [curated] = buildCuratedStoryList([row]);
    expect(curated?.featureTitle).toMatch(/ssh|server operations/i);
  });

  it('excludes meta move-on / chunking process lines without a product spec', () => {
    const chunks = story({
      id: 'chunks1',
      originalInstruction: 'Divide the plan into possible larger chunks and implement that way.',
    });
    const moveChunks = story({ id: 'chunks2', originalInstruction: 'Move on, with larger chunks if possible.' });
    const rant = story({
      id: 'rant1',
      originalInstruction: "You didn't Move On again after reporting. You're gonna bring up another excuse, right?",
    });
    expect(isFeatureStory(chunks)).toBe(false);
    expect(isFeatureStory(moveChunks)).toBe(false);
    expect(isFeatureStory(rant)).toBe(false);
    expect(buildCuratedStoryList([chunks, moveChunks, rant])).toHaveLength(0);
  });

  it('regression: no curated row uses banned vague title substrings', () => {
    const batch = [
      story({
        id: 'a',
        originalInstruction:
          'Move on as per your recommendations. And apply the migration whenever it is appropriate. SSH into VPS.',
      }),
      story({
        id: 'b',
        originalInstruction: 'What if we replace the Contribute icon with the Messaging one on Home?',
        section: 'Home',
      }),
      story({ id: 'c', originalInstruction: 'Fix the Messaging page to display fully on mobile devices.' }),
    ];
    const out = buildCuratedStoryList(batch);
    for (const row of out) {
      expect(featureTitleLooksUnclear(row.featureTitle)).toBe(false);
    }
  });

  it('excludes singular or emphatic larger-chunk move-on chatter', () => {
    const rows = buildCuratedStoryList([
      story({ id: 'mc1', originalInstruction: "Move on, with a much larger chunk if possible, so that we don't get stuck on 30% forever." }),
      story({ id: 'mc2', originalInstruction: 'Move on with larger chunk if possible.' }),
    ]);
    expect(rows).toHaveLength(0);
  });

  it('groups Study article open-state requests under one title', () => {
    const rows = buildCuratedStoryList([
      story({
        id: 'sa1',
        originalInstruction: "Help me fix: when I just open the domain (e.g. Economy & Luma) the articles shouldn't be open by default.",
        section: 'Study',
        area: 'UI/UX',
      }),
      story({
        id: 'sa2',
        originalInstruction: 'Help me fix: all articles should open, display and function the same way on the Study page.',
        section: 'Study',
        area: 'UI/UX',
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].relatedCount).toBe(2);
    expect(rows[0].featureTitle).toMatch(/study article|open-state|expansion/i);
  });

  it('groups Study tabs and close-control requests with a clear title', () => {
    const rows = buildCuratedStoryList([
      story({
        id: 'st1',
        originalInstruction:
          'You moved the "Civic Learning Center" up, but did not remove it from the tabs list, remove it, as we do not want repetitive wordings on the same page.',
        section: 'Study',
        area: 'UI/UX',
      }),
      story({
        id: 'st2',
        originalInstruction: 'No, remove the close button, there should be no additional elements on the page.',
        section: 'Study',
        area: 'UI/UX',
      }),
      story({
        id: 'st3',
        originalInstruction: 'Where is the "Courses" tab, did you remove it? Please never remove anything without asking.',
        section: 'Study',
        area: 'UI/UX',
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].relatedCount).toBe(3);
    expect(rows[0].featureTitle).toMatch(/study tabs|panel controls/i);
  });
});
