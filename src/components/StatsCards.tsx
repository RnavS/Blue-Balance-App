import { motion } from 'framer-motion';
import { Flame, Target, Droplet } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';

export function StatsCards() {
  const { currentProfile, getTodayIntake, getStreak } = useProfile();
  const streak = getStreak();
  const todayIntake = getTodayIntake();
  const dailyGoal = currentProfile?.daily_goal || 64;
  const unitPreference = currentProfile?.unit_preference || 'oz';
  const remaining = Math.max(0, dailyGoal - todayIntake);

  const stats = [
    {
      label: 'Streak',
      value: streak,
      suffix: 'days',
      icon: Flame,
      color: 'text-orange-400',
    },
    {
      label: 'Daily Goal',
      value: dailyGoal,
      suffix: unitPreference,
      icon: Target,
      color: 'text-primary',
    },
    {
      label: 'Remaining',
      value: remaining,
      suffix: unitPreference,
      icon: Droplet,
      color: remaining > 0 ? 'text-blue-400' : 'text-success',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass-card p-4 text-center"
        >
          <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
          <div className="text-2xl font-bold text-foreground">{stat.value}</div>
          <div className="text-xs text-muted-foreground">
            {stat.suffix}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
}