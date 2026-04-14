import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SwitchPayload = {
  targetProfileId?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = request.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
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

    const payload = (await request.json()) as SwitchPayload;
    const targetProfileId = payload.targetProfileId?.trim();

    if (!targetProfileId) {
      return new Response(JSON.stringify({ error: 'Missing targetProfileId.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: currentProfile, error: currentProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (currentProfileError || !currentProfile?.id) {
      return new Response(JSON.stringify({ error: 'Current profile not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: relation, error: relationError } = await adminClient
      .from('linked_accounts')
      .select('id')
      .or(
        `and(owner_profile_id.eq.${currentProfile.id},linked_profile_id.eq.${targetProfileId}),and(linked_profile_id.eq.${currentProfile.id},owner_profile_id.eq.${targetProfileId})`,
      )
      .limit(1)
      .maybeSingle();

    if (relationError || !relation?.id) {
      return new Response(JSON.stringify({ error: 'Target account is not linked.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('user_id')
      .eq('id', targetProfileId)
      .is('deleted_at', null)
      .single();

    if (targetProfileError || !targetProfile?.user_id) {
      return new Response(JSON.stringify({ error: 'Target profile not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(targetProfile.user_id);

    if (targetUserError || !targetUser?.user) {
      return new Response(JSON.stringify({ error: 'Target user not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = targetUser.user.email ?? null;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Target user has no email.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    const token = linkData?.properties?.email_otp ?? null;

    if (linkError || !token) {
      return new Response(JSON.stringify({ error: linkError?.message || 'Could not generate switch token.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        email,
        token,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
