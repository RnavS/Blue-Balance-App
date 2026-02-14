import { motion } from 'framer-motion';
import { useProfile } from '@/contexts/ProfileContext';
import { useTargetProgress } from '@/hooks/useTargetProgress';

export function ProgressRing() {
  const { currentProfile, getTodayIntake, isOnTrack } = useProfile();
  const { expectedIntake } = useTargetProgress();
  
  if (!currentProfile) return null;
  
  const intake = getTodayIntake();
  const goal = currentProfile.daily_goal;
  const percentage = Math.min((intake / goal) * 100, 100);
  const onTrack = isOnTrack();

  // Calculate expected percentage for target marker
  const expectedPercentage = Math.min((expectedIntake / goal) * 100, 100);

  const size = 240;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Calculate expected marker position
  const expectedAngle = (expectedPercentage / 100) * 360 - 90; // -90 to start from top
  const expectedMarkerX = size / 2 + radius * Math.cos((expectedAngle * Math.PI) / 180);
  const expectedMarkerY = size / 2 + radius * Math.sin((expectedAngle * Math.PI) / 180);

  const unit = currentProfile.unit_preference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-30"
        />
        {/* Progress circle - uses theme colors */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={onTrack || percentage >= 100 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={onTrack || percentage >= 100 ? 'drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]' : 'drop-shadow-[0_0_15px_hsl(var(--destructive)/0.5)]'}
        />
        {/* Expected target marker */}
        {expectedPercentage > 0 && expectedPercentage < 100 && (
          <circle
            cx={expectedMarkerX}
            cy={expectedMarkerY}
            r={4}
            fill="hsl(var(--muted-foreground))"
            className="opacity-60"
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-5xl font-bold ${onTrack || percentage >= 100 ? 'text-foreground' : 'text-destructive'}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          key={intake}
        >
          {intake.toFixed(1)}
        </motion.span>
        <span className="text-lg text-muted-foreground">
          / {goal} {unit}
        </span>
        <span className={`text-sm mt-1 ${onTrack || percentage >= 100 ? 'text-primary' : 'text-destructive'}`}>
          {Math.round(percentage)}% complete
        </span>
      </div>

      {/* Glow effect when complete */}
      {percentage >= 100 && (
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
          }}
        />
      )}
    </div>
  );
}