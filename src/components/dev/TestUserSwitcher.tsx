import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';

export type TestUserFixture = {
  key: string;
  scope: 'role' | 'profession';
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
  professions?: string[];
};

type Props = {
  onApply: (user: TestUserFixture) => void;
  onSignIn: (user: TestUserFixture) => Promise<void>;
  disabled?: boolean;
};

function parseTestUsers(): TestUserFixture[] {
  const raw = import.meta.env.VITE_TEST_USERS_JSON as string | undefined;
  if (!raw) return [];

  try {
    const data = JSON.parse(raw) as TestUserFixture[];
    if (!Array.isArray(data)) return [];
    return data.filter((item) => Boolean(item?.email && item?.password));
  } catch {
    return [];
  }
}

export default function TestUserSwitcher({ onApply, onSignIn, disabled }: Props) {
  const { t } = useLanguage();
  const options = useMemo(() => parseTestUsers(), []);
  const [selectedKey, setSelectedKey] = useState<string | null>(options[0]?.key ?? null);
  const selected = options.find((item) => item.key === selectedKey) ?? null;

  if (!import.meta.env.DEV || options.length === 0) return null;

  return (
    <Card className="mt-6 rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{t('auth.testUsersTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('auth.testUsersDescription')}</p>
      </div>

      <div className="mt-3 space-y-3">
        <Select value={selectedKey ?? undefined} onValueChange={(value) => setSelectedKey(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('auth.testUsersSelect')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((user) => (
              <SelectItem key={user.key} value={user.key}>
                {user.scope === 'role' ? 'Role' : 'Profession'} · {user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!selected || disabled}
            onClick={() => selected && onApply(selected)}
          >
            {t('auth.testUsersFill')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selected || disabled}
            onClick={() => selected && onSignIn(selected)}
          >
            {t('auth.testUsersSignIn')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
