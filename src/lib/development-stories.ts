export interface DevelopmentStory {
  id: string;
  requestedAt: string;
  storyKind: 'development' | 'suggestion';
  section: string;
  area: string;
  title: string;
  originalInstruction: string;
  rephrasedDescription: string;
  createdFeatures: string[];
  expectedBehavior: string;
}

const developmentStories: DevelopmentStory[] = [
  {
    id: 'home-inline-search',
    requestedAt: '2026-04-25T09:25:00.000Z',
    storyKind: 'development',
    section: 'Home',
    area: 'Navigation + Discovery',
    title: 'Move search into Home and remove Find People card',
    originalInstruction:
      'Remove the Find People card and show search directly on Home when the search icon is clicked, without opening a new page.',
    rephrasedDescription:
      'The Home experience should support in-place discovery. Search should open inline from the header icon, and the separate Find People quick card should be removed to reduce navigation jumps.',
    createdFeatures: [
      'Inline search block rendered on Home page',
      'Search icon action changed from route navigation to inline toggle',
      'Find People quick-action card removed from Home',
      'Shared search block component extracted for reuse',
    ],
    expectedBehavior:
      'Users stay on Home while searching for people, companies, products, and services. The same search interaction no longer requires opening the standalone Search route.',
  },
  {
    id: 'home-inline-search-toggle-only',
    requestedAt: '2026-04-25T09:30:00.000Z',
    storyKind: 'development',
    section: 'Home',
    area: 'Interaction Design',
    title: 'Use icon toggle only for opening and hiding search',
    originalInstruction:
      'Users should click the search icon again to hide search, and there should be no additional close element on the page.',
    rephrasedDescription:
      'Keep the interaction minimal: the search icon should act as both open and close control. Avoid adding separate close buttons to preserve visual simplicity.',
    createdFeatures: [
      'Search icon changed to toggle inline search visibility both directions',
      'Temporary inline close button removed',
    ],
    expectedBehavior:
      'Tapping the header search icon once shows inline search; tapping it again hides it. No extra close controls appear in the Home body.',
  },
  {
    id: 'home-top-tabs',
    requestedAt: '2026-04-25T19:35:00.000Z',
    storyKind: 'development',
    section: 'Home',
    area: 'Content Sorting',
    title: 'Add top tabs for Home content segmentation',
    originalInstruction:
      'Add tabs on top of Home before the score card: All, Favourite, Stories, so users can start sorting information.',
    rephrasedDescription:
      'Introduce top-level Home segmentation so users can quickly switch between full view, priority/favourite content, and the stories stream.',
    createdFeatures: [
      'Top tab bar added above the score card',
      'All/Favourite/Stories view logic wired into Home rendering',
    ],
    expectedBehavior:
      'Users can change Home focus using tabs. The screen adapts displayed blocks by selected tab.',
  },
  {
    id: 'stories-as-development-journal',
    requestedAt: '2026-04-25T19:44:00.000Z',
    storyKind: 'development',
    section: 'Home / Stories',
    area: 'Product Governance + Transparency',
    title: 'Document instruction history as classified stories',
    originalInstruction:
      'Automatically add my instructions into Stories tab with clear rephrasing and explanations, reverse chronological order, and classification by section/page and area.',
    rephrasedDescription:
      'Stories should become a visible development journal. Each entry must preserve request intent, provide a clear product explanation, and remain easy to browse by page and domain.',
    createdFeatures: [
      'Development story model created with structured metadata',
      'Reverse chronological sorting for story timeline',
      'Classification fields introduced (section and area)',
      'Foundation for timeline filters and future automation',
    ],
    expectedBehavior:
      'The Stories tab becomes a transparent historical feed of product instructions and outcomes, usable by builders and citizens to follow ecosystem evolution.',
  },
];

export function getSeedDevelopmentStories() {
  return [...developmentStories].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  );
}
