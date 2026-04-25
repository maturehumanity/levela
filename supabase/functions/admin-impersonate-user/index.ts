import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ImpersonatePayload = {
  requestId?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const allowAdminImpersonation = (Deno.env.get('ALLOW_ADMIN_IMPERSONATION') ?? '').trim().toLowerCase() === 'true';
    const authHeader = request.headers.get('Authorization') ?? '';

    if (!allowAdminImpersonation) {
      return new Response(JSON.stringify({
        error: 'Admin impersonation is disabled. Set ALLOW_ADMIN_IMPERSONATION=true only for audited emergency workflows.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    const requestId = payload.requestId?.trim();

    if (!requestId) {
      return new Response(JSON.stringify({ error: 'Missing emergency access requestId.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: claimedTargetProfileId, error: claimError } = await userClient.rpc(
      'claim_governance_emergency_access_request_for_impersonation',
      { target_request_id: requestId },
    );

    if (claimError || typeof claimedTargetProfileId !== 'string' || !claimedTargetProfileId.trim()) {
      return new Response(JSON.stringify({ error: claimError?.message || 'Emergency request must be approved, valid, and unconsumed.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('user_id')
      .eq('id', claimedTargetProfileId)
      .single();

    if (targetProfileError || !targetProfile?.user_id) {
      return new Response(JSON.stringify({ error: 'Target profile not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUserId = targetProfile.user_id;

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
