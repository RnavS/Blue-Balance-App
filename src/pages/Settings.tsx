import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, User, Target, Bell, Clock, Palette, Trash2, ChevronDown, ChevronUp, Users, LogOut, Timer, Droplet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, Profile, DEFAULT_BEVERAGES } from '@/contexts/ProfileContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const themes: { id: string; name: string; preview: string }[] = [
  { id: 'midnight', name: 'Midnight Purple', preview: 'bg-violet-600' },
  { id: 'ocean', name: 'Ocean Blue', preview: 'bg-cyan-500' },
  { id: 'mint', name: 'Neon Mint', preview: 'bg-emerald-500' },
  { id: 'sunset', name: 'Sunset', preview: 'bg-orange-500' },
  { id: 'graphite', name: 'Graphite', preview: 'bg-slate-500' },
];

const intervalOptions = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const activityLevels = [
  { id: 'light', label: 'Light' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'high', label: 'High' },
];

interface SectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon: Icon, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-2 space-y-4 border-t border-white/5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { currentProfile, updateProfile, deleteProfile, getExpectedRange, beverages, addBeverage, deleteBeverage } = useProfile();
  const { toast } = useToast();
  const [customColor, setCustomColor] = useState(currentProfile?.custom_accent_color || '262 83% 58%');
  const [newBeverageName, setNewBeverageName] = useState('');
  const [newBeverageSize, setNewBeverageSize] = useState('');

  if (!currentProfile) return null;

  const handleUpdate = (updates: Partial<Profile>) => {
    updateProfile(updates);
    toast({ title: 'Settings updated' });
  };

  const handleColorChange = (hue: number) => {
    const newColor = `${hue} 83% 58%`;
    setCustomColor(newColor);
    handleUpdate({ theme: 'custom', custom_accent_color: newColor });
  };

  const handleAddBeverage = async () => {
    if (!newBeverageName.trim()) return;
    const size = parseFloat(newBeverageSize) || (currentProfile.unit_preference === 'oz' ? 8 : 240);
    await addBeverage({
      name: newBeverageName.trim(),
      serving_size: size,
      hydration_factor: 0.9,
      icon: 'droplet',
    });
    setNewBeverageName('');
    setNewBeverageSize('');
    toast({ title: 'Beverage added' });
  };

  const handleDeleteProfile = async () => {
    await deleteProfile(currentProfile.id);
    toast({ title: 'Profile Deleted', description: 'Your profile has been removed.' });
    navigate('/profiles');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const range = getExpectedRange();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen pb-32 px-4">
      <header className="pt-10 pb-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20 glow-effect-sm">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Customize your experience</p>
          </div>
        </motion.div>
      </header>

      {/* Expected Range Info */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="glass-card p-3 mb-4 flex items-center gap-3"
      >
        <Target className="w-5 h-5 text-primary" />
        <div className="text-sm">
          <span className="text-muted-foreground">You should be between </span>
          <span className="font-medium text-foreground">{range.min.toFixed(0)} - {range.max.toFixed(0)} {currentProfile.unit_preference}</span>
          <span className="text-muted-foreground"> by now</span>
        </div>
      </motion.div>

      <div className="space-y-3">
        <Section title="Profile" icon={User} defaultOpen>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">First Name</label>
                <Input value={currentProfile.first_name || ''} onChange={(e) => handleUpdate({ first_name: e.target.value })} placeholder="First name" className="bg-card/60 border-white/10" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Last Name</label>
                <Input value={currentProfile.last_name || ''} onChange={(e) => handleUpdate({ last_name: e.target.value })} placeholder="Last name" className="bg-card/60 border-white/10" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Age</label>
                <Input type="number" value={currentProfile.age || ''} onChange={(e) => handleUpdate({ age: parseInt(e.target.value) || null })} className="bg-card/60 border-white/10" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Height (cm)</label>
                <Input type="number" value={currentProfile.height || ''} onChange={(e) => handleUpdate({ height: parseInt(e.target.value) || null })} className="bg-card/60 border-white/10" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Weight (kg)</label>
                <Input type="number" value={currentProfile.weight || ''} onChange={(e) => handleUpdate({ weight: parseInt(e.target.value) || null })} className="bg-card/60 border-white/10" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Activity Level</label>
              <div className="flex flex-wrap gap-2">
                {activityLevels.map((level) => (
                  <Button key={level.id} size="sm" variant={currentProfile.activity_level === level.id ? 'default' : 'ghost'} onClick={() => handleUpdate({ activity_level: level.id as Profile['activity_level'] })} className={currentProfile.activity_level === level.id ? 'bg-primary/20 text-foreground' : 'text-muted-foreground'}>
                    {level.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Hydration Goal" icon={Target}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Daily Goal ({currentProfile.unit_preference})</label>
              <Input type="number" value={currentProfile.daily_goal} onChange={(e) => handleUpdate({ daily_goal: parseInt(e.target.value) || 0 })} className="bg-card/60 border-white/10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Unit Preference</label>
              <div className="flex gap-2">
                <Button size="sm" variant={currentProfile.unit_preference === 'oz' ? 'default' : 'ghost'} onClick={() => handleUpdate({ unit_preference: 'oz' })} className={currentProfile.unit_preference === 'oz' ? 'bg-primary/20 text-foreground' : 'text-muted-foreground'}>oz</Button>
                <Button size="sm" variant={currentProfile.unit_preference === 'ml' ? 'default' : 'ghost'} onClick={() => handleUpdate({ unit_preference: 'ml' })} className={currentProfile.unit_preference === 'ml' ? 'bg-primary/20 text-foreground' : 'text-muted-foreground'}>ml</Button>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Intervals" icon={Timer}>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Interval Length</label>
            <div className="flex flex-wrap gap-2">
              {intervalOptions.map((opt) => (
                <Button 
                  key={opt.value} 
                  size="sm" 
                  variant={currentProfile.interval_length === opt.value ? 'default' : 'ghost'} 
                  onClick={() => handleUpdate({ interval_length: opt.value })} 
                  className={currentProfile.interval_length === opt.value ? 'bg-primary/20 text-foreground' : 'text-muted-foreground'}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Daily Schedule" icon={Clock}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Wake Time</label>
              <Input type="time" value={currentProfile.wake_time} onChange={(e) => handleUpdate({ wake_time: e.target.value })} className="bg-card/60 border-white/10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sleep Time</label>
              <Input type="time" value={currentProfile.sleep_time} onChange={(e) => handleUpdate({ sleep_time: e.target.value })} className="bg-card/60 border-white/10" />
            </div>
          </div>
        </Section>

        <Section title="Reminders" icon={Bell}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Enable Reminders</span>
              <Switch checked={currentProfile.reminders_enabled} onCheckedChange={(checked) => handleUpdate({ reminders_enabled: checked })} />
            </div>
            {currentProfile.reminders_enabled && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Reminder Interval (minutes)</label>
                  <Input type="number" value={currentProfile.reminder_interval} onChange={(e) => handleUpdate({ reminder_interval: parseInt(e.target.value) || 30 })} className="bg-card/60 border-white/10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quiet Start</label>
                    <Input type="time" value={currentProfile.quiet_hours_start} onChange={(e) => handleUpdate({ quiet_hours_start: e.target.value })} className="bg-card/60 border-white/10" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quiet End</label>
                    <Input type="time" value={currentProfile.quiet_hours_end} onChange={(e) => handleUpdate({ quiet_hours_end: e.target.value })} className="bg-card/60 border-white/10" />
                  </div>
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="Appearance" icon={Palette}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Theme</label>
              <div className="grid grid-cols-2 gap-2">
                {themes.map((theme) => (
                  <motion.button key={theme.id} whileTap={{ scale: 0.98 }} onClick={() => handleUpdate({ theme: theme.id })} className={`p-3 rounded-xl border transition-all ${currentProfile.theme === theme.id ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/20'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full ${theme.preview}`} />
                      <span className="text-xs text-foreground">{theme.name}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
            
            {/* Custom Color Picker */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Custom Accent Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={parseInt(customColor.split(' ')[0]) || 262}
                  onChange={(e) => handleColorChange(parseInt(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: 'linear-gradient(to right, hsl(0,83%,58%), hsl(60,83%,58%), hsl(120,83%,58%), hsl(180,83%,58%), hsl(240,83%,58%), hsl(300,83%,58%), hsl(360,83%,58%))',
                  }}
                />
                <div 
                  className="w-8 h-8 rounded-full border-2 border-white/20"
                  style={{ backgroundColor: `hsl(${customColor})` }}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Beverage Library" icon={Droplet}>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input 
                placeholder="Beverage name" 
                value={newBeverageName}
                onChange={(e) => setNewBeverageName(e.target.value)}
                className="bg-card/60 border-white/10 flex-1"
              />
              <Input 
                type="number"
                placeholder={currentProfile.unit_preference}
                value={newBeverageSize}
                onChange={(e) => setNewBeverageSize(e.target.value)}
                className="bg-card/60 border-white/10 w-20"
              />
              <Button onClick={handleAddBeverage} size="sm" className="bg-primary">Add</Button>
            </div>
            
            {beverages.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                {beverages.map((bev) => (
                  <div key={bev.id} className="flex items-center justify-between p-2 bg-card/40 rounded-lg">
                    <span className="text-sm text-foreground">{bev.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{bev.serving_size} {currentProfile.unit_preference}</span>
                      <Button onClick={() => deleteBeverage(bev.id)} variant="ghost" size="icon" aria-label={`Delete ${bev.name}`} className="h-6 w-6 text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Account" icon={Users}>
          <div className="space-y-2">
            <Button onClick={() => navigate('/profiles')} variant="outline" className="w-full border-white/10">
              <Users className="w-4 h-4 mr-2" />Switch Profile
            </Button>
            <Button onClick={handleSignOut} variant="outline" className="w-full border-white/10">
              <LogOut className="w-4 h-4 mr-2" />Sign Out
            </Button>
          </div>
        </Section>

        <Section title="Data Management" icon={Trash2}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full"><Trash2 className="w-4 h-4 mr-2" />Delete Profile</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-card border-white/10 bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Delete Profile?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">This will permanently delete this profile and all water logs. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteProfile}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Section>
      </div>
    </motion.div>
  );
}