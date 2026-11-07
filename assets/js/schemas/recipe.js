import { CONTEXT, clean, lines, one, num, f, csv, nonEmptyRows, joinLines, str, asArray, text } from './util.js';

const fields = [
  f('name', 'Recipe name', 'text', { required: true, ld: 'name' }),
  f('images', 'Image URLs (one per line)', 'list', { required: true, format: 'url', ld: 'image' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
  f('authorName', 'Author', 'text', { ld: 'author' }),
  f('datePublished', 'Date published', 'text', { format: 'date', ld: 'datePublished' }),
  f('prepTime', 'Prep time (ISO 8601)', 'text', { format: 'duration', ld: 'prepTime', placeholder: 'PT15M' }),
  f('cookTime', 'Cook time (ISO 8601)', 'text', { format: 'duration', ld: 'cookTime', placeholder: 'PT30M' }),
  f('totalTime', 'Total time (ISO 8601)', 'text', { format: 'duration', ld: 'totalTime', placeholder: 'PT45M' }),
  f('yield', 'Yield', 'text', { ld: 'recipeYield', placeholder: '4 servings' }),
  f('category', 'Category', 'text', { ld: 'recipeCategory', placeholder: 'Dinner' }),
  f('cuisine', 'Cuisine', 'text', { ld: 'recipeCuisine', placeholder: 'Bangladeshi' }),
  f('keywords', 'Keywords (comma separated)', 'text', { ld: 'keywords' }),
  f('calories', 'Calories', 'text', { ld: 'nutrition.calories', placeholder: '270 calories' }),
  f('ingredients', 'Ingredients (one per line)', 'list', { ld: 'recipeIngredient' }),
  f('instructions', 'Instructions', 'rows', {
    itemLabel: 'step', ld: 'recipeInstructions',
    fields: [f('name', 'Step name', 'text'), f('text', 'Instruction', 'textarea', { required: true })],
  }),
  f('ratingValue', 'Average rating', 'number', { ld: 'aggregateRating' }),
  f('ratingCount', 'Number of ratings', 'number', {
    check: (v, a) => (!v && a.ratingValue ? 'Rating count is required with a rating.' : ''),
  }),
];

export default {
  id: 'recipe',
  label: 'Recipe',
  types: ['Recipe'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/recipe',
  fields,
  rules: {
    required: ['name', 'image'],
    recommended: [
      'author', 'datePublished', 'description', 'prepTime', 'cookTime', 'totalTime', 'recipeYield', 'recipeCategory',
      'recipeCuisine', 'keywords', 'nutrition.calories', 'recipeIngredient', 'recipeInstructions', 'aggregateRating',
    ],
  },
  build(v) {
    const kw = csv(v.keywords);
    return clean({
      '@context': CONTEXT,
      '@type': 'Recipe',
      name: v.name,
      image: one(lines(v.images)),
      description: v.description,
      author: v.authorName ? { '@type': 'Person', name: v.authorName } : undefined,
      datePublished: v.datePublished,
      prepTime: v.prepTime,
      cookTime: v.cookTime,
      totalTime: v.totalTime,
      recipeYield: v.yield,
      recipeCategory: v.category,
      recipeCuisine: v.cuisine,
      keywords: kw.length ? kw.join(', ') : undefined,
      nutrition: { '@type': 'NutritionInformation', calories: v.calories },
      recipeIngredient: lines(v.ingredients),
      recipeInstructions: nonEmptyRows(v.instructions, ['name', 'text']).map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
      aggregateRating: { '@type': 'AggregateRating', ratingValue: num(v.ratingValue), ratingCount: num(v.ratingCount) },
    });
  },
  parse(n) {
    const steps = asArray(n.recipeInstructions).map((s) => (typeof s === 'string' ? { name: '', text: s } : { name: str(s.name), text: str(s.text) }));
    const r = n.aggregateRating || {};
    return {
      name: str(n.name), images: joinLines(n.image), description: str(n.description), authorName: text(asArray(n.author)[0]),
      datePublished: str(n.datePublished), prepTime: str(n.prepTime), cookTime: str(n.cookTime), totalTime: str(n.totalTime),
      yield: str(asArray(n.recipeYield)[0]), category: str(asArray(n.recipeCategory)[0]), cuisine: str(asArray(n.recipeCuisine)[0]),
      keywords: asArray(n.keywords).join(', '), calories: str(n.nutrition?.calories),
      ingredients: asArray(n.recipeIngredient).join('\n'),
      ...(steps.length ? { instructions: steps } : {}),
      ratingValue: str(r.ratingValue), ratingCount: str(r.ratingCount ?? r.reviewCount),
    };
  },
};
