import { supabase } from '@/integrations/supabase/client';

export type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

export type RpcResponseLike<T> = {
  data: T | null;
  error: RpcErrorLike;
};

export function callUntypedRpc<T>(fnName: string, params?: Record<string, unknown>) {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResponseLike<T>>;

  return rpc(fnName, params);
}

export function asIntegerOrNull(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asNumericOrNull(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
