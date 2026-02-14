import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useProfile, WaterLog } from '@/contexts/ProfileContext';

interface BeverageSplitProps {
  logs?: WaterLog[];
  compact?: boolean;
}

const beverageColors: Record<string, string> = {
  'Water': 'bg-cyan-500',
  'Sparkling Water': 'bg-sky-400',
  'Tea': 'bg-emerald-500',
  'Coffee': 'bg-amber-700',
  'Orange Juice': 'bg-orange-500',
  'Sports Drink': 'bg-lime-500',
  'Soda': 'bg-rose-500',
  'Juice': 'bg-yellow-500',
  'Other': 'bg-purple-500',
};

export function BeverageSplit({ logs, compact = false }: BeverageSplitProps) {
  const { currentProfile, getFilteredLogs } = useProfile();
  
  const logsToUse = logs || getFilteredLogs('day');
  
  const splits = useMemo(() => {
    const grouped: Record<string, number> = {};
    let total = 0;
    
    logsToUse.forEach(log => {
      const type = log.drink_type || 'Water';
      grouped[type] = (grouped[type] || 0) + log.amount;
      total += log.amount;
    });
    
    return Object.entries(grouped)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        color: beverageColors[name] || beverageColors['Other'],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [logsToUse]);

  const unitPreference = currentProfile?.unit_preference || 'oz';

  if (splits.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No beverages logged yet
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Progress bar */}
        <div className="h-3 rounded-full overflow-hidden flex bg-muted/30">
          {splits.map((split, i) => (
            <motion.div
              key={split.name}
              initial={{ width: 0 }}
              animate={{ width: `${split.percentage}%` }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`${split.color} h-full`}
            />
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {splits.map(split => (
            <div key={split.name} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${split.color}`} />
              <span className="text-muted-foreground">{split.name}</span>
              <span className="text-foreground font-medium">{split.amount.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">Beverage Breakdown</h4>
      
      {/* Progress bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-muted/30">
        {splits.map((split, i) => (
          <motion.div
            key={split.name}
            initial={{ width: 0 }}
            animate={{ width: `${split.percentage}%` }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className={`${split.color} h-full`}
          />
        ))}
      </div>
      
      {/* Detailed list */}
      <div className="grid grid-cols-2 gap-2">
        {splits.map(split => (
          <div key={split.name} className="flex items-center gap-2 p-2 bg-card/40 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${split.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{split.name}</p>
              <p className="text-xs text-muted-foreground">
                {split.amount.toFixed(1)} {unitPreference} ({split.percentage.toFixed(0)}%)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}