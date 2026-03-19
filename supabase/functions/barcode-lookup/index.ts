import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OZ_TO_ML = 29.5735;
const CL_TO_ML = 10;
const L_TO_ML = 1000;

type LookupResult = {
  found: boolean;
  name?: string;
  volume_ml?: number | null;
  volume_oz?: number | null;
};

type ParsedVolume = {
  volumeMl: number;
  volumeOz: number;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const extractStringCandidates = (value: unknown, output: string[] = []): string[] => {
  if (value == null) return output;
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractStringCandidates(item, output));
    return output;
  }
  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      extractStringCandidates(item, output)
    );
  }
  return output;
};

const normalizeUnit = (value: string) => value.toLowerCase().replace(/\s+/g, "");

const parseVolume = (input: string): ParsedVolume | null => {
  const regex = /(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|oz|ml|l|cl)\b/gi;
  const matches: ParsedVolume[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    const value = Number.parseFloat(match[1]);
    const unit = normalizeUnit(match[2]);
    if (Number.isFinite(value) && value > 0) {
      if (unit === "ml") {
        matches.push({ volumeMl: value, volumeOz: value / OZ_TO_ML });
      } else if (unit === "cl") {
        const ml = value * CL_TO_ML;
        matches.push({ volumeMl: ml, volumeOz: ml / OZ_TO_ML });
      } else if (unit === "l") {
        const ml = value * L_TO_ML;
        matches.push({ volumeMl: ml, volumeOz: ml / OZ_TO_ML });
      } else if (unit === "oz" || unit === "fl.oz" || unit === "floz") {
        matches.push({ volumeMl: value * OZ_TO_ML, volumeOz: value });
      }
    }
  }

  if (!matches.length) return null;

  // Prefer the largest detected package volume in a field (usually container size vs serving size).
  return matches.reduce((best, curr) => (curr.volumeMl > best.volumeMl ? curr : best));
};

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const parseVolumeFromPrioritizedFields = (
  ...values: unknown[]
): ParsedVolume | null => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const parsed = parseVolume(value);
    if (parsed) return parsed;
  }
  return null;
};

const parseServingsPer = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed && parsed > 0) return parsed;
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();
    const normalized = String(barcode ?? "").replace(/[^0-9A-Za-z]/g, "").trim();

    if (!normalized) {
      return new Response(JSON.stringify({ found: false, error: "Invalid barcode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keycode = Deno.env.get("EANDATA_API_KEY");
    if (!keycode) {
      return new Response(JSON.stringify({ found: false, error: "EANDATA_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL("https://eandata.com/feed/");
    url.searchParams.set("v", "3");
    url.searchParams.set("keycode", keycode);
    url.searchParams.set("mode", "json");
    url.searchParams.set("find", normalized);
    url.searchParams.set("get", "product,brand,description,serving_size,servings_per,fluid,net_contents,size");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          found: false,
          error: `EANData HTTP ${response.status}`,
          detail: errorText.slice(0, 300),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payload = await response.json();
    const feedRoot = payload?.feed ?? payload;
    const product =
      feedRoot?.product ??
      feedRoot?.products?.[0] ??
      feedRoot?.result?.product ??
      payload?.product ??
      payload?.products?.[0] ??
      payload?.result?.product ??
      null;
    if (!product) {
      const result: LookupResult = { found: false };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attributes = product?.attributes ?? {};
    const name = firstNonEmptyString(
      product?.product_name,
      attributes?.english,
      attributes?.product,
      attributes?.description,
      product?.description,
      attributes?.title,
    );

    if (!name) {
      const result: LookupResult = { found: false };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numericMl =
      asNumber(attributes?.net_volume_ml) ??
      asNumber(attributes?.volume_ml) ??
      asNumber(product?.volume_ml);
    const numericOz =
      asNumber(attributes?.net_volume_oz) ??
      asNumber(attributes?.volume_oz) ??
      asNumber(product?.volume_oz);

    let volumeMl: number | undefined;
    let volumeOz: number | undefined;
    let parsedVolume: ParsedVolume | null = null;

    if (numericMl && numericMl > 0) volumeMl = numericMl;
    if (numericOz && numericOz > 0) volumeOz = numericOz;

    if (!volumeMl && !volumeOz) {
      // Prefer fields that usually represent total package/container fluid amount.
      parsedVolume = parseVolumeFromPrioritizedFields(
        attributes?.fluid,
        product?.fluid,
        attributes?.net_contents,
        attributes?.package_size,
        attributes?.size,
        attributes?.description,
        product?.description,
        attributes?.product,
        product?.product_name,
        attributes?.english,
      );
    }

    if (!volumeMl && !volumeOz && !parsedVolume) {
      // Serving size can be smaller than the total package amount, so treat as fallback.
      parsedVolume = parseVolumeFromPrioritizedFields(
        attributes?.serving_size,
        product?.serving_size,
      );
    }

    if (!volumeMl && !volumeOz && parsedVolume) {
      // For labels like "Serving Size 8 fl oz" + "Servings Per 2.1", estimate container volume.
      const servingsPer = parseServingsPer(
        attributes?.servings_per,
        attributes?.servings,
        product?.servings_per,
        product?.servings,
      );

      if (servingsPer && servingsPer > 1 && servingsPer <= 6) {
        parsedVolume = {
          volumeMl: parsedVolume.volumeMl * servingsPer,
          volumeOz: parsedVolume.volumeOz * servingsPer,
        };
      }
    }

    if (!volumeMl && !volumeOz && !parsedVolume) {
      const strings = extractStringCandidates({ product, attributes });
      let best: ParsedVolume | null = null;
      for (const candidate of strings) {
        const parsed = parseVolume(candidate);
        if (!parsed) continue;
        if (!best || parsed.volumeMl > best.volumeMl) {
          best = parsed;
        }
      }
      parsedVolume = best;
    }

    if (!volumeMl && !volumeOz && parsedVolume) {
      volumeMl = parsedVolume.volumeMl;
      volumeOz = parsedVolume.volumeOz;
    }

    if (volumeMl && !volumeOz) volumeOz = volumeMl / OZ_TO_ML;
    if (volumeOz && !volumeMl) volumeMl = volumeOz * OZ_TO_ML;

    const result: LookupResult = {
      found: true,
      name,
      volume_ml: volumeMl ? Math.round(volumeMl * 10) / 10 : null,
      volume_oz: volumeOz ? Math.round(volumeOz * 10) / 10 : null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        found: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
