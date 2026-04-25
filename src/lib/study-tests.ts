export type StudyTestDefinition = {
  id: string;
  titleKey: string;
  summaryKey: string;
  questionCount: number;
  /** Related course ids from `study-courses` */
  courseIds: string[];
};

export const studyTestCatalog: StudyTestDefinition[] = [
  {
    id: 'civic-basics-quiz',
    titleKey: 'study.tests.items.civicBasics.title',
    summaryKey: 'study.tests.items.civicBasics.summary',
    questionCount: 12,
    courseIds: ['civic-foundations-school', 'civic-foundations-university', 'self-paced-citizen'],
  },
  {
    id: 'governance-literacy-quiz',
    titleKey: 'study.tests.items.governanceLiteracy.title',
    summaryKey: 'study.tests.items.governanceLiteracy.summary',
    questionCount: 10,
    courseIds: ['civic-foundations-university'],
  },
];
