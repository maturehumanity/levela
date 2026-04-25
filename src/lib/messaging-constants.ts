/** Stable profile id for Nela, the in-app assistant (matches DB migration). */
export const NELA_ASSISTANT_PROFILE_ID = 'a0000000-0000-4000-8000-000000000001';

/** Public path (Vite `public/`) — works on web and Capacitor with default base. */
export const NELA_AVATAR_URL = `${import.meta.env.BASE_URL}avatars/nela.svg`;

export function resolveMessagingAvatarUrl(
  profileId: string | null | undefined,
  storedAvatarUrl: string | null | undefined,
): string | undefined {
  if (profileId === NELA_ASSISTANT_PROFILE_ID) return NELA_AVATAR_URL;
  return storedAvatarUrl?.trim() || undefined;
}
