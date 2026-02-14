import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, Lightbulb } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';

export function AITipGenerator() {
  const { currentProfile, getTodayIntake, getExpectedIntake, isOnTrack, waterLogs } = useProfile();
  const [tip, setTip] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastContext, setLastContext] = useState<string>('');

  const generateTip = useCallback(async () => {
    if (!currentProfile || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const intake = getTodayIntake();
      const goal = currentProfile.daily_goal;
      const expected = getExpectedIntake();
      const onTrack = isOnTrack();

      // Calculate time left
      const now = new Date();
      const [sleepHour, sleepMin] = currentProfile.sleep_time.split(':').map(Number);
      const sleepTime = new Date(now);
      sleepTime.setHours(sleepHour, sleepMin, 0, 0);
      if (sleepTime <= now) {
        sleepTime.setDate(sleepTime.getDate() + 1);
      }
      const timeLeft = Math.max(0, (sleepTime.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Calculate recent trend
      const todayLogs = waterLogs.filter(log => {
        const logDate = new Date(log.logged_at);
        const today = new Date();
        return logDate.toDateString() === today.toDateString();
      });
      const recentTrend = todayLogs.length > 3 ? 'frequent' : todayLogs.length > 0 ? 'moderate' : 'inactive';

      const { data, error } = await supabase.functions.invoke('generate-tip', {
        body: {
          intake,
          goal,
          expected,
          onTrack,
          timeLeft: timeLeft.toFixed(1),
          recentTrend,
          activityLevel: currentProfile.activity_level,
        },
      });

      if (error) throw error;
      
      setTip(data.tip);
      setLastContext(`${intake}-${onTrack}-${recentTrend}`);
    } catch (error) {
      console.error('Error generating tip:', error);
      // Fallback tip
      const fallbackTips = [
        "Stay consistent! Regular small sips are better than large amounts at once.",
        "Try setting a water bottle next to your workspace for easy access.",
        "Water helps maintain energy levels throughout the day!",
      ];
      setTip(fallbackTips[Math.floor(Math.random() * fallbackTips.length)]);
    } finally {
      setIsLoading(false);
    }
  }, [currentProfile, getTodayIntake, getExpectedIntake, isOnTrack, waterLogs, isLoading]);

  // Auto-generate tip on mount and when context changes significantly
  useEffect(() => {
    if (!currentProfile || tip) return;
    
    const intake = getTodayIntake();
    const onTrack = isOnTrack();
    const currentContext = `${intake}-${onTrack}`;
    
    if (currentContext !== lastContext) {
      generateTip();
    }
  }, [currentProfile, tip, getTodayIntake, isOnTrack, lastContext, generateTip]);

  // Auto-update when user logs water or falls behind
  useEffect(() => {
    if (!currentProfile) return;
    
    const intake = getTodayIntake();
    const onTrack = isOnTrack();
    const goal = currentProfile.daily_goal;
    
    // Trigger new tip on significant events
    if (intake >= goal && tip && !tip.includes('goal')) {
      generateTip();
    }
  }, [waterLogs.length, currentProfile, getTodayIntake, isOnTrack, tip, generateTip]);

  if (!currentProfile) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground">AI Hydration Tip</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={generateTip}
          disabled={isLoading}
          className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
          title="Get new tip"
        >
          <Lightbulb className={`w-4 h-4 ${isLoading ? 'text-muted-foreground' : 'text-primary'}`} />
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="h-4 shimmer rounded w-full" />
            <div className="h-4 shimmer rounded w-3/4" />
          </motion.div>
        ) : tip ? (
          <motion.div
            key="tip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              {tip}
            </p>
            <button
              onClick={generateTip}
              className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>New tip</span>
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="generate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={generateTip}
            className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Tap to generate a personalized tip
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}