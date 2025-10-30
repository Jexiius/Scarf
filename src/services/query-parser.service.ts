import { z } from 'zod';
import { env } from '../config/env';
import { MODELS, openai } from '../config/openai';
import { FEATURE_NAMES } from '../constants/features';

const parsedFeatureSchema = z.object({
  weight: z.number().min(0).max(1),
  target: z.number().min(0).max(1),
  required: z.boolean().optional(),
});

const parsedQuerySchema = z.object({
  features: z.record(z.string(), parsedFeatureSchema),
  intent: z.string().optional().default('general'),
  confidence: z.number().min(0).max(1).default(0.5),
  cuisines: z.array(z.string()).optional(),
  maxPrice: z.number().min(1).max(4).optional(),
  occasionType: z.string().optional(),
});

export type ParsedFeature = z.infer<typeof parsedFeatureSchema>;
export type ParsedQuery = z.infer<typeof parsedQuerySchema>;

const QUERY_PARSING_PROMPT = `You are a restaurant query parser. Extract feature preferences from the user's natural language query.

Available features: ${FEATURE_NAMES.join(', ')}

For each relevant feature mentioned or implied, return:
- weight: 0.0-1.0 (importance)
- target: 0.0-1.0 (desired value)
- required: boolean (if must-have)

Return only valid JSON with the following shape:
{
  "features": {
    "romantic": { "weight": 1.0, "target": 0.9, "required": true }
  },
  "intent": "date_night",
  "confidence": 0.95,
  "cuisines": ["Italian"],
  "maxPrice": 3,
  "occasionType": "romantic_dinner"
}`;

export class QueryParserService {
  async parseQuery(queryText: string): Promise<ParsedQuery> {
    if (env.isTest || process.env.USE_QUERY_PARSER_STUB === 'true') {
      return this.parseQueryFallback(queryText);
    }

    try {
      const response = await openai.chat.completions.create({
        model: MODELS.FAST,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: QUERY_PARSING_PROMPT },
          { role: 'user', content: queryText },
        ],
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      return parsedQuerySchema.parse(parsed);
    } catch (error) {
      console.warn('Query parsing failed, using fallback:', error);
      return this.parseQueryFallback(queryText);
    }
  }

  parseQueryFallback(queryText: string): ParsedQuery {
    const lower = queryText.toLowerCase();
    const features: Record<string, ParsedFeature> = {};

    const pushFeature = (name: (typeof FEATURE_NAMES)[number], data: ParsedFeature) => {
      features[name] = data;
    };

    if (lower.includes('romantic') || lower.includes('date')) {
      pushFeature('romantic', { weight: 1, target: 0.9, required: true });
      pushFeature('good_for_dates', { weight: 1, target: 0.9 });
    }

    if (lower.includes('cozy') || lower.includes('intimate')) {
      pushFeature('cozy', { weight: 0.9, target: 0.85 });
    }

    if (lower.includes('quiet') || lower.includes('not loud')) {
      pushFeature('noise_level', { weight: 0.8, target: 0.2 });
    }

    if (lower.includes('casual') || lower.includes('relaxed')) {
      pushFeature('casual', { weight: 0.8, target: 0.85 });
      pushFeature('formality', { weight: 0.6, target: 0.2 });
    }

    if (lower.includes('family') || lower.includes('kids')) {
      pushFeature('family_friendly', { weight: 0.9, target: 0.9 });
    }

    const cuisines = this.extractCuisines(lower);
    const maxPrice = this.extractPrice(lower);

    const parsed: ParsedQuery = {
      features,
      intent: 'general',
      confidence: 0.5,
    };

    if (cuisines) {
      parsed.cuisines = cuisines;
    }

    if (typeof maxPrice === 'number') {
      parsed.maxPrice = maxPrice;
    }

    return parsed;
  }

  private extractCuisines(query: string): string[] | undefined {
    const cuisines: string[] = [];
    const knownCuisines = [
      'italian',
      'japanese',
      'sushi',
      'thai',
      'mexican',
      'indian',
      'french',
      'korean',
      'mediterranean',
      'vegan',
      'vegetarian',
      'bbq',
      'pizza',
      'seafood',
      'brunch',
    ];

    knownCuisines.forEach((cuisine) => {
      if (query.includes(cuisine)) {
        cuisines.push(this.capitalizeWords(cuisine.replace('-', ' ')));
      }
    });

    return cuisines.length > 0 ? cuisines : undefined;
  }

  private extractPrice(query: string): number | undefined {
    if (query.includes('cheap') || query.includes('budget') || query.includes('affordable')) {
      return 1;
    }

    if (query.includes('moderate') || query.includes('not too expensive')) {
      return 2;
    }

    if (query.includes('fine dining') || query.includes('high-end') || query.includes('expensive')) {
      return 4;
    }

    return undefined;
  }

  private capitalizeWords(value: string): string {
    return value.replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
