import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Nela — in-app assistant (system profile). */
const AGENT_PROFILE_ID = 'a0000000-0000-4000-8000-000000000001';

/** Canonical product framing — keep in sync with in-app Study / governance positioning. */
const LEVELA_PRODUCT_SUMMARY =
  'Levela is a human-centered platform and movement designed to help people unite, grow, and govern more wisely through education, responsibility, transparency, and AI-assisted civic collaboration.';

const NELA_SYSTEM_PROMPT =
  'You are Nela, the in-app assistant for Levela. ' +
  LEVELA_PRODUCT_SUMMARY +
  ' Emphasize civic learning, accountable participation, verifiable governance where it applies, and trustworthy use of AI as a practical aid—not hype or generic “AI will fix everything” claims. ' +
  'Levela is not a generic hobby or meetup social network; never describe it using clichés like “connect people with shared interests” or “facilitate group activities” unless the user is explicitly asking about a real Levela feature that matches that wording. ' +
  'When users correct you about what Levela is, accept the correction, align with the summary above, and do not repeat the mistaken framing. ' +
  'If you are unsure about product purpose, policy, or roadmap details, say you are not sure and point people to in-app Study materials or official project documentation rather than guessing. ' +
  'Explain features, navigation, and general how-to in plain language. ' +
  'For legitimate Levela project requests, collaborate constructively: give concrete, practical analysis and suggest next steps. ' +
  'Do not use meta disclaimers such as “As an AI assistant” or “I cannot think”; instead provide grounded reasoning tied to Levela governance, safety, messaging, marketplace, and civic learning. ' +
  'Keep replies concise and readable; avoid excessive markdown formatting unless the user explicitly asks for structured bullets. ' +
  'If the question needs legal, medical, or financial advice, say you cannot help with that and suggest speaking to a qualified professional or official support. ' +
  'Do not invent product features you are not sure about. ' +
  'When users share constitutional/proposal amendment text or ask for update analysis, provide a concise structured review with sections: Intent, Governance Impact, Risks, and Rollout Checklist. ' +
  'If someone asks what Levela is (especially “in one sentence”), answer with the canonical summary in one concise sentence and do not use alternative framing.';

type Body = {
  conversation_id?: string;
};

type HistoryTurn = { role: 'user' | 'assistant'; content: string };
type ModerationMetricCategory =
  | 'off_topic'
  | 'greeting'
  | 'policy_levela_summary'
  | 'policy_safety'
  | 'policy_governance'
  | 'policy_marketplace'
  | 'policy_privacy'
  | 'abuse_illegal'
  | 'abuse_violence'
  | 'abuse_self_harm'
  | 'abuse_security_abuse'
  | 'abuse_harassment'
  | 'abuse_sexual_minors';

/** Prior Nela placeholder replies confuse Gemini (HTTP 200 but no output `parts`). */
function isFailedNelaPlaceholderAssistant(turn: HistoryTurn): boolean {
  if (turn.role !== 'assistant') return false;
  const c = turn.content.trim().toLowerCase();
  if (!c) return true;
  if (c.includes('could not generate a reply')) return true;
  if (c.includes('not fully configured')) return true;
  if (c.includes('no ai provider key configured')) return true;
  if (c.includes('automated replies are not available')) return true;
  return false;
}

/**
 * Historical wrong framing can poison future generations.
 * Drop prior assistant turns that conflict with Levela's canonical positioning.
 */
function isInaccurateLevelaFramingAssistant(turn: HistoryTurn): boolean {
  if (turn.role !== 'assistant') return false;
  const c = turn.content.trim().toLowerCase();
  if (!c) return false;
  if (!c.includes('levela')) return false;

  const inaccuratePhrases = [
    'community platform',
    'connect people with shared interests',
    'shared interests',
    'facilitate group activities',
    'group activities',
    'hobby',
    'meetup',
  ];
  return inaccuratePhrases.some((p) => c.includes(p));
}

function compactHistoryForLlm(turns: HistoryTurn[]): HistoryTurn[] {
  const filtered = turns.filter((t) => {
    if (!t.content.trim()) return false;
    if (isFailedNelaPlaceholderAssistant(t)) return false;
    if (isInaccurateLevelaFramingAssistant(t)) return false;
    return true;
  });
  const out: HistoryTurn[] = [];
  for (const t of filtered) {
    const content = t.content.trim();
    const prev = out[out.length - 1];
    if (prev && prev.role === t.role) {
      prev.content = `${prev.content}\n${content}`;
    } else {
      out.push({ role: t.role, content });
    }
  }
  return out;
}

type ResolvedLlm =
  | { kind: 'none' }
  | { kind: 'gemini'; key: string; model: string }
  | { kind: 'openai'; key: string };

function resolveLlm(): ResolvedLlm {
  const explicit = (Deno.env.get('NELA_LLM_PROVIDER') ?? '').trim().toLowerCase();
  const geminiKey = (Deno.env.get('GEMINI_API_KEY') ?? '').trim();
  const openaiKey = (Deno.env.get('OPENAI_API_KEY') ?? '').trim();
  const geminiModel = (Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite').trim();

  if (explicit === 'openai') {
    return openaiKey ? { kind: 'openai', key: openaiKey } : { kind: 'none' };
  }
  if (explicit === 'gemini') {
    return geminiKey ? { kind: 'gemini', key: geminiKey, model: geminiModel } : { kind: 'none' };
  }
  // auto: prefer Gemini when present (typical free-tier path); else OpenAI
  if (geminiKey) return { kind: 'gemini', key: geminiKey, model: geminiModel };
  if (openaiKey) return { kind: 'openai', key: openaiKey };
  return { kind: 'none' };
}

function isWhatIsLevelaQuestion(content: string): boolean {
  const c = content.trim().toLowerCase();
  if (!c) return false;
  if (!c.includes('levela')) return false;
  return (
    /^what\s+is\s+levela\b/.test(c) ||
    /^what['’]?s\s+levela\b/.test(c) ||
    /^define\s+levela\b/.test(c) ||
    /^describe\s+levela\b/.test(c) ||
    c.includes('levela in one sentence') ||
    c.includes('what is levela in one sentence')
  );
}

function isGreetingOnly(content: string): boolean {
  const c = content.trim().toLowerCase();
  if (!c) return false;
  return ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'].some((g) => c === g);
}

type AbuseCategory = 'illegal' | 'violence' | 'self-harm' | 'security-abuse' | 'harassment' | 'sexual-minors';

function classifyAbuse(content: string): AbuseCategory | null {
  const c = content.trim().toLowerCase();
  if (!c) return null;

  const hasAny = (terms: string[]) => terms.some((t) => c.includes(t));

  if (
    hasAny([
      'child porn',
      'minor sexual',
      'underage sexual',
      'sexual with minors',
      'groom a child',
      'cp ',
    ])
  ) {
    return 'sexual-minors';
  }

  if (
    hasAny([
      'kill myself',
      'suicide',
      'self harm',
      'hurt myself',
      'end my life',
      'want to die',
    ])
  ) {
    return 'self-harm';
  }

  if (
    hasAny([
      'how to kill',
      'make a bomb',
      'build a bomb',
      'attack someone',
      'shoot someone',
      'stabbing',
      'poison someone',
    ])
  ) {
    return 'violence';
  }

  if (
    hasAny([
      'hack account',
      'steal password',
      'phishing',
      'ddos',
      'sql injection',
      'bypass auth',
      'crack wifi',
      'exploit',
      'malware',
      'ransomware',
      'keylogger',
    ])
  ) {
    return 'security-abuse';
  }

  if (
    hasAny([
      'how to scam',
      'forge document',
      'fake id',
      'counterfeit',
      'money laundering',
      'sell drugs',
      'buy drugs',
      'evade police',
      'tax fraud',
    ])
  ) {
    return 'illegal';
  }

  if (
    hasAny([
      'harass',
      'bully',
      'doxx',
      'revenge porn',
      'blackmail',
      'threaten',
      'stalk',
    ])
  ) {
    return 'harassment';
  }

  return null;
}

function abuseRefusalReply(category: AbuseCategory): string {
  switch (category) {
    case 'self-harm':
      return 'I can’t help with self-harm instructions. If you might act on these thoughts, please contact local emergency services right now. You can also reach immediate support through your local crisis hotline.';
    case 'sexual-minors':
      return 'I can’t help with any sexual content involving minors.';
    case 'violence':
      return 'I can’t help with violence or instructions to harm people.';
    case 'security-abuse':
      return 'I can’t help with hacking, exploitation, credential theft, or other abuse. If you are securing Levela, ask about defensive best practices instead.';
    case 'harassment':
      return 'I can’t help with harassment, stalking, doxxing, or coercion.';
    case 'illegal':
      return 'I can’t help with illegal activity.';
    default:
      return 'I can’t help with that request.';
  }
}

function isRelevantToLevelaPurpose(content: string): boolean {
  const c = content.trim().toLowerCase();
  if (!c) return false;
  if (isGreetingOnly(c)) return true;

  const relevantTerms = [
    'levela',
    'nela',
    'app',
    'account',
    'profile',
    'settings',
    'study',
    'law',
    'governance',
    'proposal',
    'constitution',
    'article',
    'amendment',
    'ratify',
    'ratification',
    'policy update',
    'vote',
    'civic',
    'verification',
    'identity',
    'messaging',
    'message',
    'chat',
    'call',
    'privacy',
    'encryption',
    'market',
    'marketplace',
    'listing',
    'luma',
    'wallet',
    'report',
    'moderation',
    'safety',
    'support',
    'help',
    'bug',
    'feature',
    'how to',
    'how do i',
    'where is',
    'cannot',
    "can't",
    'error',
  ];

  return relevantTerms.some((t) => c.includes(t));
}

function isConstitutionAnalysisRequest(content: string): boolean {
  const c = content.trim().toLowerCase();
  if (!c) return false;
  const hasAny = (terms: string[]) => terms.some((t) => c.includes(t));
  const hasStructureHints =
    c.includes('article ') ||
    c.includes('section ') ||
    c.includes('amendment') ||
    c.includes('constitution') ||
    c.includes('proposal');
  const hasAnalysisIntent = hasAny([
    'analyze',
    'analysis',
    'review',
    'impact',
    'risk',
    'rollout',
    'what changed',
    'what do you think',
    'diff',
    'updated',
    'update',
  ]);
  return hasStructureHints && hasAnalysisIntent;
}

function buildPolicyReply(content: string): { reply: string; metric: ModerationMetricCategory } | null {
  const c = content.trim().toLowerCase();
  if (!c) return null;

  const hasAny = (terms: string[]) => terms.some((t) => c.includes(t));

  if (
    hasAny(['what is levela', 'levela in one sentence', 'levela mission']) ||
    /^what\s+is\s+levela\b/.test(c) ||
    /^what['’]?s\s+levela\b/.test(c)
  ) {
    return { reply: LEVELA_PRODUCT_SUMMARY, metric: 'policy_levela_summary' };
  }

  if (hasAny(['safety', 'safe', 'moderation', 'report', 'abuse', 'harm'])) {
    return {
      reply:
        'Levela safety centers on accountable participation: members can report abuse, moderation can intervene, and platform decisions are expected to be transparent and reviewable through documented governance processes.',
      metric: 'policy_safety',
    };
  }

  if (hasAny(['governance', 'vote', 'proposal', 'civic', 'policy'])) {
    return {
      reply:
        'Levela governance is designed around verifiable civic participation, where members can review proposals, vote through defined rules, and track decisions with transparent records rather than opaque admin-only control.',
      metric: 'policy_governance',
    };
  }

  if (
    hasAny([
      'constitution update',
      'updated levela constitution',
      'new constitution',
      'constitutional update',
      'amendment update',
      'article update',
      'what do you think about the update',
      'what do you think about the new updates',
    ])
  ) {
    return {
      reply:
        'I can help analyze the update in a practical way. Share the specific changed article(s) or text, and I will map each change to likely impact on civic learning, accountability roles, voting/governance workflow, and implementation risks so you can decide next actions.',
      metric: 'policy_governance',
    };
  }

  if (hasAny(['market', 'marketplace', 'buy', 'sell', 'listing', 'luma'])) {
    return {
      reply:
        'Levela marketplace lets members list and exchange goods or services with clear records; Luma is used as the in-app monetary layer for those exchanges under platform policy controls.',
      metric: 'policy_marketplace',
    };
  }

  if (hasAny(['privacy', 'private message', 'dm', 'encryption', 'e2ee', 'secure chat', 'messaging security'])) {
    return {
      reply:
        'Levela messaging privacy uses device-based keys for person-to-person encrypted chat when both participants have keys enabled; core delivery metadata and operational controls still exist so messaging can function and be governed responsibly.',
      metric: 'policy_privacy',
    };
  }

  return null;
}

function abuseMetricCategory(category: AbuseCategory): ModerationMetricCategory {
  switch (category) {
    case 'illegal':
      return 'abuse_illegal';
    case 'violence':
      return 'abuse_violence';
    case 'self-harm':
      return 'abuse_self_harm';
    case 'security-abuse':
      return 'abuse_security_abuse';
    case 'harassment':
      return 'abuse_harassment';
    case 'sexual-minors':
      return 'abuse_sexual_minors';
    default:
      return 'off_topic';
  }
}

function normalizeNelaStyle(text: string): string {
  const stripped = text
    .replace(/\bAs an AI assistant,?\s*/i, '')
    .replace(/\bAs an AI language model,?\s*/i, '')
    .replace(/\bI don'?t have personal opinions[^.?!]*[.?!]\s*/i, '')
    .replace(/\*\*/g, '')
    .trim();
  return stripped || text.trim();
}

function buildConstitutionAnalysisPrompt(userLine: string): string {
  return (
    'Analyze the following Levela constitutional/governance update in a concise, practical format.\n' +
    'Return only these sections with short bullets:\n' +
    '1) Intent\n' +
    '2) Governance Impact\n' +
    '3) Risks / Ambiguities\n' +
    '4) Rollout Checklist\n' +
    'If specific text is missing, state assumptions briefly and still provide useful next steps.\n\n' +
    `User request/update:\n${userLine}`
  );
}

async function recordModerationMetric(
  admin: ReturnType<typeof createClient>,
  category: ModerationMetricCategory,
) {
  try {
    const { error } = await admin.rpc('increment_nela_moderation_event_count', {
      target_category: category,
    });
    if (error) {
      console.warn('[messaging-agent-reply] moderation metric rpc failed', error.message);
    }
  } catch (error) {
    console.warn('[messaging-agent-reply] moderation metric failed', error);
  }
}

async function completeOpenAi(key: string, history: HistoryTurn[]): Promise<string | null> {
  let turns = compactHistoryForLlm(history);
  if (!turns.length) {
    const lastUser = [...history].reverse().find((h) => h.role === 'user');
    if (lastUser?.content.trim()) turns = [{ role: 'user', content: lastUser.content.trim() }];
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: 'system', content: NELA_SYSTEM_PROMPT },
        ...turns.map((h) => ({ role: h.role, content: h.content })),
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 800);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed?.error?.message) detail = parsed.error.message;
    } catch {
      /* keep slice */
    }
    console.error(`[messaging-agent-reply] OpenAI HTTP ${res.status}: ${detail}`);
    return null;
  }
  const json = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    console.warn('[messaging-agent-reply] OpenAI returned no assistant text in choices');
  }
  return text || null;
}

function extractGeminiText(raw: string): { text: string | null; finishReason: string } {
  let json: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };
  try {
    json = JSON.parse(raw);
  } catch {
    return { text: null, finishReason: 'json_parse_error' };
  }
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? null;
  const finishReason = candidate?.finishReason ?? 'unknown';
  return { text: text || null, finishReason };
}

async function completeGemini(
  key: string,
  model: string,
  history: HistoryTurn[],
  latestUserLine: string,
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const buildBody = (turns: HistoryTurn[]) => ({
    systemInstruction: { parts: [{ text: NELA_SYSTEM_PROMPT }] },
    contents: turns.map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    })),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 600,
    },
  });

  const turns = compactHistoryForLlm(history);
  const primaryTurns =
    turns.length > 0 ? turns : [{ role: 'user' as const, content: latestUserLine.trim() || 'Hello' }];

  const doFetch = async (bodyTurns: HistoryTurn[]) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify(buildBody(bodyTurns)),
    });
    const raw = await res.text();
    return { res, raw };
  };

  const { res, raw } = await doFetch(primaryTurns);
  if (!res.ok) {
    let detail = raw.slice(0, 800);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string } };
      if (parsed?.error?.message) detail = parsed.error.message;
    } catch {
      /* keep slice */
    }
    console.error(`[messaging-agent-reply] Gemini HTTP ${res.status}: ${detail}`);
    return null;
  }

  let { text, finishReason } = extractGeminiText(raw);
  const minimalTurn: HistoryTurn = {
    role: 'user',
    content: latestUserLine.trim() || 'Hello',
  };
  const alreadyMinimal =
    primaryTurns.length === 1 &&
    primaryTurns[0].role === 'user' &&
    primaryTurns[0].content === minimalTurn.content;
  if (!text && !alreadyMinimal) {
    console.warn(
      `[messaging-agent-reply] Gemini empty output (finishReason=${finishReason}); retrying with latest user only`,
    );
    const retry = await doFetch([minimalTurn]);
    if (!retry.res.ok) {
      console.error(`[messaging-agent-reply] Gemini retry HTTP ${retry.res.status}`);
      return null;
    }
    ({ text, finishReason } = extractGeminiText(retry.raw));
  }

  if (!text) {
    console.warn(`[messaging-agent-reply] Gemini returned no text (finishReason=${finishReason})`);
  }
  return text;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = request.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const conversationId = body.conversation_id?.trim();
  if (!conversationId) {
    return new Response(JSON.stringify({ error: 'conversation_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: conv, error: convError } = await admin
    .from('private_conversations')
    .select('id, kind')
    .eq('id', conversationId)
    .single();

  if (convError || !conv || conv.kind !== 'agent') {
    return new Response(JSON.stringify({ error: 'Not an agent conversation' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: members, error: membersError } = await admin
    .from('private_conversation_members')
    .select('profile_id')
    .eq('conversation_id', conversationId);

  if (membersError || !members?.length) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: callerProfile, error: profileError } = await userClient
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (profileError || !callerProfile) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const memberIds = new Set(members.map((m) => m.profile_id as string));
  if (!memberIds.has(callerProfile.id) || !memberIds.has(AGENT_PROFILE_ID)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: rows, error: msgError } = await admin
    .from('private_messages')
    .select('id, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(40);

  if (msgError) {
    return new Response(JSON.stringify({ error: 'Failed to load messages' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const last = rows?.length ? rows[rows.length - 1] : null;
  if (!last || last.sender_id !== callerProfile.id) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const history: HistoryTurn[] =
    rows?.map((r) => ({
      role: r.sender_id === AGENT_PROFILE_ID ? ('assistant' as const) : ('user' as const),
      content: String(r.content ?? ''),
    })) ?? [];

  const replyNoKey =
    'Thanks for your message. Automated replies are not available here yet because this server has no AI provider key configured.';

  const replyProviderDown =
    'Thanks for your message. Nela could not generate a reply just now. Please try again in a moment.';

  const llm = resolveLlm();
  let replyText = llm.kind === 'none' ? replyNoKey : replyProviderDown;
  let moderationMetric: ModerationMetricCategory | null = null;

  const latestUserLine = String(last.content ?? '');
  const abuseCategory = classifyAbuse(latestUserLine);
  if (abuseCategory) {
    replyText = abuseRefusalReply(abuseCategory);
    moderationMetric = abuseMetricCategory(abuseCategory);
  } else if (!isRelevantToLevelaPurpose(latestUserLine)) {
    replyText =
      'I can only help with Levela-related topics such as governance, messaging, safety, marketplace, profile/account settings, and how to use features in this app. Please ask a Levela-specific question.';
    moderationMetric = 'off_topic';
  } else if (isGreetingOnly(latestUserLine)) {
    replyText =
      'Hi! I can help with Levela features, governance, messaging, safety, marketplace, and account settings. What would you like to do?';
    moderationMetric = 'greeting';
  } else {
    const policyReply = buildPolicyReply(latestUserLine);
    if (policyReply) {
      replyText = policyReply.reply;
      moderationMetric = policyReply.metric;
    } else if (isWhatIsLevelaQuestion(latestUserLine)) {
      replyText = LEVELA_PRODUCT_SUMMARY;
      moderationMetric = 'policy_levela_summary';
    } else if (llm.kind !== 'none') {
      try {
        let text: string | null = null;
        const effectiveHistory =
          isConstitutionAnalysisRequest(latestUserLine)
            ? [...history, { role: 'user' as const, content: buildConstitutionAnalysisPrompt(latestUserLine) }]
            : history;
        if (llm.kind === 'gemini') {
          text = await completeGemini(llm.key, llm.model, effectiveHistory, latestUserLine);
        } else {
          text = await completeOpenAi(llm.key, effectiveHistory);
        }
        if (text) replyText = normalizeNelaStyle(text);
      } catch (err) {
        console.error('[messaging-agent-reply] LLM request failed:', err);
      }
    }
  }

  if (moderationMetric) {
    await recordModerationMetric(admin, moderationMetric);
  }

  const { error: insertError } = await admin.from('private_messages').insert({
    conversation_id: conversationId,
    sender_id: AGENT_PROFILE_ID,
    content: replyText,
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: 'Failed to save reply' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
