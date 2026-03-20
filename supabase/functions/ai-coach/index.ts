import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, history } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const systemPrompt = `You are Blue, the Blue Balance hydration assistant.

CRITICAL FORMATTING RULES:
- Write in plain text only. NO asterisks, NO bold markers (**), NO markdown formatting.
- Use simple dashes (-) for bullet points if needed.
- Keep responses conversational and natural.
- Do NOT use headers or special formatting.

YOUR ROLE:
1. Answer questions about hydration using the user's actual data.
2. Make app changes when requested (include action JSON at end).
3. Proactively propose realistic daily hydration plans.

RESPONSE GUIDELINES:
- Be specific and use numbers from the user's data.
- Keep responses short (2-4 sentences for simple questions).
- Be encouraging but not overly enthusiastic.
- If user asks to change a setting, confirm what you changed.

APP ACTIONS (add this JSON at the END of your response when user requests changes):
- Goal change: {"action":{"type":"update_goal","params":{"daily_goal":100}}}
- Add beverage: {"action":{"type":"add_water","params":{"amount":8,"drink_type":"Water"}}}
- Schedule: {"action":{"type":"update_schedule","params":{"wake_time":"06:00","sleep_time":"22:00"}}}
- Interval: {"action":{"type":"update_interval","params":{"interval_length":45}}}
- Reminders: {"action":{"type":"update_reminders","params":{"reminders_enabled":true,"reminder_interval":30}}}
- Theme: {"action":{"type":"update_theme","params":{"theme":"ocean"}}}
- Unit preference: {"action":{"type":"update_unit","params":{"unit_preference":"ml"}}}
- Create beverage: {"action":{"type":"create_beverage","params":{"name":"Electrolyte Drink","serving_size":16.9,"hydration_factor":0.95}}}
- Undo latest log: {"action":{"type":"undo_last_log","params":{}}}
- Generic profile update: {"action":{"type":"update_profile","params":{"vibration_enabled":false}}}

Available themes: midnight, ocean, mint, sunset, graphite

Current User Context:
${context ?? ""}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: String(message ?? "") },
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.6,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenAI error:", resp.status, errText);

      if (resp.status === 429) {
        return new Response(
          JSON.stringify({
            response: "I'm receiving too many requests right now. Please try again in a moment.",
            error: "rate_limited",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      throw new Error(`OpenAI API error (${resp.status})`);
    }

    const data = await resp.json();
    let responseText =
      data?.choices?.[0]?.message?.content ??
      "I'm here to help with your hydration goals!";

    let action: any = null;
    const actionMatch = responseText.match(/\{"action":\s*\{[\s\S]*?\}\}/);
    if (actionMatch) {
      try {
        const parsed = JSON.parse(actionMatch[0]);
        action = parsed.action ?? null;
        responseText = responseText.replace(actionMatch[0], "").trim();
      } catch (e) {
        console.log("Could not parse action JSON:", e);
      }
    }

    return new Response(JSON.stringify({ response: responseText, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI Coach error:", error);
    return new Response(
      JSON.stringify({
        response: "I'm having trouble connecting right now. Please try again!",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
