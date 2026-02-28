import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface Beverage {
  id: string;
  profile_id: string;
  name: string;
  serving_size: number;
  hydration_factor: number;
  icon: string;
  is_default: boolean;
  created_at: string;
}

export interface ScannedBeverage {
  id: string;
  profile_id: string;
  barcode: string;
  name: string;
  serving_size: number;
  hydration_factor: number;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  unit_preference: 'oz' | 'ml';
  wake_time: string;
  sleep_time: string;
  activity_level: 'light' | 'moderate' | 'high';
  daily_goal: number;
  interval_length: number;
  theme: string;
  custom_accent_color: string | null;
  gradient_preset: string | null;
  reminders_enabled: boolean;
  reminder_interval: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaterLog {
  id: string;
  profile_id: string;
  amount: number;
  drink_type: string;
  logged_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  profile_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const DEFAULT_BEVERAGES = [
  { name: 'Water', serving_size_oz: 8, serving_size_ml: 240, hydration_factor: 1.0, icon: 'droplet' },
  { name: 'Sparkling Water', serving_size_oz: 12, serving_size_ml: 355, hydration_factor: 1.0, icon: 'sparkles' },
  { name: 'Tea', serving_size_oz: 8, serving_size_ml: 240, hydration_factor: 0.9, icon: 'leaf' },
  { name: 'Coffee', serving_size_oz: 8, serving_size_ml: 240, hydration_factor: 0.8, icon: 'coffee' },
  { name: 'Orange Juice', serving_size_oz: 8, serving_size_ml: 240, hydration_factor: 0.85, icon: 'citrus' },
  { name: 'Sports Drink', serving_size_oz: 12, serving_size_ml: 355, hydration_factor: 0.95, icon: 'zap' },
  { name: 'Soda', serving_size_oz: 12, serving_size_ml: 355, hydration_factor: 0.5, icon: 'cup-soda' },
];

interface ProfileContextType {
  profiles: Profile[];
  currentProfile: Profile | null;
  waterLogs: WaterLog[];
  beverages: Beverage[];
  scannedBeverages: ScannedBeverage[];
  chatMessages: ChatMessage[];
  loading: boolean;
  setCurrentProfile: (profile: Profile | null) => void;
  createProfile: (profile: Partial<Profile>) => Promise<Profile | null>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  fetchProfiles: () => Promise<void>;
  addWaterLog: (amount: number, drinkType?: string, hydrationFactor?: number) => Promise<void>;
  deleteWaterLog: (logId: string) => Promise<void>;
  undoLastLog: () => Promise<void>;
  getTodayIntake: () => number;
  getEffectiveIntake: () => number;
  getFilteredLogs: (filter: string, customRange?: { start: Date; end: Date }) => WaterLog[];
  getExpectedIntake: () => number;
  getExpectedRange: () => { min: number; max: number };
  isOnTrack: () => boolean;
  getStreak: () => number;
  getHydrationScore: (logs?: WaterLog[]) => number;
  getCurrentIntervalProgress: () => { current: number; target: number; timeRemaining: number; intervalIndex: number; totalIntervals: number };
  addBeverage: (beverage: Partial<Beverage>) => Promise<Beverage | null>;
  deleteBeverage: (id: string) => Promise<void>;
  addScannedBeverage: (beverage: Partial<ScannedBeverage>) => Promise<ScannedBeverage | null>;
  deleteScannedBeverage: (id: string) => Promise<void>;
  addChatMessage: (role: 'user' | 'assistant', content: string) => Promise<ChatMessage | null>;
  clearChatHistory: () => Promise<void>;
  convertAmount: (amount: number, fromUnit: 'oz' | 'ml', toUnit: 'oz' | 'ml') => number;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [scannedBeverages, setScannedBeverages] = useState<ScannedBeverage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const convertAmount = useCallback((amount: number, fromUnit: 'oz' | 'ml', toUnit: 'oz' | 'ml'): number => {
    if (fromUnit === toUnit) return amount;
    if (fromUnit === 'oz' && toUnit === 'ml') return amount * 29.5735;
    return amount / 29.5735;
  }, []);

  const fetchProfiles = useCallback(async () => {
    if (!user) {
      setProfiles([]);
      setCurrentProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const typedData = (data || []).map(p => ({
        ...p,
        unit_preference: p.unit_preference as 'oz' | 'ml',
        activity_level: p.activity_level as 'light' | 'moderate' | 'high',
      })) as Profile[];
      
      setProfiles(typedData);
      
      if (typedData.length > 0 && !currentProfile) {
        const savedProfileId = localStorage.getItem('blueBalance_currentProfile');
        const savedProfile = typedData.find(p => p.id === savedProfileId);
        setCurrentProfile(savedProfile || typedData[0]);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentProfile]);

  const fetchWaterLogs = useCallback(async () => {
    if (!currentProfile) {
      setWaterLogs([]);
      return;
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('water_logs')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .gte('logged_at', thirtyDaysAgo.toISOString())
        .order('logged_at', { ascending: false });

      if (error) throw error;
      setWaterLogs((data || []).map(log => ({ ...log, amount: Number(log.amount) })));
    } catch (error) {
      console.error('Error fetching water logs:', error);
    }
  }, [currentProfile]);

  const fetchBeverages = useCallback(async () => {
    if (!currentProfile) {
      setBeverages([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('beverages')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setBeverages((data || []).map(b => ({
        ...b,
        serving_size: Number(b.serving_size),
        hydration_factor: Number(b.hydration_factor),
      })));
    } catch (error) {
      console.error('Error fetching beverages:', error);
    }
  }, [currentProfile]);

  const fetchScannedBeverages = useCallback(async () => {
    if (!currentProfile) {
      setScannedBeverages([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('scanned_beverages')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScannedBeverages((data || []).map(b => ({
        ...b,
        serving_size: Number(b.serving_size),
        hydration_factor: Number(b.hydration_factor),
      })));
    } catch (error) {
      console.error('Error fetching scanned beverages:', error);
    }
  }, [currentProfile]);

  const fetchChatMessages = useCallback(async () => {
    if (!currentProfile) {
      setChatMessages([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setChatMessages((data || []).map(m => ({
        ...m,
        role: m.role as 'user' | 'assistant',
      })));
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    }
  }, [currentProfile]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (currentProfile) {
      localStorage.setItem('blueBalance_currentProfile', currentProfile.id);
      fetchWaterLogs();
      fetchBeverages();
      fetchScannedBeverages();
      fetchChatMessages();
      
      // Apply theme
      document.documentElement.classList.remove('theme-ocean', 'theme-mint', 'theme-sunset', 'theme-graphite', 'theme-custom');
      if (currentProfile.theme === 'custom' && currentProfile.custom_accent_color) {
        document.documentElement.classList.add('theme-custom');
        // Parse HSL from custom color
        const hsl = currentProfile.custom_accent_color.match(/\d+/g);
        if (hsl && hsl.length >= 3) {
          document.documentElement.style.setProperty('--custom-accent-h', hsl[0]);
          document.documentElement.style.setProperty('--custom-accent-s', hsl[1] + '%');
          document.documentElement.style.setProperty('--custom-accent-l', hsl[2] + '%');
        }
      } else if (currentProfile.theme !== 'midnight') {
        document.documentElement.classList.add(`theme-${currentProfile.theme}`);
      }
    }
  }, [currentProfile, fetchWaterLogs, fetchBeverages, fetchScannedBeverages, fetchChatMessages]);

  const createProfile = async (profileData: Partial<Profile>): Promise<Profile | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          username: profileData.username || 'User',
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          age: profileData.age,
          height: profileData.height,
          weight: profileData.weight,
          unit_preference: profileData.unit_preference || 'oz',
          wake_time: profileData.wake_time || '07:00',
          sleep_time: profileData.sleep_time || '22:00',
          activity_level: profileData.activity_level || 'moderate',
          daily_goal: profileData.daily_goal || 80,
          interval_length: profileData.interval_length || 60,
          theme: profileData.theme || 'midnight',
          custom_accent_color: profileData.custom_accent_color,
          gradient_preset: profileData.gradient_preset,
        })
        .select()
        .single();

      if (error) throw error;
      
      const typedProfile = {
        ...data,
        unit_preference: data.unit_preference as 'oz' | 'ml',
        activity_level: data.activity_level as 'light' | 'moderate' | 'high',
      } as Profile;
      
      setProfiles(prev => [...prev, typedProfile]);
      return typedProfile;
    } catch (error) {
      console.error('Error creating profile:', error);
      return null;
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!currentProfile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentProfile.id);

      if (error) throw error;

      const updatedProfile = { ...currentProfile, ...updates } as Profile;
      setCurrentProfile(updatedProfile);
      setProfiles(prev => prev.map(p => p.id === currentProfile.id ? updatedProfile : p));
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      setProfiles(prev => prev.filter(p => p.id !== profileId));
      if (currentProfile?.id === profileId) {
        const remaining = profiles.filter(p => p.id !== profileId);
        setCurrentProfile(remaining[0] || null);
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const addWaterLog = async (amount: number, drinkType: string = 'Water', hydrationFactor: number = 1.0) => {
    if (!currentProfile) return;

    const effectiveAmount = amount * hydrationFactor;

    try {
      const { data, error } = await supabase
        .from('water_logs')
        .insert({
          profile_id: currentProfile.id,
          amount: effectiveAmount,
          drink_type: drinkType,
          logged_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      setWaterLogs(prev => [{ ...data, amount: Number(data.amount) }, ...prev]);
    } catch (error) {
      console.error('Error adding water log:', error);
    }
  };

  const deleteWaterLog = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('water_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;
      setWaterLogs(prev => prev.filter(log => log.id !== logId));
    } catch (error) {
      console.error('Error deleting water log:', error);
    }
  };

  const undoLastLog = async () => {
    const todayLogs = waterLogs.filter(log => {
      const logDate = new Date(log.logged_at);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    });

    if (todayLogs.length > 0) {
      await deleteWaterLog(todayLogs[0].id);
    }
  };

  const getTodayIntake = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return waterLogs
      .filter(log => new Date(log.logged_at) >= today)
      .reduce((sum, log) => sum + log.amount, 0);
  }, [waterLogs]);

  const getEffectiveIntake = useCallback(() => {
    return getTodayIntake();
  }, [getTodayIntake]);

  const getFilteredLogs = useCallback((filter: string, customRange?: { start: Date; end: Date }) => {
    const now = new Date();
    let startDate: Date;

    switch (filter) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (customRange) {
          return waterLogs.filter(
            log =>
              new Date(log.logged_at) >= customRange.start &&
              new Date(log.logged_at) <= customRange.end
          );
        }
        return waterLogs;
      default:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    return waterLogs.filter(log => new Date(log.logged_at) >= startDate);
  }, [waterLogs]);

  const getExpectedIntake = useCallback(() => {
    if (!currentProfile) return 0;
    
    const now = new Date();
    const [wakeHour, wakeMin] = currentProfile.wake_time.split(':').map(Number);
    const [sleepHour, sleepMin] = currentProfile.sleep_time.split(':').map(Number);

    const wakeTime = new Date(now);
    wakeTime.setHours(wakeHour, wakeMin, 0, 0);

    const sleepTime = new Date(now);
    sleepTime.setHours(sleepHour, sleepMin, 0, 0);

    if (sleepTime <= wakeTime) {
      sleepTime.setDate(sleepTime.getDate() + 1);
    }

    if (now < wakeTime) return 0;
    if (now > sleepTime) return currentProfile.daily_goal;

    const totalAwakeMs = sleepTime.getTime() - wakeTime.getTime();
    const elapsedMs = Math.max(0, Math.min(now.getTime() - wakeTime.getTime(), totalAwakeMs));
    const progress = elapsedMs / totalAwakeMs;

    return currentProfile.daily_goal * progress;
  }, [currentProfile]);

  const getExpectedRange = useCallback(() => {
    const expected = getExpectedIntake();
    const tolerance = currentProfile ? currentProfile.daily_goal * 0.1 : 0;
    return {
      min: Math.max(0, expected - tolerance),
      max: expected + tolerance,
    };
  }, [getExpectedIntake, currentProfile]);

  const isOnTrack = useCallback(() => {
    const range = getExpectedRange();
    const intake = getTodayIntake();
    return intake >= range.min;
  }, [getExpectedRange, getTodayIntake]);

  const getStreak = useCallback(() => {
    if (!currentProfile) return 0;
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const nextDay = new Date(checkDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayIntake = waterLogs
        .filter(log =>
          new Date(log.logged_at) >= checkDate && new Date(log.logged_at) < nextDay
        )
        .reduce((sum, log) => sum + log.amount, 0);

      if (dayIntake >= currentProfile.daily_goal) {
        streak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    return streak;
  }, [currentProfile, waterLogs]);

  const getHydrationScore = useCallback((logs?: WaterLog[]) => {
    if (!currentProfile) return 0;
    
    const logsToUse = logs || getFilteredLogs('day');
    const todayIntake = logsToUse.reduce((sum, log) => sum + log.amount, 0);
    
    // Goal completion (40%)
    const goalCompletion = Math.min(todayIntake / currentProfile.daily_goal, 1) * 40;
    
    // Pace adherence (30%)
    const expectedIntake = getExpectedIntake();
    const paceRatio = expectedIntake > 0 ? Math.min(todayIntake / expectedIntake, 1.2) : 1;
    const paceScore = Math.min(paceRatio, 1) * 30;
    
    // Consistency - logs spread throughout the day (30%)
    const intervalMinutes = currentProfile.interval_length;
    const [wakeHour, wakeMin] = currentProfile.wake_time.split(':').map(Number);
    const [sleepHour, sleepMin] = currentProfile.sleep_time.split(':').map(Number);
    
    const wakeMinutes = wakeHour * 60 + wakeMin;
    let sleepMinutes = sleepHour * 60 + sleepMin;
    if (sleepMinutes <= wakeMinutes) sleepMinutes += 24 * 60;
    
    const totalMinutes = sleepMinutes - wakeMinutes;
    const expectedIntervals = Math.ceil(totalMinutes / intervalMinutes);
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const elapsedMinutes = Math.max(0, currentMinutes - wakeMinutes);
    const currentInterval = Math.floor(elapsedMinutes / intervalMinutes);
    
    let intervalsMet = 0;
    for (let i = 0; i <= Math.min(currentInterval, expectedIntervals - 1); i++) {
      const intervalStart = new Date(now);
      intervalStart.setHours(0, 0, 0, 0);
      intervalStart.setMinutes(wakeMinutes + i * intervalMinutes);
      
      const intervalEnd = new Date(intervalStart);
      intervalEnd.setMinutes(intervalStart.getMinutes() + intervalMinutes);
      
      const intervalLogs = logsToUse.filter(log => {
        const logTime = new Date(log.logged_at);
        return logTime >= intervalStart && logTime < intervalEnd;
      });
      
      if (intervalLogs.length > 0) intervalsMet++;
    }
    
    const completedIntervals = Math.max(currentInterval + 1, 1);
    const consistencyScore = (intervalsMet / completedIntervals) * 30;
    
    return Math.round(goalCompletion + paceScore + consistencyScore);
  }, [currentProfile, getFilteredLogs, getExpectedIntake]);

  const getCurrentIntervalProgress = useCallback(() => {
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

  const addBeverage = async (beverageData: Partial<Beverage>): Promise<Beverage | null> => {
    if (!currentProfile) return null;

    try {
      const { data, error } = await supabase
        .from('beverages')
        .insert({
          profile_id: currentProfile.id,
          name: beverageData.name || 'Custom Beverage',
          serving_size: beverageData.serving_size || 8,
          hydration_factor: beverageData.hydration_factor || 1.0,
          icon: beverageData.icon || 'droplet',
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      
      const typedBeverage = {
        ...data,
        serving_size: Number(data.serving_size),
        hydration_factor: Number(data.hydration_factor),
      } as Beverage;
      
      setBeverages(prev => [...prev, typedBeverage]);
      return typedBeverage;
    } catch (error) {
      console.error('Error adding beverage:', error);
      return null;
    }
  };

  const deleteBeverage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('beverages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setBeverages(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting beverage:', error);
    }
  };

  const addScannedBeverage = async (beverageData: Partial<ScannedBeverage>): Promise<ScannedBeverage | null> => {
    if (!currentProfile) return null;

    try {
      const { data, error } = await supabase
        .from('scanned_beverages')
        .insert({
          profile_id: currentProfile.id,
          barcode: beverageData.barcode || '',
          name: beverageData.name || 'Scanned Beverage',
          serving_size: beverageData.serving_size || 8,
          hydration_factor: beverageData.hydration_factor || 1.0,
        })
        .select()
        .single();

      if (error) throw error;
      
      const typedBeverage = {
        ...data,
        serving_size: Number(data.serving_size),
        hydration_factor: Number(data.hydration_factor),
      } as ScannedBeverage;
      
      setScannedBeverages(prev => [typedBeverage, ...prev]);
      return typedBeverage;
    } catch (error) {
      console.error('Error adding scanned beverage:', error);
      return null;
    }
  };

  const deleteScannedBeverage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scanned_beverages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setScannedBeverages(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting scanned beverage:', error);
    }
  };

  const addChatMessage = async (role: 'user' | 'assistant', content: string): Promise<ChatMessage | null> => {
    if (!currentProfile) return null;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          profile_id: currentProfile.id,
          role,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      
      const typedMessage = {
        ...data,
        role: data.role as 'user' | 'assistant',
      } as ChatMessage;
      
      setChatMessages(prev => [...prev, typedMessage]);
      return typedMessage;
    } catch (error) {
      console.error('Error adding chat message:', error);
      return null;
    }
  };

  const clearChatHistory = async () => {
    if (!currentProfile) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('profile_id', currentProfile.id);

      if (error) throw error;
      setChatMessages([]);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        currentProfile,
        waterLogs,
        beverages,
        scannedBeverages,
        chatMessages,
        loading,
        setCurrentProfile,
        createProfile,
        updateProfile,
        deleteProfile,
        fetchProfiles,
        addWaterLog,
        deleteWaterLog,
        undoLastLog,
        getTodayIntake,
        getEffectiveIntake,
        getFilteredLogs,
        getExpectedIntake,
        getExpectedRange,
        isOnTrack,
        getStreak,
        getHydrationScore,
        getCurrentIntervalProgress,
        addBeverage,
        deleteBeverage,
        addScannedBeverage,
        deleteScannedBeverage,
        addChatMessage,
        clearChatHistory,
        convertAmount,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}