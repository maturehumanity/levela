export type BrowserSupabaseClient = typeof import('./client')['supabase'];

let browserClientPromise: Promise<BrowserSupabaseClient> | null = null;

export function loadSupabaseClient(): Promise<BrowserSupabaseClient> {
  if (!browserClientPromise) {
    browserClientPromise = import('./client').then((module) => module.supabase);
  }

  return browserClientPromise;
}
