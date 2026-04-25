import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import type { AgreementTemplateKey } from '@/lib/agreements';
import { AGREEMENT_TEMPLATE_KEYS, agreementTemplateFromListingKind } from '@/lib/agreements';
import type { PublishedMarketListing } from '@/lib/use-market-published-listings';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

type StartAgreementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: PublishedMarketListing;
  t: Translate;
};

export function StartAgreementDialog({ open, onOpenChange, listing, t }: StartAgreementDialogProps) {
  const navigate = useNavigate();
  const [templateKey, setTemplateKey] = useState<AgreementTemplateKey>(() =>
    agreementTemplateFromListingKind(listing.listing_kind),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTemplateKey(agreementTemplateFromListingKind(listing.listing_kind));
    }
  }, [open, listing.id, listing.listing_kind]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('create_agreement_from_listing', {
      p_market_listing_id: listing.id,
      p_template_key: templateKey,
    });
    setBusy(false);

    if (error) {
      toast.error(error.message || t('agreements.createError'));
      return;
    }

    if (!data || typeof data !== 'string') {
      toast.error(t('agreements.createError'));
      return;
    }

    handleOpenChange(false);
    toast.success(t('agreements.createdToast'));
    navigate(`/agreements/${data}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('agreements.startDialogTitle')}</DialogTitle>
          <DialogDescription>{t('agreements.startDialogDescription', { title: listing.title })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>{t('agreements.templateLabel')}</Label>
          <RadioGroup
            value={templateKey}
            onValueChange={(v) => {
              if (AGREEMENT_TEMPLATE_KEYS.includes(v as AgreementTemplateKey)) {
                setTemplateKey(v as AgreementTemplateKey);
              }
            }}
            className="flex flex-col gap-2"
          >
            {AGREEMENT_TEMPLATE_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <RadioGroupItem value={key} id={`agreement-template-${key}`} />
                <Label htmlFor={`agreement-template-${key}`} className="cursor-pointer font-normal">
                  {t(`agreements.template.${key}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void start()} disabled={busy}>
            {busy ? t('agreements.startWorking') : t('agreements.startConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
