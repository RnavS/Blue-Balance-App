import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';

export function HydrationStatus() {
  const { currentProfile, getTodayIntake, getExpectedIntake, isOnTrack } = useProfile();
  
  if (!currentProfile) return null;

  const intake = getTodayIntake();
  const expected = getExpectedIntake();
  const onTrack = isOnTrack();
  const goal = currentProfile.daily_goal;
  const unit = currentProfile.unit_preference;

  // Calculate expected range (±10%)
  const minExpected = Math.round(expected * 0.9);
  const maxExpected = Math.round(expected * 1.1);

  // Calculate time left
  const now = new Date();
  const [sleepHour, sleepMin] = currentProfile.sleep_time.split(':').map(Number);
  const sleepTime = new Date(now);
  sleepTime.setHours(sleepHour, sleepMin, 0, 0);
  if (sleepTime <= now) {
    sleepTime.setDate(sleepTime.getDate() + 1);
  }
  const hoursLeft = Math.max(0, (sleepTime.getTime() - now.getTime()) / (1000 * 60 * 60));
  const remaining = Math.max(0, goal - intake);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-card p-4 ${onTrack ? 'border-success/30' : 'border-warning/30 warning-glow'}`}
    >
      <div className="flex items-start gap-3">
        {onTrack ? (
          <div className="p-2 rounded-full bg-success/20">
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
        ) : (
          <div className="p-2 rounded-full bg-warning/20">
            <AlertCircle className="w-5 h-5 text-warning" />
          </div>
        )}
        
        <div className="flex-1">
          <h3 className={`font-medium ${onTrack ? 'text-success' : 'text-warning'}`}>
            {onTrack ? 'On Track!' : 'Behind Schedule'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            You should be between <span className="font-medium text-foreground">{minExpected}</span> and{' '}
            <span className="font-medium text-foreground">{maxExpected} {unit}</span> by now
          </p>
          {remaining > 0 && hoursLeft > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {remaining} {unit} remaining • {hoursLeft.toFixed(1)} hours left
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}