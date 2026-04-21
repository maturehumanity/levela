import { Loader2 } from 'lucide-react';
import type { AppRole } from '@/lib/access-control';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CreateUserForm = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: AppRole;
};

type UsersAdminCreateUserDialogProps = {
  creatingUser: boolean;
  form: CreateUserForm;
  manageableRoles: AppRole[];
  open: boolean;
  t: (key: string) => string;
  onCreate: () => void;
  onOpenChange: (open: boolean) => void;
  onUpdateForm: (updater: (current: CreateUserForm) => CreateUserForm) => void;
};

export function UsersAdminCreateUserDialog({
  creatingUser,
  form,
  manageableRoles,
  open,
  t,
  onCreate,
  onOpenChange,
  onUpdateForm,
}: UsersAdminCreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t('admin.users.createUserTitle')}</DialogTitle>
          <DialogDescription>{t('admin.users.createUserSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">{t('common.fullName')}</label>
            <Input value={form.fullName} onChange={(event) => onUpdateForm((current) => ({ ...current, fullName: event.target.value }))} placeholder={t('auth.fullNamePlaceholder')} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">{t('common.username')}</label>
            <Input value={form.username} onChange={(event) => onUpdateForm((current) => ({ ...current, username: event.target.value }))} placeholder={t('auth.usernamePlaceholder')} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">{t('common.email')}</label>
            <Input type="email" value={form.email} onChange={(event) => onUpdateForm((current) => ({ ...current, email: event.target.value }))} placeholder={t('auth.emailPlaceholder')} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">{t('admin.users.temporaryPassword')}</label>
            <Input type="password" value={form.password} onChange={(event) => onUpdateForm((current) => ({ ...current, password: event.target.value }))} placeholder={t('auth.passwordPlaceholder')} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">{t('common.role')}</label>
            <Select value={form.role} onValueChange={(value) => onUpdateForm((current) => ({ ...current, role: value as AppRole }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {manageableRoles.map((role) => (
                  <SelectItem key={role} value={role}>{t(`admin.roles.${role}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={onCreate} disabled={creatingUser || !form.email.trim() || !form.password.trim()}>
            {creatingUser ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('admin.users.creatingUser')}</> : t('admin.users.createUser')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
