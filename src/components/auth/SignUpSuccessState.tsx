import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

type SignUpSuccessStateProps = {
  backToLoginLabel: string;
  message: string;
  onBackToLogin: () => void;
  title: string;
};

export function SignUpSuccessState({
  backToLoginLabel,
  message,
  onBackToLogin,
  title,
}: SignUpSuccessStateProps) {
  return (
    <motion.div
      className="mx-auto w-full max-w-sm text-center"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle className="h-10 w-10 text-primary" />
      </div>
      <h1 className="mb-2 font-display text-2xl font-bold text-foreground">{title}</h1>
      <p className="mb-6 text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onBackToLogin}>
        {backToLoginLabel}
      </Button>
    </motion.div>
  );
}
