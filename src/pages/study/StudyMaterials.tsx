import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { permissionListHasAny } from '@/lib/access-control';
import { studyCourses } from '@/lib/study-courses';
import { FOUNDATION_STUDY_MATERIALS } from '@/lib/study';

export default function StudyMaterials() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canReadLaw = permissionListHasAny(profile?.effective_permissions || [], ['law.read']);
  const [params] = useSearchParams();
  const courseId = params.get('course');
  const course = useMemo(() => studyCourses.find((c) => c.id === courseId) ?? null, [courseId]);

  const materials = useMemo(() => {
    if (!course) return FOUNDATION_STUDY_MATERIALS;
    return FOUNDATION_STUDY_MATERIALS.filter((m) => course.materialKeys.includes(m.key));
  }, [course]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('study.materialsPage.intro')}</p>

      {course ? (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">{t(course.titleKey)}</p>
        </Card>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-3 md:grid-cols-2"
      >
        {materials.map((material, index) => {
          const isDisabled = material.domainId === 'laws' && !canReadLaw;
          return (
            <motion.div
              key={material.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
                <h3 className="font-semibold text-foreground">{t(material.titleKey)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(material.summaryKey)}</p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={isDisabled || !material.availableNow}
                    onClick={() => !isDisabled && material.availableNow && navigate(material.route)}
                  >
                    {isDisabled ? t('study.lawAccessRequired') : t('study.openMaterial')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <Link className="text-sm text-primary underline-offset-4 hover:underline" to="/study/courses">
        {t('study.materialsPage.backCourses')}
      </Link>
    </div>
  );
}
