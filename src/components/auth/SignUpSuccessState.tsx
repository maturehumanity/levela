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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div className="text-center" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground mb-6">{message}</p>
        <Button variant="outline" onClick={onBackToLogin}>
          {backToLoginLabel}
        </Button>
      </motion.div>
    </div>
  );
}
