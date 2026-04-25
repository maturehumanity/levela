import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { studyCourses } from '@/lib/study-courses';
import { studyTestCatalog } from '@/lib/study-tests';

export default function StudyTests() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const courseId = params.get('course');

  const tests = useMemo(() => {
    if (!courseId) return studyTestCatalog;
    return studyTestCatalog.filter((test) => test.courseIds.includes(courseId));
  }, [courseId]);

  const course = useMemo(() => studyCourses.find((c) => c.id === courseId) ?? null, [courseId]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('study.tests.intro')}</p>

      {course ? (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">{t(course.titleKey)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('study.tests.filteredByCourse')}</p>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {tests.map((test, index) => (
          <motion.div
            key={test.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground">{t(test.titleKey)}</h3>
                <Badge variant="outline" className="rounded-full">
                  {t('study.tests.questionCount', { count: test.questionCount })}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t(test.summaryKey)}</p>
              <Button size="sm" className="mt-4" disabled variant="secondary">
                {t('study.tests.startSoon')}
              </Button>
            </Card>
          </motion.div>
        ))}
      </div>

      <Link className="text-sm text-primary underline-offset-4 hover:underline" to="/study/courses">
        {t('study.tests.backCourses')}
      </Link>
    </div>
  );
}
