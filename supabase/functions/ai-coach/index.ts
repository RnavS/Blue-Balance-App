import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type Provider = 'lovable' | 'openai' | 'gemini';

const resolveProvider = (): Provider => {
  const raw = (Deno.env.get('AI_PROVIDER') || 'lovable').toLowerCase().trim();
  if (raw === 'openai' || raw === 'gemini' || raw === 'lovable') return raw;
  return 'lovable';
};

const normalizeHistory = (history: unknown): ChatMessage[] => {
  if (!Array.isArray(history)) return [];
  return history
    .map((item: any) => ({
      role: item?.role === 'assistant' ? 'assistant' : item?.role === 'system' ? 'system' : 'user',
      content: typeof item?.content === 'string' ? item.content : '',
    }))
    .filter((item) => item.content.trim().length > 0);
};

const parseActionJson = (text: string): { action: any | null; cleanText: string } => {
  const start = text.lastIndexOf('{"action"');
  if (start === -1) return { action: null, cleanText: text.trim() };

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") depth--;

    if (depth === 0) {
      end = i + 1;
      break;
    }
  }

  if (end === -1) return { action: null, cleanText: text.trim() };

  const candidate = text.slice(start, end);
  try {
    const parsed = JSON.parse(candidate);
    const cleanText = `${text.slice(0, start)}${text.slice(end)}`.trim();
    return { action: parsed?.action ?? null, cleanText };
  } catch {
    return { action: null, cleanText: text.trim() };
  }
};

const callLovable = async (messages: ChatMessage[]) => {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('LOVABLE_MODEL') || 'google/gemini-2.5-flash',
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LOVABLE_HTTP_${response.status}:${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

const callOpenAI = async (messages: ChatMessage[]) => {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OPENAI_HTTP_${response.status}:${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

const callGemini = async (systemPrompt: string, history: ChatMessage[], userMessage: string) => {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  // Gemini uses user/model roles; include system prompt as leading instruction message.
  const contents = [
    { role: 'user', parts: [{ text: `System instructions:\n${systemPrompt}` }] },
    ...history.map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.4,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GEMINI_HTTP_${response.status}:${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p: any) => p?.text || '').join('').trim();
};

const runProvider = async (provider: Provider, systemPrompt: string, history: ChatMessage[], message: string) => {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  if (provider === 'openai') return await callOpenAI(messages);
  if (provider === 'gemini') return await callGemini(systemPrompt, history, message);
  return await callLovable(messages);
};

const mapProviderErrorToUserMessage = (provider: Provider, errorText: string): string | null => {
  const normalized = errorText.toLowerCase();

  if (normalized.includes('is not configured')) {
    if (provider === 'openai') {
      return 'AI coach setup needed: set OPENAI_API_KEY and deploy the ai-coach function.';
    }
    if (provider === 'gemini') {
      return 'AI coach setup needed: set GEMINI_API_KEY and deploy the ai-coach function.';
    }
    return 'AI coach setup needed: set LOVABLE_API_KEY and deploy the ai-coach function.';
  }

  if (normalized.includes('_http_401') || normalized.includes('_http_403')) {
    return `AI provider rejected credentials for ${provider}. Update that provider key secret and redeploy ai-coach.`;
  }

  if (normalized.includes('_http_404')) {
    return `AI model for ${provider} was not found. Update the model secret and redeploy ai-coach.`;
  }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, history } = await req.json();
    const provider = resolveProvider();
    const safeHistory = normalizeHistory(history);

const systemPrompt = `You are Blue Balance AI Coach, a friendly and knowledgeable hydration assistant.

CRITICAL FORMATTING RULES:
- Write in plain text only. NO asterisks, NO bold markers (**), NO markdown formatting.
- Use simple dashes (-) for bullet points if needed.
- Keep responses conversational and natural.
- Do NOT use headers or special formatting.

YOUR ROLE:
1. Answer questions about hydration using the user's actual data.
2. Make settings changes when requested (include action JSON at end).
3. Provide clickable links when users ask where to buy products.

RESPONSE GUIDELINES:
- Be specific and use numbers from the user's data.
- Keep responses short (2-4 sentences for simple questions).
- Be encouraging but not overly enthusiastic.
- If user asks to change a setting, confirm what you changed.

SETTINGS ACTIONS (add this JSON at the END of your response when user requests changes):
- Goal change: {"action":{"type":"update_goal","params":{"daily_goal":100}}}
- Add beverage: {"action":{"type":"add_water","params":{"amount":8,"drink_type":"Water"}}}
- Schedule: {"action":{"type":"update_schedule","params":{"wake_time":"06:00","sleep_time":"22:00"}}}
- Interval: {"action":{"type":"update_interval","params":{"interval_length":45}}}
- Reminders: {"action":{"type":"update_reminders","params":{"reminders_enabled":true,"reminder_interval":30}}}
- Theme: {"action":{"type":"update_theme","params":{"theme":"ocean"}}}

Available themes: midnight, ocean, mint, sunset, graphite

SHOPPING LINKS (use markdown format for clickable links):
When user asks where to buy water bottles, filters, etc:
- [Search on Amazon](https://amazon.com/s?k=reusable+water+bottle)
- [Search on Google](https://google.com/search?tbm=shop&q=water+bottle)

Current User Context:
${context}`;

    let responseText = '';
    try {
      responseText = await runProvider(provider, systemPrompt, safeHistory, message);
    } catch (providerError: any) {
      const providerErrorText = providerError instanceof Error ? providerError.message : String(providerError);
      console.error('AI provider error:', provider, providerErrorText);
      if (providerErrorText.includes('_HTTP_429')) {
        return new Response(JSON.stringify({
          response: "I'm receiving too many requests right now. Please try again in a moment.",
          error: 'rate_limited'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const setupMessage = mapProviderErrorToUserMessage(provider, providerErrorText);
      if (setupMessage) {
        return new Response(JSON.stringify({
          response: setupMessage,
          error: providerErrorText,
          provider
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw providerError;
    }

    if (!responseText) {
      responseText = "I'm here to help with your hydration goals!";
    }

    const { action, cleanText } = parseActionJson(responseText);

    return new Response(JSON.stringify({ response: cleanText, action, provider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI Coach error:', error);
    return new Response(JSON.stringify({ 
      response: "I'm having trouble connecting right now. Please try again!",
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
