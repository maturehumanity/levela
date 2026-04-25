import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { studyCourses } from '@/lib/study-courses';

const weekdayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export default function StudySchedules() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const courseId = params.get('course');
  const course = useMemo(() => studyCourses.find((c) => c.id === courseId) ?? null, [courseId]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('study.schedules.intro')}</p>

      {course ? (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">{t(course.titleKey)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('study.schedules.linkedCourse')}</p>
        </Card>
      ) : (
        <Card className="border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
          {t('study.schedules.noCourse')}
        </Card>
      )}

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">{t('study.schedules.templateTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('study.schedules.templateHint')}</p>
          <ul className="mt-4 space-y-2">
            {weekdayKeys.map((day) => (
              <li
                key={day}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">{t(`study.schedules.weekdays.${day}`)}</span>
                <Badge variant="outline" className="rounded-full">
                  {t('study.schedules.slotPlaceholder')}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="text-primary underline-offset-4 hover:underline" to="/study/courses">
          {t('study.schedules.backCourses')}
        </Link>
      </div>
    </div>
  );
}
