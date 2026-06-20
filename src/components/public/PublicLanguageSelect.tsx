import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { loadLanguageOptions, type LanguageCode, type LanguageOption } from '@/lib/i18n.runtime';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function PublicLanguageSelect() {
  const { language, setLanguage, t } = useLanguage();
  const [languageOptions, setLanguageOptions] = useState<readonly LanguageOption[]>([]);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      const options = await loadLanguageOptions();
      if (active) setLanguageOptions(options);
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, []);

  if (languageOptions.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Select
        value={language}
        onValueChange={(value) => {
          void setLanguage(value as LanguageCode);
        }}
      >
        <SelectTrigger
          aria-label={t('auth.language')}
          className="h-9 w-[9.5rem] border-border/60 bg-card/80 text-xs"
        >
          <SelectValue placeholder={t('auth.language')} />
        </SelectTrigger>
        <SelectContent>
          {languageOptions.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
