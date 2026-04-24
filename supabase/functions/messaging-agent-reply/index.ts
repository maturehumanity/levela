import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Nela — in-app assistant (system profile). */
const AGENT_PROFILE_ID = 'a0000000-0000-4000-8000-000000000001';

const NELA_SYSTEM_PROMPT =
  'You are Nela, a concise in-app assistant for the Levela community platform. ' +
  'Levela is citizen-centered software focused on verifiable governance, identity integrity, auditability, stewarded participation, and decentralization over time—not a generic social network for hobbies or meetups. ' +
  'Never describe Levela using generic social-network clichés (for example “connect people with shared interests”). If you are unsure about product purpose or roadmap details, say you are not sure and point people to in-app Study materials or official project documentation rather than guessing. ' +
  'Explain features, navigation, and general how-to in plain language. ' +
  'If you are unsure or the question needs legal, medical, or financial advice, say you cannot help with that and suggest speaking to a qualified professional or official support. ' +
  'Do not invent product features you are not sure about.';

type Body = {
  conversation_id?: string;
};

type HistoryTurn = { role: 'user' | 'assistant'; content: string };

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

function compactHistoryForLlm(turns: HistoryTurn[]): HistoryTurn[] {
  const filtered = turns.filter((t) => {
    if (!t.content.trim()) return false;
    if (isFailedNelaPlaceholderAssistant(t)) return false;
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

  let { res, raw } = await doFetch(primaryTurns);
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

  if (llm.kind !== 'none') {
    try {
      let text: string | null = null;
      if (llm.kind === 'gemini') {
        text = await completeGemini(llm.key, llm.model, history, String(last.content ?? ''));
      } else {
        text = await completeOpenAi(llm.key, history);
      }
      if (text) replyText = text;
    } catch (err) {
      console.error('[messaging-agent-reply] LLM request failed:', err);
    }
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
