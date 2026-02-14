import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Droplets, Undo2, Settings2 } from 'lucide-react';
import { useProfile, DEFAULT_BEVERAGES } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface QuickAddButtonsProps {
  onManageBeverages?: () => void;
}

export function QuickAddButtons({ onManageBeverages }: QuickAddButtonsProps) {
  const { currentProfile, addWaterLog, undoLastLog, waterLogs, beverages } = useProfile();
  const { toast } = useToast();
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedBeverageType, setSelectedBeverageType] = useState('Water');
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  if (!currentProfile) return null;

  const unit = currentProfile.unit_preference;
  
  // Get user's beverage library or use defaults
  const userBeverages = beverages.length > 0 ? beverages : DEFAULT_BEVERAGES.slice(0, 3).map(b => ({
    id: b.name,
    profile_id: '',
    name: b.name,
    serving_size: unit === 'oz' ? b.serving_size_oz : b.serving_size_ml,
    hydration_factor: b.hydration_factor,
    icon: b.icon,
    is_default: true,
    created_at: '',
  }));

  // Create preset buttons from user's beverages (first 3)
  const presetBeverages = userBeverages.slice(0, 3).map(bev => ({
    label: `${bev.serving_size} ${unit} ${bev.name}`,
    value: bev.serving_size,
    name: bev.name,
    hydrationFactor: bev.hydration_factor,
  }));

  const maxAmount = unit === 'oz' ? 64 : 2000;

  const handleQuickAdd = async (amount: number, beverageName: string, hydrationFactor: number = 1.0) => {
    await addWaterLog(amount, beverageName, hydrationFactor);
    setLastAdded(`${amount}-${beverageName}`);
    setTimeout(() => setLastAdded(null), 1000);
    toast({
      title: 'Beverage logged!',
      description: `Added ${amount}${unit} of ${beverageName}.`,
    });
  };

  const handleCustomAdd = async () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 0.1 || amount > maxAmount) {
      toast({
        title: 'Invalid amount',
        description: `Please enter a value between 0.1 and ${maxAmount}.`,
        variant: 'destructive',
      });
      return;
    }
    
    const beverage = userBeverages.find(b => b.name === selectedBeverageType) || 
                     DEFAULT_BEVERAGES.find(b => b.name === selectedBeverageType);
    const hydrationFactor = beverage ? beverage.hydration_factor : 1.0;
    
    await handleQuickAdd(amount, selectedBeverageType, hydrationFactor);
    setCustomAmount('');
    setShowCustomModal(false);
  };

  const handleUndo = async () => {
    const todayLogs = waterLogs.filter(log => {
      const logDate = new Date(log.logged_at);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    });
    
    if (todayLogs.length === 0) {
      toast({
        title: 'Nothing to undo',
        description: "You haven't logged any beverages today.",
      });
      return;
    }

    await undoLastLog();
    toast({
      title: 'Undone!',
      description: `Removed ${todayLogs[0].amount}${unit} of ${todayLogs[0].drink_type} from your intake.`,
    });
  };

  const hasTodayLogs = waterLogs.some(log => {
    const logDate = new Date(log.logged_at);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  });

  // All available beverage types for custom modal
  const allBeverageTypes = [
    ...userBeverages.map(b => b.name),
    ...DEFAULT_BEVERAGES.map(b => b.name).filter(name => !userBeverages.find(ub => ub.name === name))
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Droplets className="w-4 h-4" />
          <span>Quick Add</span>
        </div>
        <div className="flex items-center gap-2">
          {onManageBeverages && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onManageBeverages}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </motion.button>
          )}
          {hasTodayLogs && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleUndo}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo last</span>
            </motion.button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {presetBeverages.map(({ label, value, name, hydrationFactor }) => {
          const key = `${value}-${name}`;
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleQuickAdd(value, name, hydrationFactor)}
              className={`glass-button py-3 px-2 text-center relative overflow-hidden ${
                lastAdded === key ? 'glow-effect-sm' : ''
              }`}
            >
              <span className="text-xs font-semibold text-foreground block">{value} {unit}</span>
              <span className="text-[10px] text-muted-foreground block truncate">{name}</span>
              <AnimatePresence>
                {lastAdded === key && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-primary/30 rounded-2xl"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowCustomModal(true)}
        className="w-full glass-button py-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>Custom Amount</span>
      </motion.button>

      {/* Custom Amount Modal */}
      <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
        <DialogContent className="glass-card border-white/10 sm:max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Custom Amount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Beverage Type
              </label>
              <Select value={selectedBeverageType} onValueChange={setSelectedBeverageType}>
                <SelectTrigger className="bg-card/60 border-white/10">
                  <SelectValue placeholder="Select beverage" />
                </SelectTrigger>
                <SelectContent className="bg-card border-white/10">
                  {allBeverageTypes.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Amount ({unit})
              </label>
              <Input
                type="number"
                step="0.1"
                placeholder={`Enter amount (0.1-${maxAmount})`}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                min={0.1}
                max={maxAmount}
                className="bg-card/60 border-white/10 text-lg"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCustomAdd}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Add
              </Button>
              <Button
                onClick={() => {
                  setShowCustomModal(false);
                  setCustomAmount('');
                }}
                variant="ghost"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}