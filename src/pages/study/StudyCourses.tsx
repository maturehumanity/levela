import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCoursesByTrack, type LearnerTrackId } from '@/lib/study-courses';

const tracks: LearnerTrackId[] = ['school', 'university', 'citizen'];

export default function StudyCourses() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('study.courses.intro')}</p>

      <Tabs defaultValue="school" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/80 p-1">
          {tracks.map((track) => (
            <TabsTrigger key={track} value={track} className="rounded-lg px-2 text-xs sm:text-sm">
              {t(`study.courses.tracks.${track}.label`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {tracks.map((track) => (
          <TabsContent key={track} value={track} className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t(`study.courses.tracks.${track}.description`)}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {getCoursesByTrack(track).map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{t(course.titleKey)}</h3>
                      <Badge variant="outline" className="rounded-full">
                        {t('study.courses.weeksLabel', { weeks: course.estimatedWeeks })}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t(course.summaryKey)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/study/schedules?course=${course.id}`}>{t('study.courses.openSchedule')}</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/study/materials?course=${course.id}`}>{t('study.courses.openMaterials')}</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/study/tests?course=${course.id}`}>{t('study.courses.openTests')}</Link>
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
