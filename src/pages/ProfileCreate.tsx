import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfile, DEFAULT_BEVERAGES } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const activityLevels = [
  { id: 'light', label: 'Light', description: 'Mostly sitting, minimal exercise' },
  { id: 'moderate', label: 'Moderate', description: 'Regular activity, some exercise' },
  { id: 'high', label: 'High', description: 'Very active, frequent exercise' },
];

const intervalOptions = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hrs' },
  { value: 120, label: '2 hrs' },
];

const themes = [
  { id: 'midnight', name: 'Midnight Purple', preview: 'bg-violet-600', className: '' },
  { id: 'ocean', name: 'Ocean Blue', preview: 'bg-cyan-500', className: 'theme-ocean' },
  { id: 'mint', name: 'Neon Mint', preview: 'bg-emerald-500', className: 'theme-mint' },
  { id: 'sunset', name: 'Sunset', preview: 'bg-orange-500', className: 'theme-sunset' },
  { id: 'graphite', name: 'Graphite', preview: 'bg-slate-500', className: 'theme-graphite' },
];

export function ProfileCreate() {
  const navigate = useNavigate();
  const { createProfile, setCurrentProfile, addBeverage } = useProfile();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: '' as '' | 'male' | 'female',
    age: '',
    height: '',
    height_ft: '',
    height_in: '',
    weight: '',
    weight_lb: '',
    unit_preference: 'oz' as 'oz' | 'ml',
    use_metric: false,
    wake_time: '07:00',
    sleep_time: '22:00',
    activity_level: 'moderate' as 'light' | 'moderate' | 'high',
    daily_goal: 0,
    goal_mode: 'auto' as 'auto' | 'manual',
    interval_length: 60,
    reminders_enabled: true,
    reminder_interval: 30,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    theme: 'midnight',
    selected_beverages: ['Water', 'Tea', 'Coffee'] as string[],
  });

  // Apply theme preview live when step 7 is active
  useEffect(() => {
    if (step === 7) {
      const theme = themes.find(t => t.id === formData.theme);
      const root = document.documentElement;
      
      // Remove all theme classes
      themes.forEach(t => {
        if (t.className) {
          root.classList.remove(t.className);
        }
      });
      
      // Add current theme class
      if (theme?.className) {
        root.classList.add(theme.className);
      }
    }
    
    return () => {
      // Cleanup only when leaving step 7
      if (step === 7) {
        const root = document.documentElement;
        themes.forEach(t => {
          if (t.className) {
            root.classList.remove(t.className);
          }
        });
      }
    };
  }, [step, formData.theme]);

  const updateForm = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Convert height from ft/in to cm
  const getHeightCm = (): number | null => {
    if (formData.use_metric) {
      return formData.height ? parseFloat(formData.height) : null;
    }
    const ft = parseFloat(formData.height_ft) || 0;
    const inches = parseFloat(formData.height_in) || 0;
    if (ft === 0 && inches === 0) return null;
    return Math.round((ft * 30.48) + (inches * 2.54));
  };

  // Convert weight from lb to kg
  const getWeightKg = (): number | null => {
    if (formData.use_metric) {
      return formData.weight ? parseFloat(formData.weight) : null;
    }
    const lb = parseFloat(formData.weight_lb);
    if (!lb) return null;
    return Math.round(lb * 0.453592);
  };

  // National Academies Adequate Intake baseline
  const calculateGoal = () => {
    // Baseline: 3.7 L/day for men, 2.7 L/day for women
    let baselineMl = formData.gender === 'male' ? 3700 : formData.gender === 'female' ? 2700 : 3200;
    
    // Adjust for activity level
    const activityMultiplier = formData.activity_level === 'high' ? 1.15 : formData.activity_level === 'moderate' ? 1.0 : 0.85;
    baselineMl = baselineMl * activityMultiplier;
    
    // Adjust for age if provided (slight reduction for older adults)
    const age = parseInt(formData.age);
    if (age && age > 65) {
      baselineMl = baselineMl * 0.95;
    }
    
    if (formData.unit_preference === 'oz') {
      return Math.round(baselineMl / 29.5735);
    }
    return Math.round(baselineMl);
  };

  const handleNext = () => {
    if (step === 1 && !formData.first_name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter your first name.',
        variant: 'destructive',
      });
      return;
    }
    if (step < 7) {
      setStep(step + 1);
      if (step === 3 && formData.goal_mode === 'auto') {
        updateForm({ daily_goal: calculateGoal() });
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/profiles');
    }
  };

  const toggleBeverage = (name: string) => {
    setFormData(prev => ({
      ...prev,
      selected_beverages: prev.selected_beverages.includes(name)
        ? prev.selected_beverages.filter(b => b !== name)
        : [...prev.selected_beverages, name]
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    const username = `${formData.first_name} ${formData.last_name}`.trim();
    
    const profile = await createProfile({
      username,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim() || null,
      age: formData.age ? parseInt(formData.age) : null,
      height: getHeightCm(),
      weight: getWeightKg(),
      unit_preference: formData.unit_preference,
      wake_time: formData.wake_time,
      sleep_time: formData.sleep_time,
      activity_level: formData.activity_level,
      daily_goal: formData.daily_goal || calculateGoal(),
      interval_length: formData.interval_length,
      reminders_enabled: formData.reminders_enabled,
      reminder_interval: formData.reminder_interval,
      quiet_hours_start: formData.quiet_hours_start,
      quiet_hours_end: formData.quiet_hours_end,
      theme: formData.theme,
    });

    if (profile) {
      setCurrentProfile(profile);
      
      // Add selected beverages to the user's library
      for (const bevName of formData.selected_beverages) {
        const defaultBev = DEFAULT_BEVERAGES.find(b => b.name === bevName);
        if (defaultBev) {
          await addBeverage({
            name: defaultBev.name,
            serving_size: formData.unit_preference === 'oz' ? defaultBev.serving_size_oz : defaultBev.serving_size_ml,
            hydration_factor: defaultBev.hydration_factor,
            icon: defaultBev.icon,
          });
        }
      }
      
      toast({
        title: 'Profile created!',
        description: `Welcome, ${formData.first_name}!`,
      });
      navigate('/app');
    } else {
      toast({
        title: 'Error',
        description: 'Failed to create profile. Please try again.',
        variant: 'destructive',
      });
    }
    
    setLoading(false);
  };

  const totalSteps = 7;

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen px-4 py-10"
      >
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          
          <h1 className="text-xl font-bold text-foreground">Create Profile</h1>
          <p className="text-sm text-muted-foreground">Step {step} of {totalSteps}</p>
          
          {/* Progress */}
          <div className="flex gap-2 mt-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i + 1 <= step ? 'bg-primary' : 'bg-muted/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-6">
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-medium text-foreground">What's your name?</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">First Name *</label>
                  <Input
                    placeholder="First name"
                    value={formData.first_name}
                    onChange={(e) => updateForm({ first_name: e.target.value })}
                    className="bg-card/60 border-white/10 py-5"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Last Name</label>
                  <Input
                    placeholder="Last name"
                    value={formData.last_name}
                    onChange={(e) => updateForm({ last_name: e.target.value })}
                    className="bg-card/60 border-white/10 py-5"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Unit Preference</label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateForm({ unit_preference: 'oz' })}
                    variant={formData.unit_preference === 'oz' ? 'default' : 'ghost'}
                    className={formData.unit_preference === 'oz' ? 'bg-primary/20 text-foreground flex-1' : 'text-muted-foreground flex-1'}
                  >
                    Ounces (oz)
                  </Button>
                  <Button
                    onClick={() => updateForm({ unit_preference: 'ml' })}
                    variant={formData.unit_preference === 'ml' ? 'default' : 'ghost'}
                    className={formData.unit_preference === 'ml' ? 'bg-primary/20 text-foreground flex-1' : 'text-muted-foreground flex-1'}
                  >
                    Milliliters (ml)
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Gender (for hydration calculation)</label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateForm({ gender: 'male' })}
                    variant={formData.gender === 'male' ? 'default' : 'ghost'}
                    className={formData.gender === 'male' ? 'bg-primary/20 text-foreground flex-1' : 'text-muted-foreground flex-1'}
                  >
                    Male
                  </Button>
                  <Button
                    onClick={() => updateForm({ gender: 'female' })}
                    variant={formData.gender === 'female' ? 'default' : 'ghost'}
                    className={formData.gender === 'female' ? 'bg-primary/20 text-foreground flex-1' : 'text-muted-foreground flex-1'}
                  >
                    Female
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Based on National Academies Adequate Intake: 3.7 L/day for men, 2.7 L/day for women
                </p>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div>
                <h2 className="text-lg font-medium text-foreground">Tell us about yourself</h2>
                <p className="text-xs text-muted-foreground">Optional, helps personalize your experience</p>
              </div>
              
              <div className="flex items-center justify-between p-3 glass-card">
                <span className="text-sm text-foreground">Use metric units for height/weight</span>
                <Switch 
                  checked={formData.use_metric} 
                  onCheckedChange={(checked) => updateForm({ use_metric: checked })}
                />
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Age</label>
                <Input
                  type="number"
                  placeholder="30"
                  value={formData.age}
                  onChange={(e) => updateForm({ age: e.target.value })}
                  className="bg-card/60 border-white/10"
                />
              </div>
              
              {formData.use_metric ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Height (cm)</label>
                    <Input
                      type="number"
                      placeholder="170"
                      value={formData.height}
                      onChange={(e) => updateForm({ height: e.target.value })}
                      className="bg-card/60 border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Weight (kg)</label>
                    <Input
                      type="number"
                      placeholder="70"
                      value={formData.weight}
                      onChange={(e) => updateForm({ weight: e.target.value })}
                      className="bg-card/60 border-white/10"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Height</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="ft"
                        value={formData.height_ft}
                        onChange={(e) => updateForm({ height_ft: e.target.value })}
                        className="bg-card/60 border-white/10"
                      />
                      <Input
                        type="number"
                        placeholder="in"
                        value={formData.height_in}
                        onChange={(e) => updateForm({ height_in: e.target.value })}
                        className="bg-card/60 border-white/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Weight (lb)</label>
                    <Input
                      type="number"
                      placeholder="150"
                      value={formData.weight_lb}
                      onChange={(e) => updateForm({ weight_lb: e.target.value })}
                      className="bg-card/60 border-white/10"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Activity Level</label>
                <div className="space-y-2">
                  {activityLevels.map(level => (
                    <motion.button
                      key={level.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateForm({ activity_level: level.id as 'light' | 'moderate' | 'high' })}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${
                        formData.activity_level === level.id
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="font-medium text-foreground text-sm">{level.label}</div>
                      <div className="text-xs text-muted-foreground">{level.description}</div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-medium text-foreground">Your daily schedule</h2>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Wake Time</label>
                  <Input
                    type="time"
                    value={formData.wake_time}
                    onChange={(e) => updateForm({ wake_time: e.target.value })}
                    className="bg-card/60 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sleep Time</label>
                  <Input
                    type="time"
                    value={formData.sleep_time}
                    onChange={(e) => updateForm({ sleep_time: e.target.value })}
                    className="bg-card/60 border-white/10"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-muted-foreground">Hydration Interval</label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Intervals divide your day into equal periods. The app tracks your progress within each interval to help you drink consistently throughout the day rather than chugging all at once.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-2">
                  {intervalOptions.map(opt => (
                    <Button
                      key={opt.value}
                      size="sm"
                      variant={formData.interval_length === opt.value ? 'default' : 'ghost'}
                      onClick={() => updateForm({ interval_length: opt.value })}
                      className={formData.interval_length === opt.value ? 'bg-primary/20 text-foreground' : 'text-muted-foreground'}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Example: 1 hour interval means you'll have a target to drink every hour.
                </p>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-medium text-foreground">Set your daily goal</h2>
              
              <div className="flex gap-2 mb-3">
                <Button
                  onClick={() => {
                    updateForm({ goal_mode: 'auto', daily_goal: calculateGoal() });
                  }}
                  variant={formData.goal_mode === 'auto' ? 'default' : 'ghost'}
                  className={formData.goal_mode === 'auto' ? 'bg-primary/20 text-foreground flex-1' : 'text-muted-foreground flex-1'}
                >
                  Auto Calculate
                </Button>
                <Button
                  onClick={() => updateForm({ goal_mode: 'manual' })}
                  variant={formData.goal_mode === 'manual' ? 'default' : 'ghost'}
                  className={formData.goal_mode === 'manual' ? 'bg-primary/20 text-foreground flex-1' : 'text-muted-foreground flex-1'}
                >
                  Manual
                </Button>
              </div>

              {formData.goal_mode === 'auto' ? (
                <div className="glass-card p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Based on National Academies guidelines</p>
                  <div className="text-4xl font-bold text-foreground mb-1">
                    {calculateGoal()} {formData.unit_preference}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.gender === 'male' ? '3.7 L/day baseline' : formData.gender === 'female' ? '2.7 L/day baseline' : 'Average baseline'} 
                    {formData.activity_level === 'high' ? ' + 15% for high activity' : formData.activity_level === 'light' ? ' - 15% for light activity' : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Daily Goal ({formData.unit_preference})</label>
                  <Input
                    type="number"
                    placeholder={formData.unit_preference === 'oz' ? '80' : '2400'}
                    value={formData.daily_goal || ''}
                    onChange={(e) => updateForm({ daily_goal: parseInt(e.target.value) || 0 })}
                    className="bg-card/60 border-white/10 text-2xl text-center py-6"
                  />
                </div>
              )}
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-medium text-foreground">Reminders</h2>
              
              <div className="flex items-center justify-between p-3 glass-card">
                <div>
                  <span className="text-sm text-foreground block">Enable Reminders</span>
                  <span className="text-xs text-muted-foreground">Get notified when it's time to drink</span>
                </div>
                <Switch 
                  checked={formData.reminders_enabled} 
                  onCheckedChange={(checked) => updateForm({ reminders_enabled: checked })}
                />
              </div>

              {formData.reminders_enabled && (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-xs text-muted-foreground">Reminder Interval (minutes)</label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>How often to send you a reminder notification. This is separate from hydration intervals which track your progress.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="number"
                      value={formData.reminder_interval}
                      onChange={(e) => updateForm({ reminder_interval: parseInt(e.target.value) || 30 })}
                      className="bg-card/60 border-white/10"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quiet Hours Start</label>
                      <Input
                        type="time"
                        value={formData.quiet_hours_start}
                        onChange={(e) => updateForm({ quiet_hours_start: e.target.value })}
                        className="bg-card/60 border-white/10"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quiet Hours End</label>
                      <Input
                        type="time"
                        value={formData.quiet_hours_end}
                        onChange={(e) => updateForm({ quiet_hours_end: e.target.value })}
                        className="bg-card/60 border-white/10"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No reminders will be sent during quiet hours.
                  </p>
                </>
              )}
            </motion.div>
          )}

          {step === 6 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-medium text-foreground">What do you drink?</h2>
              <p className="text-xs text-muted-foreground">Select beverages to add to your quick-add library</p>
              
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_BEVERAGES.map(bev => (
                  <motion.button
                    key={bev.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleBeverage(bev.name)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.selected_beverages.includes(bev.name)
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="font-medium text-foreground text-sm">{bev.name}</div>
                    <div className="text-xs text-muted-foreground">{Math.round(bev.hydration_factor * 100)}% hydration</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 7 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-medium text-foreground">Choose your theme</h2>
              <p className="text-xs text-muted-foreground">Preview updates live as you select</p>
              
              <div className="grid grid-cols-2 gap-2">
                {themes.map(theme => (
                  <motion.button
                    key={theme.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateForm({ theme: theme.id })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.theme === theme.id
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full ${theme.preview}`} />
                      <span className="text-sm text-foreground">{theme.name}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
              
              {/* Theme preview card */}
              <div className="glass-card p-4 mt-4">
                <p className="text-sm text-muted-foreground mb-2">Preview</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <Check className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Theme Applied</p>
                    <p className="text-xs text-muted-foreground">This is how your app will look</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {step < totalSteps ? (
            <Button
              onClick={handleNext}
              className="flex-1 bg-primary hover:bg-primary/90 py-6"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary/90 py-6"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  <span>Create Profile</span>
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </TooltipProvider>
  );
}