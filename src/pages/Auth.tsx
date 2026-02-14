import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, Mail, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthMode = 'choice' | 'signin' | 'signup' | 'reset';

export function Auth() {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<AuthMode>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    try {
      emailSchema.parse(email);
      if (mode !== 'reset') {
        passwordSchema.parse(password);
      }
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: err.errors[0].message,
          variant: 'destructive',
        });
      }
      return false;
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleEmailSignIn = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    const { error } = await signInWithEmail(email, password);
    if (error) {
      let message = error.message;
      if (error.message.includes('Invalid login credentials')) {
        message = 'Invalid email or password. Please try again.';
      }
      toast({
        title: 'Sign in failed',
        description: message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleEmailSignUp = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    const { error } = await signUpWithEmail(email, password);
    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = 'This email is already registered. Please sign in instead.';
      }
      toast({
        title: 'Sign up failed',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Account created!',
        description: 'You can now sign in with your credentials.',
      });
      setMode('signin');
    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    try {
      emailSchema.parse(email);
    } catch {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      toast({
        title: 'Reset failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Check your email',
        description: 'We sent you a password reset link.',
      });
      setMode('signin');
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Back button */}
        {mode !== 'choice' && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setMode('choice')}
            className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </motion.button>
        )}

        {/* Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex justify-center mb-6"
        >
          <div className="p-3 rounded-2xl bg-primary/20 backdrop-blur-sm border border-primary/30">
            <Droplets className="w-10 h-10 text-primary" />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === 'choice' && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h1 className="text-2xl font-bold text-foreground text-center mb-8">
                Welcome to Blue Balance
              </h1>

              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                variant="outline"
                className="w-full py-6 text-foreground border-white/20 hover:bg-white/5"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Sign in with Google
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-background text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                onClick={() => setMode('signup')}
                className="w-full py-6 bg-primary hover:bg-primary/90"
              >
                <Mail className="w-5 h-5 mr-2" />
                Sign up with Email
              </Button>

              <Button
                onClick={() => setMode('signin')}
                variant="ghost"
                className="w-full py-6 text-muted-foreground hover:text-foreground"
              >
                Already have an account? Sign in
              </Button>
            </motion.div>
          )}

          {(mode === 'signin' || mode === 'signup') && (
            <motion.div
              key="email"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h1 className="text-2xl font-bold text-foreground text-center mb-6">
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </h1>

              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 py-6 bg-card/60 border-white/10"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 py-6 bg-card/60 border-white/10"
                  />
                </div>

                <Button
                  onClick={mode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                  disabled={loading}
                  className="w-full py-6 bg-primary hover:bg-primary/90"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Button>

                {mode === 'signin' && (
                  <Button
                    onClick={() => setMode('reset')}
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground"
                  >
                    Forgot password?
                  </Button>
                )}

                <Button
                  onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                  variant="ghost"
                  className="w-full text-muted-foreground"
                >
                  {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </Button>
              </div>
            </motion.div>
          )}

          {mode === 'reset' && (
            <motion.div
              key="reset"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h1 className="text-2xl font-bold text-foreground text-center mb-2">
                Reset Password
              </h1>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Enter your email and we'll send you a reset link
              </p>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 py-6 bg-card/60 border-white/10"
                />
              </div>

              <Button
                onClick={handlePasswordReset}
                disabled={loading}
                className="w-full py-6 bg-primary hover:bg-primary/90"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                Send Reset Link
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}