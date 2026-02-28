import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Timer, TrendingUp } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { Progress } from '@/components/ui/progress';

export function IntervalTracker() {
  const { currentProfile, waterLogs, getCurrentIntervalProgress } = useProfile();
  const [, setTick] = useState(0);

  // Recalculate interval progress function to get fresh data
  const getIntervalData = useCallback(() => {
    if (!currentProfile) {
      return { current: 0, target: 0, timeRemaining: 0, intervalIndex: 0, totalIntervals: 0 };
    }

    const now = new Date();
    const [wakeHour, wakeMin] = currentProfile.wake_time.split(':').map(Number);
    const [sleepHour, sleepMin] = currentProfile.sleep_time.split(':').map(Number);

    const wakeTime = new Date(now);
    wakeTime.setHours(wakeHour, wakeMin, 0, 0);

    let sleepTime = new Date(now);
    sleepTime.setHours(sleepHour, sleepMin, 0, 0);
    if (sleepTime <= wakeTime) {
      sleepTime.setDate(sleepTime.getDate() + 1);
    }

    const totalAwakeMs = sleepTime.getTime() - wakeTime.getTime();
    const intervalMs = currentProfile.interval_length * 60 * 1000;
    const totalIntervals = Math.ceil(totalAwakeMs / intervalMs);
    
    const elapsedMs = Math.max(0, now.getTime() - wakeTime.getTime());
    const intervalIndex = Math.min(Math.floor(elapsedMs / intervalMs), totalIntervals - 1);
    
    const intervalStart = new Date(wakeTime.getTime() + intervalIndex * intervalMs);
    const intervalEnd = new Date(Math.min(intervalStart.getTime() + intervalMs, sleepTime.getTime()));
    
    const targetPerInterval = currentProfile.daily_goal / totalIntervals;
    
    // Get logs for current interval
    const intervalLogs = waterLogs.filter(log => {
      const logTime = new Date(log.logged_at);
      return logTime >= intervalStart && logTime < intervalEnd;
    });
    
    const currentIntake = intervalLogs.reduce((sum, log) => sum + log.amount, 0);
    const timeRemaining = Math.max(0, intervalEnd.getTime() - now.getTime());

    return {
      current: currentIntake,
      target: targetPerInterval,
      timeRemaining,
      intervalIndex,
      totalIntervals,
    };
  }, [currentProfile, waterLogs]);

  const [intervalData, setIntervalData] = useState(getIntervalData());

  // Update every second for countdown, and immediately when waterLogs change
  useEffect(() => {
    const updateData = () => {
      setIntervalData(getIntervalData());
      setTick(t => t + 1);
    };
    
    updateData(); // Update immediately
    const interval = setInterval(updateData, 1000);
    return () => clearInterval(interval);
  }, [getIntervalData]);

  if (!currentProfile) return null;

  const { current, target, timeRemaining, intervalIndex, totalIntervals } = intervalData;
  const progressPercent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isIntervalComplete = current >= target;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const unitPreference = currentProfile.unit_preference;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Current Interval</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {intervalIndex + 1} of {totalIntervals}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <div>
            <span className="text-2xl font-bold text-foreground">{current.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground ml-1">/ {target.toFixed(1)} {unitPreference}</span>
          </div>
          <div className={`flex items-center gap-1 text-xs ${isIntervalComplete ? 'text-primary' : 'text-muted-foreground'}`}>
            <TrendingUp className="w-3 h-3" />
            {isIntervalComplete ? 'Complete!' : `${formatTime(timeRemaining)} left`}
          </div>
        </div>

        <Progress 
          value={progressPercent} 
          className="h-2"
        />

        {/* Interval dots */}
        <div className="flex gap-1 pt-1">
          {Array.from({ length: Math.min(totalIntervals, 12) }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < intervalIndex
                  ? 'bg-primary'
                  : i === intervalIndex
                  ? isIntervalComplete ? 'bg-primary' : 'bg-primary/50'
                  : 'bg-muted/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}