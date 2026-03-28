import { supabase } from '@/integrations/supabase/client';

const AVATAR_BUCKET = 'avatars';

function getAvatarExtension(file: File): string {
  const rawExtension = file.name.split('.').pop()?.trim().toLowerCase();
  if (rawExtension && rawExtension.length <= 5) {
    return rawExtension;
  }

  const mimeToExtension: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
  };

  return mimeToExtension[file.type] || 'jpg';
}

export async function uploadProfileAvatar(file: File, userId: string) {
  const extension = getAvatarExtension(file);
  const filePath = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, file, {
    contentType: file.type || undefined,
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

  return {
    filePath,
    publicUrl: data.publicUrl,
  };
}
