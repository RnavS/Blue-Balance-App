import { motion } from 'framer-motion';
import { useProfile } from '@/contexts/ProfileContext';

export function TargetTracker() {
  const { currentProfile, getTodayIntake, getExpectedIntake, isOnTrack } = useProfile();
  
  if (!currentProfile) return null;
  
  const intake = getTodayIntake();
  const goal = currentProfile.daily_goal;
  const expected = getExpectedIntake();
  const onTrack = isOnTrack();

  const progressPercent = Math.min((intake / goal) * 100, 100);
  const expectedPercent = Math.min((expected / goal) * 100, 100);

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Today's Progress</span>
        <span className={onTrack ? 'text-success' : 'text-warning'}>
          {onTrack ? 'On Track' : 'Behind Schedule'}
        </span>
      </div>

      <div className="relative h-4 bg-muted/30 rounded-full overflow-hidden">
        {/* Progress bar */}
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            onTrack ? 'bg-gradient-to-r from-success to-emerald-400' : 'bg-gradient-to-r from-warning to-orange-400'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Expected target marker - thicker and darker shade */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full shadow-lg"
          style={{
            backgroundColor: onTrack ? 'hsl(142 76% 30%)' : 'hsl(0 84% 40%)',
            boxShadow: `0 0 6px ${onTrack ? 'hsl(142 76% 35% / 0.6)' : 'hsl(0 84% 45% / 0.6)'}`,
          }}
          initial={{ left: 0, opacity: 0 }}
          animate={{ left: `${expectedPercent}%`, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />

        {/* Warning glow when behind */}
        {!onTrack && (
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              background: 'linear-gradient(90deg, transparent 0%, hsl(var(--warning) / 0.2) 100%)',
            }}
          />
        )}
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0 {currentProfile.unit_preference}</span>
        <span>Expected: {expected} {currentProfile.unit_preference}</span>
        <span>{goal} {currentProfile.unit_preference}</span>
      </div>
    </div>
  );
}