import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  insertSpecialistDiscussionTurn,
  isMissingSpecialistDiscussionsBackend,
  loadSpecialistDiscussionSessions,
  loadSpecialistDiscussionTurnIndexes,
  type SpecialistDiscussionTurnIndex,
  upsertSpecialistDiscussionSession,
} from '@/lib/specialist-discussions-backend';
import { runSpecialistCouncil } from '@/lib/specialist-orchestration';
import {
  appendTurnToSession,
  buildContextualRequest,
  createDiscussionSession,
  createDiscussionTurn,
  readDiscussionSessions,
  upsertSession,
  writeDiscussionSessions,
  type SpecialistDiscussionSession,
} from '@/lib/specialist-discussions';
import { specialistModes, specialistProfiles } from '@/lib/specialists';

type StudySpecialistsProps = {
  embedded?: boolean;
};

export default function StudySpecialists({ embedded = false }: StudySpecialistsProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [requestText, setRequestText] = useState(
    'We need help improving a community health campaign and local participation.',
  );
  const [sessions, setSessions] = useState<SpecialistDiscussionSession[]>([]);
  const [backendTurnIndexes, setBackendTurnIndexes] = useState<SpecialistDiscussionTurnIndex[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [latestCouncil, setLatestCouncil] = useState(() => runSpecialistCouncil(requestText));
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [analyticsWindow, setAnalyticsWindow] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [selectedTrendDayIndex, setSelectedTrendDayIndex] = useState<number | null>(null);
  const [selectedLeadSpecialistId, setSelectedLeadSpecialistId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!profile?.id) {
        const stored = readDiscussionSessions();
        if (cancelled) return;
        setSessions(stored);
        if (stored.length > 0) setActiveSessionId(stored[0].id);
        return;
      }

      const response = await loadSpecialistDiscussionSessions(profile.id);
      const turnResponse = await loadSpecialistDiscussionTurnIndexes(profile.id);
      if (cancelled) return;

      if (
        (response.error && isMissingSpecialistDiscussionsBackend(response.error))
        || (turnResponse.error && isMissingSpecialistDiscussionsBackend(turnResponse.error))
      ) {
        setBackendUnavailable(true);
        const stored = readDiscussionSessions();
        setSessions(stored);
        setBackendTurnIndexes([]);
        if (stored.length > 0) setActiveSessionId(stored[0].id);
        return;
      }

      if (response.error || turnResponse.error) {
        const stored = readDiscussionSessions();
        setSessions(stored);
        setBackendTurnIndexes([]);
        if (stored.length > 0) setActiveSessionId(stored[0].id);
        return;
      }

      setBackendUnavailable(false);
      setSessions(response.sessions);
      setBackendTurnIndexes(turnResponse.turns);
      if (response.sessions.length > 0) setActiveSessionId(response.sessions[0].id);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    writeDiscussionSessions(sessions);
  }, [sessions]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  const analyticsSourceTurns = useMemo(() => {
    if (backendTurnIndexes.length > 0) return backendTurnIndexes;
    return sessions.flatMap((session) =>
      session.turns.map((turn) => ({
        id: turn.id,
        turnCreatedAt: turn.createdAt,
        mode: turn.result.classifier.mode,
        riskLevel: turn.result.classifier.riskLevel,
        leadSpecialistId: turn.result.leadSpecialist.id,
        matchedSpecialistIds: turn.result.matchedSpecialists.map((specialist) => specialist.id),
      })),
    );
  }, [backendTurnIndexes, sessions]);

  const filteredAnalyticsTurns = useMemo(() => {
    if (analyticsWindow === 'all') return analyticsSourceTurns;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const windowMs =
      analyticsWindow === 'today'
        ? dayMs
        : analyticsWindow === '7d'
          ? 7 * dayMs
          : 30 * dayMs;
    return analyticsSourceTurns.filter((turn) => now - new Date(turn.turnCreatedAt).getTime() <= windowMs);
  }, [analyticsSourceTurns, analyticsWindow]);

  const analytics = useMemo(() => {
    const modeCounts = { study: 0, improve: 0, resolveIssues: 0 } as Record<string, number>;
    const riskCounts = { low: 0, medium: 0, high: 0 } as Record<string, number>;
    const leadCounts = new Map<string, number>();

    for (const turn of filteredAnalyticsTurns) {
      modeCounts[turn.mode] = (modeCounts[turn.mode] ?? 0) + 1;
      riskCounts[turn.riskLevel] = (riskCounts[turn.riskLevel] ?? 0) + 1;
      leadCounts.set(turn.leadSpecialistId, (leadCounts.get(turn.leadSpecialistId) ?? 0) + 1);
    }

    const totalTurns = filteredAnalyticsTurns.length;
    const topLeads = Array.from(leadCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({
        id,
        count,
        name: specialistProfiles.find((specialist) => specialist.id === id)?.name ?? id,
      }));

    return { totalTurns, modeCounts, riskCounts, topLeads };
  }, [filteredAnalyticsTurns]);

  const trend = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const labels = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(Date.now() - (6 - index) * dayMs);
      return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    });

    const dayRanges = labels.map((_, index) => {
      const start = Date.now() - (7 - index) * dayMs;
      const end = Date.now() - (6 - index) * dayMs;
      return { start, end };
    });

    const buckets = labels.map((_, index) => {
      const { start, end } = dayRanges[index];
      const turns = filteredAnalyticsTurns.filter((turn) => {
        const ts = new Date(turn.turnCreatedAt).getTime();
        return ts >= start && ts < end;
      });
      return {
        modeCount: turns.filter((turn) => turn.mode === 'resolveIssues').length,
        riskCount: turns.filter((turn) => turn.riskLevel === 'high').length,
      };
    });

    const maxMode = Math.max(1, ...buckets.map((bucket) => bucket.modeCount));
    const maxRisk = Math.max(1, ...buckets.map((bucket) => bucket.riskCount));
    return { labels, dayRanges, buckets, maxMode, maxRisk };
  }, [filteredAnalyticsTurns]);

  const filteredActiveSessionTurns = useMemo(() => {
    if (!activeSession) return [];
    const base = activeSession.turns.slice().reverse();
    return base.filter((turn) => {
      const matchesDay = (() => {
        if (selectedTrendDayIndex === null) return true;
        const range = trend.dayRanges[selectedTrendDayIndex];
        if (!range) return true;
        const ts = new Date(turn.createdAt).getTime();
        return ts >= range.start && ts < range.end;
      })();

      const matchesLead = selectedLeadSpecialistId
        ? turn.result.leadSpecialist.id === selectedLeadSpecialistId
        : true;

      return matchesDay && matchesLead;
    });
  }, [activeSession, selectedTrendDayIndex, selectedLeadSpecialistId, trend.dayRanges]);

  const createNewSession = () => {
    const session = createDiscussionSession(requestText);
    setSessions((previous) => {
      const next = upsertSession(previous, session);
      if (profile?.id && !backendUnavailable) {
        void upsertSpecialistDiscussionSession(profile.id, session).then(({ error }) => {
          if (isMissingSpecialistDiscussionsBackend(error)) {
            setBackendUnavailable(true);
          }
        });
      }
      return next;
    });
    setActiveSessionId(session.id);
  };

  const handleAnalyze = () => {
    const seededSession = activeSession ?? createDiscussionSession(requestText);
    if (!activeSession) {
      setSessions((previous) => upsertSession(previous, seededSession));
      setActiveSessionId(seededSession.id);
    }

    const contextualRequest = buildContextualRequest(seededSession, requestText);
    const result = runSpecialistCouncil(contextualRequest);
    const turn = createDiscussionTurn(requestText, result);
    const nextSessions = appendTurnToSession(
      activeSession ? sessions : upsertSession(sessions, seededSession),
      seededSession.id,
      turn,
    );

    setSessions(nextSessions);
    setLatestCouncil(result);
    setBackendTurnIndexes((previous) => [
      {
        id: turn.id,
        turnCreatedAt: turn.createdAt,
        mode: turn.result.classifier.mode,
        riskLevel: turn.result.classifier.riskLevel,
        leadSpecialistId: turn.result.leadSpecialist.id,
        matchedSpecialistIds: turn.result.matchedSpecialists.map((specialist) => specialist.id),
      },
      ...previous,
    ]);

    const updatedSession = nextSessions.find((session) => session.id === seededSession.id);
    if (profile?.id && updatedSession && !backendUnavailable) {
      void Promise.all([
        upsertSpecialistDiscussionSession(profile.id, updatedSession),
        insertSpecialistDiscussionTurn(profile.id, seededSession.id, turn),
      ]).then(([sessionWrite, turnWrite]) => {
        if (
          isMissingSpecialistDiscussionsBackend(sessionWrite.error)
          || isMissingSpecialistDiscussionsBackend(turnWrite.error)
        ) {
          setBackendUnavailable(true);
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t('study.specialistsPage.title')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('study.specialistsPage.description')}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/market')} className="gap-2">
                {t('study.specialists.marketCta')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t('study.specialistsPage.modesIntro')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {specialistModes.map((mode) => (
                <Badge key={mode} variant="secondary" className="rounded-full">
                  {t(`study.specialists.modes.${mode}`)}
                </Badge>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
        <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Discussion Analytics
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick view of mode mix, risk distribution, and top lead specialists across recorded turns.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={analyticsWindow === 'today' ? 'default' : 'outline'}
              onClick={() => setAnalyticsWindow('today')}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={analyticsWindow === '7d' ? 'default' : 'outline'}
              onClick={() => setAnalyticsWindow('7d')}
            >
              7d
            </Button>
            <Button
              size="sm"
              variant={analyticsWindow === '30d' ? 'default' : 'outline'}
              onClick={() => setAnalyticsWindow('30d')}
            >
              30d
            </Button>
            <Button
              size="sm"
              variant={analyticsWindow === 'all' ? 'default' : 'outline'}
              onClick={() => setAnalyticsWindow('all')}
            >
              All
            </Button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Card className="border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Total turns</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{analytics.totalTurns}</p>
            </Card>
            <Card className="border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Mode mix</p>
              <p className="mt-1 text-xs text-foreground/90">
                Study {analytics.modeCounts.study} · Improve {analytics.modeCounts.improve} · Resolve{' '}
                {analytics.modeCounts.resolveIssues}
              </p>
            </Card>
            <Card className="border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Risk mix</p>
              <p className="mt-1 text-xs text-foreground/90">
                Low {analytics.riskCounts.low} · Medium {analytics.riskCounts.medium} · High{' '}
                {analytics.riskCounts.high}
              </p>
            </Card>
          </div>

          {analytics.topLeads.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">Top lead specialists</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analytics.topLeads.map((item) => (
                  <Button
                    key={item.id}
                    size="sm"
                    variant={selectedLeadSpecialistId === item.id ? 'default' : 'outline'}
                    onClick={() =>
                      setSelectedLeadSpecialistId((current) => (current === item.id ? null : item.id))
                    }
                    className="rounded-full"
                  >
                    {item.name}: {item.count}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Card className="border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Resolve Issues trend (last 7 days)</p>
              <div className="mt-2 flex items-end gap-1">
                {trend.buckets.map((bucket, index) => (
                  <div key={`mode-${index}`} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      className={`w-5 rounded-sm ${selectedTrendDayIndex === index ? 'bg-primary' : 'bg-primary/70'}`}
                      style={{ height: `${Math.max(4, (bucket.modeCount / trend.maxMode) * 40)}px` }}
                      title={`${trend.labels[index]}: ${bucket.modeCount}`}
                      onClick={() =>
                        setSelectedTrendDayIndex((current) => (current === index ? null : index))
                      }
                      aria-label={`Resolve trend for ${trend.labels[index]}`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{trend.labels.join(' · ')}</p>
            </Card>
            <Card className="border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">High risk trend (last 7 days)</p>
              <div className="mt-2 flex items-end gap-1">
                {trend.buckets.map((bucket, index) => (
                  <div key={`risk-${index}`} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      className={`w-5 rounded-sm ${selectedTrendDayIndex === index ? 'bg-orange-500' : 'bg-orange-500/70'}`}
                      style={{ height: `${Math.max(4, (bucket.riskCount / trend.maxRisk) * 40)}px` }}
                      title={`${trend.labels[index]}: ${bucket.riskCount}`}
                      onClick={() =>
                        setSelectedTrendDayIndex((current) => (current === index ? null : index))
                      }
                      aria-label={`Risk trend for ${trend.labels[index]}`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{trend.labels.join(' · ')}</p>
            </Card>
          </div>
          {(selectedTrendDayIndex !== null || selectedLeadSpecialistId !== null) && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                History filters:
                {selectedTrendDayIndex !== null ? ` day ${trend.labels[selectedTrendDayIndex]}` : ''}
                {selectedLeadSpecialistId
                  ? ` lead ${
                    specialistProfiles.find((specialist) => specialist.id === selectedLeadSpecialistId)?.name
                    || selectedLeadSpecialistId
                  }`
                  : ''}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedTrendDayIndex(null);
                  setSelectedLeadSpecialistId(null);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {specialistProfiles.map((specialist, index) => (
          <motion.div
            key={specialist.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + index * 0.02 }}
          >
            <Card className="h-full border-border/70 bg-card/95 p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">{specialist.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{specialist.domain}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {specialist.modes.map((mode) => (
                  <Badge key={mode} variant="outline" className="rounded-full text-[10px]">
                    {t(`study.specialists.modes.${mode}`)}
                  </Badge>
                ))}
              </div>
              {specialist.marketEligible ? (
                <p className="mt-2 text-[11px] text-muted-foreground">{t('study.specialistsPage.marketEligible')}</p>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">{t('study.specialistsPage.guidanceOnly')}</p>
              )}
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Nela Specialist Council (Discussion)
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a discussion, add turns, and let Nela combine relevant specialists into one final recommendation.
          </p>
          {backendUnavailable && (
            <p className="mt-2 text-xs text-muted-foreground">
              Discussion sync backend is unavailable in this environment. Sessions are saved on this device.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={createNewSession}>
              New discussion
            </Button>
            <Button size="sm" onClick={handleAnalyze}>
              Analyze request
            </Button>
          </div>

          {sessions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {sessions.map((session) => (
                <Button
                  key={session.id}
                  size="sm"
                  variant={session.id === activeSessionId ? 'default' : 'outline'}
                  onClick={() => setActiveSessionId(session.id)}
                  className="max-w-[220px] justify-start truncate"
                  title={session.title}
                >
                  {session.title}
                </Button>
              ))}
            </div>
          )}

          <Textarea
            className="mt-3"
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            placeholder="Describe what you need help with..."
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">
              Mode: {latestCouncil.classifier.mode}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              Lead: {latestCouncil.leadSpecialist.name}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Matched: {latestCouncil.matchedSpecialists.length}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Risk: {latestCouncil.classifier.riskLevel}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Urgency: {latestCouncil.classifier.urgency}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Confidence: {Math.round(latestCouncil.classifier.confidence * 100)}%
            </Badge>
          </div>

          {latestCouncil.classifier.matchedKeywords.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Signals: {latestCouncil.classifier.matchedKeywords.join(', ')}
            </p>
          )}

          <div className="mt-4 space-y-3">
            {latestCouncil.opinions.map((opinion) => (
              <Card key={opinion.specialistId} className="border-border/70 bg-background/60 p-3">
                <p className="text-sm font-semibold text-foreground">{opinion.specialistName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opinion.focus}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opinion.rationale}</p>
                <ul className="mt-2 space-y-1 text-xs text-foreground/90">
                  {opinion.recommendations.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <Card className="mt-4 border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Final Suggestion</p>
            <p className="mt-1 text-sm text-foreground">{latestCouncil.finalSuggestion}</p>
          </Card>

          {activeSession && activeSession.turns.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Discussion history
              </p>
              {filteredActiveSessionTurns.length === 0 ? (
                <Card className="border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                  No turns in this day filter.
                </Card>
              ) : (
                filteredActiveSessionTurns.map((turn) => (
                  <Card key={turn.id} className="border-border/70 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">{new Date(turn.createdAt).toLocaleString()}</p>
                    <p className="mt-1 text-sm text-foreground">{turn.requestText}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{turn.result.finalSuggestion}</p>
                  </Card>
                ))
              )}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
