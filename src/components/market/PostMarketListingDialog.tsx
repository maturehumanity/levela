import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import {
  normalizeMarketListingDescription,
  normalizeMarketListingTitle,
  parseInitialListingQuantity,
} from '@/lib/market-listings';
import { parseUserLumaInputToLumens } from '@/lib/monetary';

type PostMarketListingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerProfileId: string;
  onCreated: () => void;
  titleLabel: string;
  descriptionLabel: string;
  priceLabel: string;
  priceHint: string;
  submitLabel: string;
  cancelLabel: string;
  dialogTitle: string;
  dialogDescription: string;
  titleRequired: string;
  priceRequired: string;
  saveError: string;
  submittingLabel: string;
  quantityLabel: string;
  quantityHint: string;
  quantityInvalid: string;
  kindLabel: string;
  kindProduct: string;
  kindService: string;
  kindHint: string;
};

export function PostMarketListingDialog({
  open,
  onOpenChange,
  sellerProfileId,
  onCreated,
  titleLabel,
  descriptionLabel,
  priceLabel,
  priceHint,
  submitLabel,
  cancelLabel,
  dialogTitle,
  dialogDescription,
  titleRequired,
  priceRequired,
  saveError,
  submittingLabel,
  quantityLabel,
  quantityHint,
  quantityInvalid,
  kindLabel,
  kindProduct,
  kindService,
  kindHint,
}: PostMarketListingDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [listingKind, setListingKind] = useState<'product' | 'service'>('product');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriceInput('');
    setQuantityInput('1');
    setListingKind('product');
    setLocalError(null);
  };

  const handleSubmit = async () => {
    setLocalError(null);
    const normalizedTitle = normalizeMarketListingTitle(title);
    if (!normalizedTitle) {
      setLocalError(titleRequired);
      return;
    }
    const lumens = parseUserLumaInputToLumens(priceInput);
    if (lumens === null || lumens <= 0) {
      setLocalError(priceRequired);
      return;
    }
    const qty = parseInitialListingQuantity(quantityInput);
    if (qty === null) {
      setLocalError(quantityInvalid);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('market_listings').insert({
      seller_profile_id: sellerProfileId,
      title: normalizedTitle,
      description: normalizeMarketListingDescription(description),
      price_lumens: lumens,
      remaining_quantity: qty,
      status: 'published',
      listing_kind: listingKind,
    });
    setSubmitting(false);

    if (error) {
      setLocalError(error.message || saveError);
      return;
    }

    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label>{kindLabel}</Label>
            <RadioGroup
              value={listingKind}
              onValueChange={(v) => setListingKind(v === 'service' ? 'service' : 'product')}
              className="flex flex-col gap-2 sm:flex-row sm:gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="product" id="market-kind-product" />
                <Label htmlFor="market-kind-product" className="cursor-pointer font-normal">
                  {kindProduct}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="service" id="market-kind-service" />
                <Label htmlFor="market-kind-service" className="cursor-pointer font-normal">
                  {kindService}
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">{kindHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="market-listing-title">{titleLabel}</Label>
            <Input
              id="market-listing-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="market-listing-description">{descriptionLabel}</Label>
            <Textarea
              id="market-listing-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="market-listing-quantity">{quantityLabel}</Label>
            <Input
              id="market-listing-quantity"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{quantityHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="market-listing-price">{priceLabel}</Label>
            <Input
              id="market-listing-price"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="12.50"
            />
            <p className="text-xs text-muted-foreground">{priceHint}</p>
          </div>
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
