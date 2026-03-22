const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: 'water', keywords: ['water', 'h2o', 'spring', 'mineral', 'seltzer', 'club soda', 'sparkling'] },
  { category: 'latte', keywords: ['latte'] },
  { category: 'coffee', keywords: ['coffee', 'espresso', 'americano', 'cappuccino', 'mocha', 'macchiato'] },
  { category: 'tea', keywords: ['tea', 'chai', 'matcha'] },
  { category: 'juice', keywords: ['juice', 'smoothie', 'nectar'] },
  { category: 'soda', keywords: ['soda', 'cola', 'pop', 'soft drink'] },
  { category: 'energy', keywords: ['energy', 'red bull', 'monster', 'celsius'] },
  { category: 'sports', keywords: ['gatorade', 'powerade', 'electrolyte', 'sports drink'] },
  { category: 'milk', keywords: ['milk', 'almond milk', 'oat milk', 'soy milk'] },
];

export const normalizeDrinkName = (name: string | null | undefined): string =>
  (name || '').trim().replace(/\s+/g, ' ');

export const inferBeverageCategory = (name: string | null | undefined): string => {
  const normalized = normalizeDrinkName(name).toLowerCase();
  if (!normalized) return 'other';

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.category;
    }
  }
  return 'other';
};

export const formatCategoryLabel = (category: string | null | undefined): string => {
  const raw = (category || 'other').trim().toLowerCase();
  if (!raw) return 'Other';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};
