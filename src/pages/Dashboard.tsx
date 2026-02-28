import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ProgressRing } from '@/components/ProgressRing';
import { IntervalTracker } from '@/components/IntervalTracker';
import { QuickAddButtons } from '@/components/QuickAddButtons';
import { StatsCards } from '@/components/StatsCards';
import { HydrationStatus } from '@/components/HydrationStatus';
import { BeverageSplit } from '@/components/BeverageSplit';
import { useProfile, DEFAULT_BEVERAGES } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import blueBalanceLogo from '@/assets/blue-balance-logo.png';

export function Dashboard() {
  const { currentProfile, beverages, addBeverage, deleteBeverage } = useProfile();
  const { toast } = useToast();
  const [showBeverageModal, setShowBeverageModal] = useState(false);
  const [newBeverageName, setNewBeverageName] = useState('');
  const [newBeverageSize, setNewBeverageSize] = useState('');
  const [newBeverageHydration, setNewBeverageHydration] = useState('100');

  if (!currentProfile) return null;

  const displayName = currentProfile.first_name || currentProfile.username;
  const unit = currentProfile.unit_preference;

  const handleAddBeverage = async () => {
    if (!newBeverageName.trim()) {
      toast({ title: 'Enter beverage name', variant: 'destructive' });
      return;
    }
    
    const size = parseFloat(newBeverageSize) || (unit === 'oz' ? 8 : 240);
    const hydration = (parseFloat(newBeverageHydration) || 100) / 100;
    
    await addBeverage({
      name: newBeverageName.trim(),
      serving_size: size,
      hydration_factor: hydration,
      icon: 'droplet',
    });
    
    setNewBeverageName('');
    setNewBeverageSize('');
    setNewBeverageHydration('100');
    toast({ title: 'Beverage added!' });
  };

  const handleDeleteBeverage = async (id: string) => {
    await deleteBeverage(id);
    toast({ title: 'Beverage removed' });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen pb-32 px-4"
    >
      {/* Header */}
      <header className="pt-10 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-1.5 rounded-xl bg-primary/10">
            <img src={blueBalanceLogo} alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Blue Balance</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {displayName}
            </p>
          </div>
        </motion.div>
      </header>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Progress Ring */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center py-2"
        >
          <ProgressRing />
        </motion.div>

        {/* Hydration Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <HydrationStatus />
        </motion.div>

        {/* Interval Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <IntervalTracker />
        </motion.div>

        {/* Beverage Split */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-4"
        >
          <BeverageSplit compact />
        </motion.div>

        {/* Quick Add with + Beverage button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <QuickAddButtons onManageBeverages={() => setShowBeverageModal(true)} />
          
          <Button
            onClick={() => setShowBeverageModal(true)}
            variant="ghost"
            className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Manage Beverages
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatsCards />
        </motion.div>
      </div>

      {/* Beverage Management Modal */}
      <Dialog open={showBeverageModal} onOpenChange={setShowBeverageModal}>
        <DialogContent className="glass-card border-white/10 sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Manage Beverages</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Add new beverage */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Add New Beverage</h4>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Name"
                  value={newBeverageName}
                  onChange={(e) => setNewBeverageName(e.target.value)}
                  className="bg-card/60 border-white/10 col-span-2"
                />
                <Input
                  type="number"
                  placeholder={unit}
                  value={newBeverageSize}
                  onChange={(e) => setNewBeverageSize(e.target.value)}
                  className="bg-card/60 border-white/10"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Hydration %</label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={newBeverageHydration}
                    onChange={(e) => setNewBeverageHydration(e.target.value)}
                    className="bg-card/60 border-white/10"
                    min={0}
                    max={100}
                  />
                </div>
                <Button onClick={handleAddBeverage} className="bg-primary self-end">
                  Add
                </Button>
              </div>
            </div>

            {/* Current beverages */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Your Beverages</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                {beverages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No custom beverages yet. Add some above or they will be created from defaults.
                  </p>
                ) : (
                  beverages.map(bev => (
                    <div 
                      key={bev.id} 
                      className="flex items-center justify-between p-2 bg-card/40 rounded-lg"
                    >
                      <div>
                        <span className="text-sm text-foreground">{bev.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {bev.serving_size} {unit} · {Math.round(bev.hydration_factor * 100)}%
                        </span>
                      </div>
                      <Button
                        onClick={() => handleDeleteBeverage(bev.id)}
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${bev.name}`}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick add defaults */}
            {beverages.length === 0 && (
              <div>
                <h4 className="text-xs text-muted-foreground mb-2">Quick add common beverages:</h4>
                <div className="flex flex-wrap gap-1">
                  {DEFAULT_BEVERAGES.slice(0, 5).map(bev => (
                    <Button
                      key={bev.name}
                      variant="outline"
                      size="sm"
                      className="text-xs border-white/10"
                      onClick={async () => {
                        await addBeverage({
                          name: bev.name,
                          serving_size: unit === 'oz' ? bev.serving_size_oz : bev.serving_size_ml,
                          hydration_factor: bev.hydration_factor,
                          icon: bev.icon,
                        });
                        toast({ title: `${bev.name} added!` });
                      }}
                    >
                      + {bev.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}