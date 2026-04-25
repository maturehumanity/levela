import { specialistProfiles, type SpecialistMode, type SpecialistProfile } from '@/lib/specialists';

export type SpecialistClassifierResult = {
  mode: SpecialistMode;
  riskLevel: 'low' | 'medium' | 'high';
  urgency: 'normal' | 'high';
  confidence: number;
  matchedKeywords: string[];
};

export type SpecialistOpinion = {
  specialistId: string;
  specialistName: string;
  focus: string;
  recommendations: string[];
  cautions: string[];
  rationale: string;
};

export type SpecialistCouncilResult = {
  requestedText: string;
  classifier: SpecialistClassifierResult;
  matchedSpecialists: SpecialistProfile[];
  leadSpecialist: SpecialistProfile;
  opinions: SpecialistOpinion[];
  finalSuggestion: string;
};

function inferMode(text: string): SpecialistMode {
  const lowered = text.toLowerCase();
  if (
    lowered.includes('issue')
    || lowered.includes('problem')
    || lowered.includes('resolve')
    || lowered.includes('fix')
    || lowered.includes('dispute')
  ) {
    return 'resolveIssues';
  }
  if (
    lowered.includes('improve')
    || lowered.includes('optimize')
    || lowered.includes('better')
    || lowered.includes('grow')
    || lowered.includes('strategy')
  ) {
    return 'improve';
  }
  return 'study';
}

function inferRiskLevel(text: string): 'low' | 'medium' | 'high' {
  const lowered = text.toLowerCase();
  const highRiskTokens = [
    'legal',
    'law',
    'compliance',
    'medical',
    'health emergency',
    'security breach',
    'incident',
    'fraud',
    'harm',
  ];
  const mediumRiskTokens = ['policy', 'governance', 'finance', 'budget', 'contract'];

  if (highRiskTokens.some((token) => lowered.includes(token))) return 'high';
  if (mediumRiskTokens.some((token) => lowered.includes(token))) return 'medium';
  return 'low';
}

function inferUrgency(text: string): 'normal' | 'high' {
  const lowered = text.toLowerCase();
  return ['urgent', 'asap', 'immediately', 'right now', 'today'].some((token) => lowered.includes(token))
    ? 'high'
    : 'normal';
}

function detectMatchedKeywords(text: string): string[] {
  const lowered = text.toLowerCase();
  const allKeywords = specialistProfiles.flatMap((specialist) => specialist.triggerKeywords);
  const deduped = Array.from(new Set(allKeywords));
  return deduped.filter((keyword) => lowered.includes(keyword)).slice(0, 8);
}

function buildClassifier(text: string): SpecialistClassifierResult {
  const matchedKeywords = detectMatchedKeywords(text);
  const confidenceBase = matchedKeywords.length === 0 ? 0.5 : Math.min(0.95, 0.55 + matchedKeywords.length * 0.05);
  return {
    mode: inferMode(text),
    riskLevel: inferRiskLevel(text),
    urgency: inferUrgency(text),
    confidence: Number(confidenceBase.toFixed(2)),
    matchedKeywords,
  };
}

function scoreSpecialistMatch(text: string, specialist: SpecialistProfile): number {
  const lowered = text.toLowerCase();
  let score = 0;

  for (const keyword of specialist.triggerKeywords) {
    if (lowered.includes(keyword)) score += 2;
  }
  for (const area of specialist.knowledgeAreas) {
    if (lowered.includes(area)) score += 1;
  }
  return score;
}

function modeFocus(mode: SpecialistMode) {
  if (mode === 'study') return 'Clarify concepts, assumptions, and foundational understanding.';
  if (mode === 'improve') return 'Design better options with measurable progress steps.';
  return 'Diagnose root causes and prioritize risk-aware actions.';
}

function buildSpecialistOpinion(
  specialist: SpecialistProfile,
  mode: SpecialistMode,
  text: string,
  riskLevel: SpecialistClassifierResult['riskLevel'],
): SpecialistOpinion {
  const lowered = text.toLowerCase();
  const relevantKeywords = specialist.triggerKeywords.filter((keyword) => lowered.includes(keyword)).slice(0, 3);
  const keywordContext = relevantKeywords.length > 0 ? relevantKeywords.join(', ') : specialist.domain.toLowerCase();

  const cautionEscalation =
    riskLevel === 'high'
      ? 'Treat this as high-impact; require qualified human review before irreversible actions.'
      : 'Escalate legal/health/financial high-impact decisions for qualified review.';

  const adapter: Record<string, { rationale: string; recommendations: string[] }> = {
    sociology: {
      rationale: `Detected social context signals: ${keywordContext}.`,
      recommendations: [
        mode === 'resolveIssues'
          ? 'Map stakeholder groups and identify where trust or coordination broke down.'
          : 'Profile community segments and define behavior-change objectives.',
        'Design interventions with explicit feedback loops from affected groups.',
      ],
    },
    economics: {
      rationale: `Detected economic/financial context signals: ${keywordContext}.`,
      recommendations: [
        mode === 'study'
          ? 'Define incentives, opportunity cost, and externalities before discussing solutions.'
          : 'Compare at least three options using cost, feasibility, and public-value impact.',
        'Document assumptions behind demand, supply, and budget tradeoffs.',
      ],
    },
    technology: {
      rationale: `Detected technical context signals: ${keywordContext}.`,
      recommendations: [
        mode === 'resolveIssues'
          ? 'Triage severity, isolate affected systems, and establish rollback/fallback paths first.'
          : 'Break work into architecture, implementation, and verification phases.',
        'Define acceptance criteria with logging and monitoring checkpoints.',
      ],
    },
    marketing: {
      rationale: `Detected audience/growth context signals: ${keywordContext}.`,
      recommendations: [
        'Clarify audience segments, key message, and channel plan before execution.',
        'Define campaign hypotheses and measurable outcomes before spending resources.',
      ],
    },
    healthcare: {
      rationale: `Detected health/wellbeing context signals: ${keywordContext}.`,
      recommendations: [
        mode === 'resolveIssues'
          ? 'Prioritize safety triage first, then route to appropriate care pathways.'
          : 'Focus on prevention, health literacy, and practical care navigation.',
        'Separate educational guidance from diagnosis and treatment decisions.',
      ],
    },
    politics: {
      rationale: `Detected governance/public administration context signals: ${keywordContext}.`,
      recommendations: [
        'Map institutional constraints and stakeholders before proposing changes.',
        'Provide neutral, comparative options and expected downstream effects.',
      ],
    },
    ethics: {
      rationale: `Detected ethical reasoning context signals: ${keywordContext}.`,
      recommendations: [
        'Frame options by rights, duties, fairness, and harm minimization.',
        'Make moral tradeoffs explicit, including who bears each risk.',
      ],
    },
    'legal-governance': {
      rationale: `Detected legal/compliance context signals: ${keywordContext}.`,
      recommendations: [
        mode === 'resolveIssues'
          ? 'Define immediate compliance-safe actions and a documented escalation path.'
          : 'Interpret applicable rules, obligations, and governance scope.',
        'Convert legal constraints into operational guardrails before execution.',
      ],
    },
  };

  const domainAdapter = adapter[specialist.domainId] ?? {
    rationale: `Routed by specialist domain match: ${specialist.domain}.`,
    recommendations: [
      `Apply ${specialist.skills[0] || 'domain analysis'} before committing to implementation.`,
      `Use ${specialist.skills[1] || 'structured planning'} to produce options and tradeoffs.`,
    ],
  };

  return {
    specialistId: specialist.id,
    specialistName: specialist.name,
    focus: modeFocus(mode),
    recommendations: domainAdapter.recommendations,
    cautions: ['Separate assumptions from verified facts.', cautionEscalation],
    rationale: domainAdapter.rationale,
  };
}

function buildFinalSuggestion(classifier: SpecialistClassifierResult, opinions: SpecialistOpinion[]): string {
  const lead = opinions[0];
  const collaborating = opinions.slice(1).map((opinion) => opinion.specialistName);
  const modeLabel =
    classifier.mode === 'study' ? 'Study' : classifier.mode === 'improve' ? 'Improve' : 'Resolve Issues';
  const riskNote = classifier.riskLevel === 'high' ? ' Include formal review before execution.' : '';

  if (collaborating.length === 0) {
    return `${modeLabel} recommendation: Start with ${lead.specialistName}'s guidance, then produce a single action plan with assumptions, options, and next steps.${riskNote}`;
  }

  return `${modeLabel} recommendation: Lead with ${lead.specialistName}, incorporate input from ${collaborating.join(', ')}, then synthesize one combined plan with prioritized actions and risk notes.${riskNote}`;
}

export function runSpecialistCouncil(userText: string): SpecialistCouncilResult {
  const classifier = buildClassifier(userText);
  const scored = specialistProfiles
    .map((specialist) => ({
      specialist,
      score: scoreSpecialistMatch(userText, specialist),
    }))
    .sort((a, b) => b.score - a.score);

  const positive = scored.filter((entry) => entry.score > 0).map((entry) => entry.specialist);
  const matchedSpecialists = (positive.length > 0 ? positive : [scored[0].specialist]).filter((specialist) =>
    specialist.modes.includes(classifier.mode),
  );
  const leadSpecialist = matchedSpecialists[0] || specialistProfiles[0];
  const opinions = matchedSpecialists.map((specialist) =>
    buildSpecialistOpinion(specialist, classifier.mode, userText, classifier.riskLevel),
  );
  const finalSuggestion = buildFinalSuggestion(classifier, opinions);

  return {
    requestedText: userText,
    classifier,
    matchedSpecialists,
    leadSpecialist,
    opinions,
    finalSuggestion,
  };
}
