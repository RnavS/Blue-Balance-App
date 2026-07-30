import { config } from '../config.js';

// Ported verbatim from supabase/functions/barcode-lookup/index.ts — the provider
// chain (Open Food Facts -> UPCItemDB -> Go-UPC) and all the volume parsing
// heuristics are unchanged.

export type LookupResult = {
  name: string;
  serving_size: number;
  hydration_factor: number;
  source: 'lookup';
  lookup_provider: 'open_food_facts' | 'upcitemdb' | 'go_upc' | 'unknown';
};

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(',', '.').match(/\d+(\.\d+)?/);
    if (cleaned) {
      const num = parseFloat(cleaned[0]);
      if (Number.isFinite(num) && num > 0) return num;
    }
  }
  return null;
}

function toMl(amount: number, rawUnit: string): number | null {
  const unit = rawUnit.toLowerCase().trim();
  if (!unit) return null;
  if (unit.includes('ml')) return amount;
  if (unit === 'l' || unit.includes('liter') || unit.includes('litre')) return amount * 1000;
  if (unit.includes('cl')) return amount * 10;
  if (
    unit.includes('fl oz') ||
    unit.includes('fluid ounce') ||
    unit === 'oz' ||
    unit.includes('ounce')
  ) {
    return amount * 29.5735;
  }
  return null;
}

function parseVolumeFromText(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const str = value.replace(',', '.').toLowerCase();
  const regex =
    /(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|fluid\s*ounces?|oz|ml|millilit(?:er|re)s?|lit(?:er|re)s?|l|cl)\b/g;
  const candidates: number[] = [];
  let match = regex.exec(str);

  while (match) {
    const amount = parseFloat(match[1]!);
    const converted = toMl(amount, match[2]!);
    if (converted && converted > 0) candidates.push(converted);
    match = regex.exec(str);
  }

  if (!candidates.length) return null;
  const realistic = candidates.filter((entry) => entry >= 100 && entry <= 3000);
  return realistic.length ? Math.max(...realistic) : Math.max(...candidates);
}

function normalizeVolumeToUnit(ml: number, unit: 'oz' | 'ml') {
  const converted = unit === 'oz' ? ml / 29.5735 : ml;
  return unit === 'oz' ? Math.round(converted * 10) / 10 : Math.round(converted);
}

function extractVolumeFromCandidateTexts(unit: 'oz' | 'ml', texts: Array<unknown>): number | null {
  for (const text of texts) {
    const parsedMl = parseVolumeFromText(text);
    if (parsedMl) return normalizeVolumeToUnit(parsedMl, unit);
  }
  return null;
}

function extractVolumeFromUnknownObject(unit: 'oz' | 'ml', node: unknown): number | null {
  const found: number[] = [];
  const seen = new Set<unknown>();

  const visit = (value: unknown, keyPath = '') => {
    if (value === null || value === undefined) return;
    if (typeof value === 'object') {
      if (seen.has(value)) return;
      seen.add(value);
    }

    if (typeof value === 'string') {
      const fromText = parseVolumeFromText(value);
      if (fromText) found.push(fromText);
      return;
    }

    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      if (/volume|size|content|quantity|serving|fluid|net/i.test(keyPath)) {
        const fromText = parseVolumeFromText(`${value} ${keyPath}`);
        if (fromText) found.push(fromText);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, keyPath));
      return;
    }

    if (typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, nested]) =>
        visit(nested, key),
      );
    }
  };

  visit(node);

  if (!found.length) return null;
  const realistic = found.filter((entry) => entry >= 120 && entry <= 3000);
  // See extractServingFromOpenFoodFacts: reject case volumes rather than
  // logging a whole multipack as one drink.
  if (!realistic.length) return null;
  return normalizeVolumeToUnit(Math.max(...realistic), unit);
}

function extractServingFromOpenFoodFacts(product: any, unit: 'oz' | 'ml'): number | null {
  const containerMl: number[] = [];
  const servingMl: number[] = [];

  const productQuantity = parseNumeric(product?.product_quantity);
  if (productQuantity) {
    const quantityUnit = String(product?.product_quantity_unit || '').trim();
    const converted = quantityUnit ? toMl(productQuantity, quantityUnit) : productQuantity;
    if (converted && converted > 0) containerMl.push(converted);
  }

  [product?.quantity, product?.product_name, product?.generic_name].forEach((entry) => {
    const parsed = parseVolumeFromText(entry);
    if (parsed) containerMl.push(parsed);
  });

  [product?.serving_size, product?.nutriments?.serving_size].forEach((entry) => {
    const parsed = parseVolumeFromText(entry);
    if (parsed) servingMl.push(parsed);
  });

  const servingQuantity = parseNumeric(product?.serving_quantity);
  if (servingQuantity) {
    const servingUnit = String(product?.serving_quantity_unit || product?.serving_unit || 'ml');
    const converted = toMl(servingQuantity, servingUnit);
    if (converted && converted > 0) servingMl.push(converted);
  }

  const pool = (containerMl.length ? containerMl : servingMl).filter(
    (entry) => Number.isFinite(entry) && entry > 0 && entry <= 5000,
  );

  if (!pool.length) return null;
  const realistic = pool.filter((entry) => entry >= 120 && entry <= 3000);
  // Multipacks report the case volume (a 12-pack of Diet Coke is "144 fl oz"),
  // which would otherwise be logged as a single 144 oz drink. When nothing looks
  // like one container, give up so the caller uses its single-serving default.
  if (!realistic.length) return null;
  return normalizeVolumeToUnit(Math.max(...realistic), unit);
}

export async function lookupBarcode(
  barcode: string,
  unit: 'oz' | 'ml',
): Promise<LookupResult | null> {
  const defaultServing = unit === 'oz' ? 16.9 : 500;
  let resolvedName: string | null = null;
  let resolvedServing: number | null = null;
  let provider: LookupResult['lookup_provider'] = 'unknown';

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    const data: any = await response.json();
    if (data?.status === 1 && data?.product) {
      resolvedName = data.product.product_name || data.product.generic_name || resolvedName;
      resolvedServing = extractServingFromOpenFoodFacts(data.product, unit) ?? resolvedServing;
      if (resolvedName || resolvedServing) provider = 'open_food_facts';
    }
  } catch {
    // Continue to fallbacks.
  }

  if (!resolvedName || !resolvedServing) {
    try {
      const response = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
      );
      if (response.ok) {
        const data: any = await response.json();
        const item = Array.isArray(data?.items) ? data.items[0] : null;
        if (item) {
          resolvedName = resolvedName || item.title || item.brand || null;
          if (!resolvedServing) {
            resolvedServing = extractVolumeFromCandidateTexts(unit, [
              item.size,
              item.dimension,
              item.weight,
              item.description,
              item.title,
            ]);
          }
          if (resolvedName || resolvedServing) provider = 'upcitemdb';
        }
      }
    } catch {
      // Continue to final fallback.
    }
  }

  if ((!resolvedName || !resolvedServing) && config.goUpcApiKey) {
    try {
      const response = await fetch(
        `https://go-upc.com/api/v1/code/${encodeURIComponent(barcode)}?key=${encodeURIComponent(config.goUpcApiKey)}`,
      );
      if (response.ok) {
        const data: any = await response.json();
        const productNode = data?.product ?? data?.item ?? data?.data ?? data;
        resolvedName =
          resolvedName || productNode?.name || productNode?.title || productNode?.product_name || null;
        if (!resolvedServing) {
          resolvedServing = extractVolumeFromUnknownObject(unit, productNode);
        }
        if (resolvedName || resolvedServing) provider = 'go_upc';
      }
    } catch {
      // Keep the lookup result empty.
    }
  }

  if (!resolvedName && !resolvedServing) return null;

  const safeName = resolvedName || 'Scanned Beverage';
  return {
    name: safeName,
    serving_size: resolvedServing ?? defaultServing,
    hydration_factor: safeName.toLowerCase().includes('water') ? 1.0 : 0.9,
    source: 'lookup',
    lookup_provider: provider,
  };
}
