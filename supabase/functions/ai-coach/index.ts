import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

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

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];

    console.log('Calling AI Gateway with messages:', messages.length);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          response: "I'm receiving too many requests right now. Please try again in a moment.",
          error: 'rate_limited'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('AI Gateway error');
    }

    const data = await response.json();
    let responseText = data.choices?.[0]?.message?.content || "I'm here to help with your hydration goals!";
    
    console.log('AI Response received:', responseText.substring(0, 100));
    
    // Parse action from response
    let action = null;
    const actionMatch = responseText.match(/\{"action":\s*\{[^}]+\}\}/);
    if (actionMatch) {
      try {
        const parsed = JSON.parse(actionMatch[0]);
        action = parsed.action;
        responseText = responseText.replace(actionMatch[0], '').trim();
      } catch (e) {
        console.log('Could not parse action:', e);
      }
    }

    return new Response(JSON.stringify({ response: responseText, action }), {
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