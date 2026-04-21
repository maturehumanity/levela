import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ImpersonatePayload = {
  profileId?: string;
  userId?: string;
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

    const { data: effectivePermissions, error: permissionsError } = await userClient.rpc(
      'current_app_permissions',
    );
    const canManageUsers = Array.isArray(effectivePermissions)
      && (effectivePermissions as string[]).some(
        (permission) => permission === 'role.assign' || permission === 'settings.manage',
      );

    if (permissionsError || !canManageUsers) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await request.json()) as ImpersonatePayload;
    const targetProfileId = payload.profileId?.trim();
    const targetUserIdFromPayload = payload.userId?.trim();

    if (!targetProfileId && !targetUserIdFromPayload) {
      return new Response(JSON.stringify({ error: 'Missing profileId or userId.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    let targetUserId = targetUserIdFromPayload ?? '';

    if (!targetUserId && targetProfileId) {
      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from('profiles')
        .select('user_id')
        .eq('id', targetProfileId)
        .single();

      if (targetProfileError || !targetProfile?.user_id) {
        return new Response(JSON.stringify({ error: 'Target profile not found.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      targetUserId = targetProfile.user_id;
    }

    const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(targetUserId);

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
      return new Response(JSON.stringify({ error: linkError?.message || 'Could not generate login link.' }), {
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
