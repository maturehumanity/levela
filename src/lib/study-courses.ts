export type LearnerTrackId = 'school' | 'university' | 'citizen';

export type StudyCourse = {
  id: string;
  track: LearnerTrackId;
  titleKey: string;
  summaryKey: string;
  estimatedWeeks: number;
  /** Keys matching `study.tests` catalog or future quiz ids */
  testIds: string[];
  /** Material keys from foundational library or course-specific ids */
  materialKeys: string[];
};

export const studyCourses: StudyCourse[] = [
  {
    id: 'civic-foundations-school',
    track: 'school',
    titleKey: 'study.courses.items.civicFoundationsSchool.title',
    summaryKey: 'study.courses.items.civicFoundationsSchool.summary',
    estimatedWeeks: 6,
    testIds: ['civic-basics-quiz'],
    materialKeys: ['constitution-core', 'constitution-summary', 'citizenship-pathways'],
  },
  {
    id: 'civic-foundations-university',
    track: 'university',
    titleKey: 'study.courses.items.civicFoundationsUniversity.title',
    summaryKey: 'study.courses.items.civicFoundationsUniversity.summary',
    estimatedWeeks: 4,
    testIds: ['civic-basics-quiz', 'governance-literacy-quiz'],
    materialKeys: [
      'constitution-core',
      'law-framework',
      'economy-policy-baseline',
      'economy-constitutional-tokenomics-governance',
    ],
  },
  {
    id: 'self-paced-citizen',
    track: 'citizen',
    titleKey: 'study.courses.items.selfPacedCitizen.title',
    summaryKey: 'study.courses.items.selfPacedCitizen.summary',
    estimatedWeeks: 8,
    testIds: ['civic-basics-quiz'],
    materialKeys: ['constitution-summary', 'citizenship-rights-summary', 'economy-citizen-guide'],
  },
];

export function getCoursesByTrack(track: LearnerTrackId) {
  return studyCourses.filter((course) => course.track === track);
}
