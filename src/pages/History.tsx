import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, TrendingUp, Droplet, BarChart3, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProfile, WaterLog } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BeverageSplit } from '@/components/BeverageSplit';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

type FilterType = 'hour' | 'day' | 'week' | 'month';

const filters: { id: FilterType; label: string }[] = [
  { id: 'hour', label: 'Hour' },
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

function HydrationScoreGauge({ score }: { score: number }) {
  const getScoreLabel = (s: number) => {
    if (s >= 90) return { label: 'Excellent', color: 'text-success' };
    if (s >= 70) return { label: 'Good', color: 'text-emerald-400' };
    if (s >= 50) return { label: 'Moderate', color: 'text-yellow-400' };
    if (s >= 30) return { label: 'Imbalanced', color: 'text-orange-400' };
    return { label: 'Off Track', color: 'text-destructive' };
  };

  const { label, color } = getScoreLabel(score);
  const rotation = (score / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <div className="absolute inset-0 border-8 border-muted/30 rounded-t-full" />
        <div 
          className="absolute inset-0 border-8 rounded-t-full"
          style={{
            borderColor: score >= 70 ? 'hsl(var(--success))' : score >= 50 ? 'hsl(48 96% 53%)' : 'hsl(var(--destructive))',
            clipPath: `polygon(0 100%, 0 0, ${50 + score/2}% 0, ${50 + score/2}% 100%)`,
          }}
        />
        <motion.div
          className="absolute bottom-0 left-1/2 w-1 h-12 bg-foreground rounded-full origin-bottom"
          initial={{ rotate: -90 }}
          animate={{ rotate: rotation }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ marginLeft: '-2px' }}
        />
        <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-foreground rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>
      <div className="text-center mt-2">
        <span className="text-3xl font-bold text-foreground">{score}</span>
        <span className="text-lg text-muted-foreground">/100</span>
      </div>
      <span className={`text-sm font-medium ${color}`}>{label}</span>
    </div>
  );
}

export function History() {
  const { currentProfile, waterLogs, getFilteredLogs, deleteWaterLog, getHydrationScore } = useProfile();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterType>('day');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const filteredLogs = useMemo(() => {
    if (selectedDate) {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return waterLogs.filter(log => {
        const logDate = new Date(log.logged_at);
        return logDate >= start && logDate <= end;
      });
    }
    return getFilteredLogs(activeFilter);
  }, [activeFilter, getFilteredLogs, selectedDate, waterLogs]);

  const stats = useMemo(() => {
    const total = filteredLogs.reduce((sum, d) => sum + d.amount, 0);
    const count = filteredLogs.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  }, [filteredLogs]);

  const score = useMemo(() => getHydrationScore(filteredLogs), [filteredLogs, getHydrationScore]);

  // Generate chart data
  const chartData = useMemo(() => {
    if (activeFilter === 'hour') {
      // Last 12 hours
      const data = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const start = new Date(hour);
        start.setMinutes(0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        
        const amount = waterLogs
          .filter(log => {
            const logTime = new Date(log.logged_at);
            return logTime >= start && logTime < end;
          })
          .reduce((sum, log) => sum + log.amount, 0);
        
        data.push({
          label: format(hour, 'ha'),
          amount,
        });
      }
      return data;
    } else if (activeFilter === 'day') {
      // Today by hour
      const data = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < 24; i++) {
        const start = new Date(today.getTime() + i * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        
        const amount = waterLogs
          .filter(log => {
            const logTime = new Date(log.logged_at);
            return logTime >= start && logTime < end;
          })
          .reduce((sum, log) => sum + log.amount, 0);
        
        data.push({
          label: format(start, 'ha'),
          amount,
        });
      }
      return data;
    } else if (activeFilter === 'week') {
      // Last 7 days
      const data = [];
      const now = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
        
        const amount = waterLogs
          .filter(log => {
            const logTime = new Date(log.logged_at);
            return logTime >= day && logTime < nextDay;
          })
          .reduce((sum, log) => sum + log.amount, 0);
        
        data.push({
          label: format(day, 'EEE'),
          amount,
        });
      }
      return data;
    } else {
      // Last 30 days
      const data = [];
      const now = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
        
        const amount = waterLogs
          .filter(log => {
            const logTime = new Date(log.logged_at);
            return logTime >= day && logTime < nextDay;
          })
          .reduce((sum, log) => sum + log.amount, 0);
        
        data.push({
          label: format(day, 'd'),
          amount,
        });
      }
      return data;
    }
  }, [activeFilter, waterLogs]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const getDayIntake = (day: Date) => {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    
    return waterLogs
      .filter(log => {
        const logTime = new Date(log.logged_at);
        return logTime >= start && logTime <= end;
      })
      .reduce((sum, log) => sum + log.amount, 0);
  };

  const handleDelete = async (logId: string, amount: number) => {
    await deleteWaterLog(logId);
    toast({
      title: 'Entry deleted',
      description: `Removed ${amount.toFixed(1)} ${currentProfile?.unit_preference} from history.`,
    });
  };

  const handleDateSelect = (day: Date) => {
    if (selectedDate && isSameDay(selectedDate, day)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(day);
      setActiveFilter('day');
    }
  };

  if (!currentProfile) return null;

  const dailyGoal = currentProfile.daily_goal;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen pb-32 px-4"
    >
      <header className="pt-10 pb-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20 glow-effect-sm">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">History</h1>
            <p className="text-sm text-muted-foreground">Track your hydration patterns</p>
          </div>
        </motion.div>
      </header>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 mb-4">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id && !selectedDate ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setActiveFilter(filter.id);
              setSelectedDate(null);
            }}
            className={activeFilter === filter.id && !selectedDate ? 'bg-primary/20 text-foreground hover:bg-primary/30' : 'text-muted-foreground hover:text-foreground'}
          >
            {filter.label}
          </Button>
        ))}
      </motion.div>

      {selectedDate && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="mb-4 p-2 bg-primary/10 rounded-lg flex items-center justify-between"
        >
          <span className="text-sm text-foreground">
            Showing: {format(selectedDate, 'MMMM d, yyyy')}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelectedDate(null)}>
            Clear
          </Button>
        </motion.div>
      )}

      {/* Hydration Score */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.1 }} 
        className="glass-card p-4 mb-4"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-3 text-center">Hydration Score</h3>
        <HydrationScoreGauge score={score} />
      </motion.div>

      {/* Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.15 }} 
        className="glass-card p-4 mb-4"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Intake Over Time</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${value.toFixed(1)} ${currentProfile.unit_preference}`, 'Intake']}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorAmount)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Beverage Split */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.17 }} 
        className="glass-card p-4 mb-4"
      >
        <BeverageSplit logs={filteredLogs} />
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-3 gap-2 mb-4">
        <div className="glass-card p-3 text-center">
          <Droplet className="w-4 h-4 mx-auto mb-1 text-primary" />
          <div className="text-lg font-bold text-foreground">{stats.total.toFixed(0)}</div>
          <div className="text-[10px] text-muted-foreground">{currentProfile.unit_preference} total</div>
        </div>
        <div className="glass-card p-3 text-center">
          <TrendingUp className="w-4 h-4 mx-auto mb-1 text-success" />
          <div className="text-lg font-bold text-foreground">{stats.avg}</div>
          <div className="text-[10px] text-muted-foreground">{currentProfile.unit_preference} avg</div>
        </div>
        <div className="glass-card p-3 text-center">
          <Clock className="w-4 h-4 mx-auto mb-1 text-accent" />
          <div className="text-lg font-bold text-foreground">{stats.count}</div>
          <div className="text-[10px] text-muted-foreground">entries</div>
        </div>
      </motion.div>

      {/* Calendar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.25 }} 
        className="glass-card p-4 mb-4"
      >
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-sm font-medium text-foreground">
            {format(calendarMonth, 'MMMM yyyy')}
          </h3>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-xs text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before start of month */}
          {Array.from({ length: calendarDays[0]?.getDay() || 0 }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {calendarDays.map(day => {
            const intake = getDayIntake(day);
            const percentage = dailyGoal > 0 ? Math.min((intake / dailyGoal) * 100, 100) : 0;
            const isSelected = selectedDate && isSameDay(selectedDate, day);
            const isTodayDate = isToday(day);
            
            return (
              <motion.button
                key={day.toISOString()}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleDateSelect(day)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative overflow-hidden transition-colors ${
                  isSelected ? 'ring-2 ring-primary' : ''
                } ${isTodayDate ? 'bg-primary/20' : 'hover:bg-card/60'}`}
              >
                {/* Progress fill */}
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-primary/30 transition-all"
                  style={{ height: `${percentage}%` }}
                />
                <span className={`relative z-10 ${isTodayDate ? 'font-bold text-primary' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Recent Entries */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Entries</h3>
        <AnimatePresence>
          {filteredLogs.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
              {filteredLogs.slice(0, 20).map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 group"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Droplet className="w-3 h-3 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground capitalize">{log.drink_type}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {format(new Date(log.logged_at), 'MMM d')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{log.amount.toFixed(1)} {currentProfile.unit_preference}</span>
                    <Button
                      onClick={() => handleDelete(log.id, log.amount)}
                      variant="ghost"
                      size="icon"
                      aria-label="Delete log"
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No entries for this period</p>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}