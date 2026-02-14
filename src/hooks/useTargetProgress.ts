import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/contexts/ProfileContext';

export function useTargetProgress() {
  const { currentProfile, getTodayIntake, getExpectedIntake, getExpectedRange, isOnTrack } = useProfile();
  const [tick, setTick] = useState(0);

  // Force re-calculation every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const currentIntake = getTodayIntake();
  const expectedIntake = getExpectedIntake();
  const expectedRange = getExpectedRange();
  const onTrack = isOnTrack();

  const getTimeProgress = useCallback(() => {
    if (!currentProfile) return 0;

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

    if (now < wakeTime) return 0;
    if (now > sleepTime) return 1;

    const totalAwakeMs = sleepTime.getTime() - wakeTime.getTime();
    const elapsedMs = now.getTime() - wakeTime.getTime();
    return elapsedMs / totalAwakeMs;
  }, [currentProfile]);

  const getTimeRemaining = useCallback(() => {
    if (!currentProfile) return { hours: 0, minutes: 0 };

    const now = new Date();
    const [sleepHour, sleepMin] = currentProfile.sleep_time.split(':').map(Number);

    let sleepTime = new Date(now);
    sleepTime.setHours(sleepHour, sleepMin, 0, 0);
    
    const [wakeHour, wakeMin] = currentProfile.wake_time.split(':').map(Number);
    const wakeTime = new Date(now);
    wakeTime.setHours(wakeHour, wakeMin, 0, 0);
    
    if (sleepTime <= wakeTime) {
      sleepTime.setDate(sleepTime.getDate() + 1);
    }

    const remainingMs = Math.max(0, sleepTime.getTime() - now.getTime());
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes };
  }, [currentProfile]);

  const getRemainingAmount = useCallback(() => {
    if (!currentProfile) return 0;
    return Math.max(0, currentProfile.daily_goal - currentIntake);
  }, [currentProfile, currentIntake]);

  return {
    currentIntake,
    expectedIntake,
    expectedRange,
    onTrack,
    timeProgress: getTimeProgress(),
    timeRemaining: getTimeRemaining(),
    remainingAmount: getRemainingAmount(),
    dailyGoal: currentProfile?.daily_goal || 0,
    tick, // Can be used to force re-renders
  };
}