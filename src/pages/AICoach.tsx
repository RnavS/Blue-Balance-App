import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProfile } from '@/contexts/ProfileContext';
import { usePremium } from '@/contexts/PremiumContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/Supabase/client';

const sanitizeResponse = (text: string): string => {
  return text
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/___/g, '')
    .replace(/__/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const renderTextWithLinks = (text: string) => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-primary/80"
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

export function AICoach() {
  const {
    currentProfile,
    chatMessages,
    addChatMessage,
    clearChatHistory,
    getTodayIntake,
    getExpectedIntake,
    getStreak,
    getHydrationScore,
    updateProfile,
    addWaterLog,
    waterLogs
  } = useProfile();
  const { isPremium } = usePremium();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  if (!currentProfile) return null;

  const unitPreference = currentProfile.unit_preference;

  const buildContext = () => {
    const todayIntake = getTodayIntake();
    const expectedIntake = getExpectedIntake();
    const streak = getStreak();
    const score = getHydrationScore();
    const remaining = Math.max(0, currentProfile.daily_goal - todayIntake);

    return `
User Profile:
- Name: ${currentProfile.first_name || currentProfile.username}
- Daily Goal: ${currentProfile.daily_goal} ${unitPreference}
- Wake Time: ${currentProfile.wake_time}
- Sleep Time: ${currentProfile.sleep_time}
- Activity Level: ${currentProfile.activity_level}
- Interval Length: ${currentProfile.interval_length} minutes

Today's Progress:
- Current Intake: ${todayIntake.toFixed(1)} ${unitPreference}
- Expected Intake: ${expectedIntake.toFixed(1)} ${unitPreference}
- Remaining: ${remaining.toFixed(1)} ${unitPreference}
- On Track: ${todayIntake >= expectedIntake ? 'Yes' : 'No'}
- Hydration Score: ${score}/100
- Current Streak: ${streak} days

Recent Logs (last 5):
${waterLogs.slice(0, 5).map(log => `- ${log.amount}${unitPreference} of ${log.drink_type} at ${new Date(log.logged_at).toLocaleTimeString()}`).join('\n')}
    `.trim();
  };

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage('');
    setLoading(true);

    await addChatMessage('user', userMessage);

    try {
      const context = buildContext();

      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: {
          message: userMessage,
          context,
          history: chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        }
      });

      if (error) throw error;

      let response = data?.response || "I'm here to help you stay hydrated! How can I assist you today?";

      response = sanitizeResponse(response);

      if (data?.action) {
        await handleAIAction(data.action);
      }

      await addChatMessage('assistant', response);
    } catch (error) {
      console.error('AI Coach error:', error);
      await addChatMessage('assistant', "I'm having trouble connecting right now. Please try again in a moment.");
    }

    setLoading(false);
  };

  const handleAIAction = async (action: { type: string; params: any }) => {
    switch (action.type) {
      case 'update_goal':
        if (action.params.daily_goal) {
          await updateProfile({ daily_goal: action.params.daily_goal });
          toast({ title: 'Goal Updated', description: `Daily goal set to ${action.params.daily_goal} ${unitPreference}` });
        }
        break;
      case 'add_water':
        if (action.params.amount) {
          await addWaterLog(action.params.amount, action.params.drink_type || 'Water');
          toast({ title: 'Beverage Logged', description: `+${action.params.amount} ${unitPreference}` });
        }
        break;
      case 'update_schedule':
        const scheduleUpdates: any = {};
        if (action.params.wake_time) scheduleUpdates.wake_time = action.params.wake_time;
        if (action.params.sleep_time) scheduleUpdates.sleep_time = action.params.sleep_time;
        if (Object.keys(scheduleUpdates).length > 0) {
          await updateProfile(scheduleUpdates);
          toast({ title: 'Schedule Updated', description: 'Your schedule has been updated' });
        }
        break;
      case 'update_interval':
        if (action.params.interval_length) {
          await updateProfile({ interval_length: action.params.interval_length });
          toast({ title: 'Interval Updated', description: `Interval set to ${action.params.interval_length} minutes` });
        }
        break;
      case 'update_reminders':
        const reminderUpdates: any = {};
        if (action.params.reminders_enabled !== undefined) reminderUpdates.reminders_enabled = action.params.reminders_enabled;
        if (action.params.reminder_interval) reminderUpdates.reminder_interval = action.params.reminder_interval;
        if (Object.keys(reminderUpdates).length > 0) {
          await updateProfile(reminderUpdates);
          toast({ title: 'Reminders Updated' });
        }
        break;
      case 'update_theme':
        if (action.params.theme) {
          await updateProfile({ theme: action.params.theme });
          toast({ title: 'Theme Updated', description: `Theme changed to ${action.params.theme}` });
        }
        break;
    }
  };

  const handleClear = async () => {
    await clearChatHistory();
    toast({ title: 'Chat Cleared', description: 'Conversation history has been cleared' });
  };

  const suggestedQuestions = [
    "How am I doing today?",
    "When should I drink next?",
    "Set my goal to 100 oz",
    "Tips for drinking more water",
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col"
    >
      
      <header className="pt-10 pb-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 glow-effect-sm">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AI Coach</h1>
              <p className="text-sm text-muted-foreground">Your hydration assistant</p>
            </div>
          </div>
          {chatMessages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear chat"
              onClick={handleClear}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </header>

      {!isPremium ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-32">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 max-w-sm w-full text-center border-primary/20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Bot className="w-24 h-24 text-primary" />
            </div>
            <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-4 relative z-10">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2 relative z-10">Advanced AI Coaching</h2>
            <p className="text-sm text-muted-foreground mb-6 relative z-10">
              Unlock personalized hydration plans, intelligent schedule adjustments, and deep insights into your habits.
            </p>
            <Button
              className="w-full bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 text-white relative z-10"
              onClick={() => {
                toast({ title: "Premium Required", description: "You can upgrade to Premium in the Settings tab." });
              }}
            >
              Learn More
            </Button>
          </motion.div>
        </div>
      ) : (
        <>
          
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {chatMessages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-8"
              >
                <div className="glass-card p-6 inline-block mb-4">
                  <Bot className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">Hi! I'm your AI Coach</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    I can help you track hydration, adjust settings, and provide personalized tips.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedQuestions.map((q) => (
                      <motion.button
                        key={q}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setMessage(q)}
                        className="glass-button px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence>
                {chatMessages.map((msg, index) => (
                  <motion.div
                    key={msg.id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'glass-card rounded-bl-md'
                        }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.role === 'assistant' ? renderTextWithLinks(msg.content) : msg.content}
                      </p>
                      <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="glass-card p-3 rounded-2xl rounded-bl-md">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 pb-32 border-t border-white/5">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="bg-card/60 border-white/10"
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}