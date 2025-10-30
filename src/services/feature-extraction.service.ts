import { MODELS, openai } from '../config/openai';
import {
  FEATURE_DESCRIPTIONS,
  FEATURE_NAMES,
  PROMPT_VERSION,
  type FeatureName,
} from '../constants/features';

const INPUT_COST_PER_TOKEN = 0.15 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.6 / 1_000_000;

export interface ReviewForExtraction {
  id: string;
  text: string;
  rating: number | null;
}

export interface FeatureExtractionResult {
  reviewId: string;
  features: Record<FeatureName, number | null>;
  confidence: number;
  promptVersion: string;
  modelUsed: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd: number;
}

export interface BatchExtractionResult {
  review: ReviewForExtraction;
  result?: FeatureExtractionResult;
  error?: Error;
}

const FEATURE_GUIDANCE = FEATURE_NAMES.map((name) => {
  const points = FEATURE_DESCRIPTIONS[name] ?? [];
  const bullets = points.map((line) => `    - ${line}`).join('\n');
  return `- ${name}:\n${bullets}`;
}).join('\n');

const SYSTEM_PROMPT = `You evaluate restaurant reviews and score specific experiential features.

For each review you must:
- Only score features that are explicitly mentioned or strongly implied.
- Scores are 0.0 (very negative) to 1.0 (very positive).
- Return null when the review does not mention the feature.
- Include a confidence value between 0.0 and 1.0 for your overall extraction quality.

Feature guidance:
${FEATURE_GUIDANCE}

Return STRICT JSON with the following shape:
{
  "features": {
    "romantic": 0.9,
    "noise_level": 0.2
  },
  "confidence": 0.82
}

Rules:
- Keep keys in snake_case as provided.
- Do not include features that are not in the list.
- Confidence reflects how certain you are in these scores.
- Do not include commentary or explanations.`;

export class FeatureExtractionService {
  private readonly model = MODELS.FAST;
  private readonly promptVersion = PROMPT_VERSION;
  private readonly concurrency: number;

  constructor() {
    const parsed = Number(process.env.FEATURE_EXTRACTION_CONCURRENCY ?? '3');
    this.concurrency = Number.isFinite(parsed) && parsed > 0 ? Math.min(6, Math.floor(parsed)) : 3;
  }

  async extract(review: ReviewForExtraction): Promise<FeatureExtractionResult> {
    if (!review.text || review.text.trim().length === 0) {
      throw new Error('Review text is required for feature extraction');
    }

    if (process.env.NODE_ENV === 'test' || process.env.USE_FEATURE_EXTRACTION_STUB === 'true') {
      return this.stubExtraction(review);
    }

    const response = await openai.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            review_text: review.text.slice(0, 4_000),
            rating: review.rating ?? null,
          }),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI feature extraction');
    }

    const parsed = this.parseExtraction(content);
    const usage = this.parseUsage(response);
    const costUsd = this.calculateCost(usage);

    return {
      reviewId: review.id,
      features: parsed.features,
      confidence: parsed.confidence,
      promptVersion: this.promptVersion,
      modelUsed: this.model,
      tokensUsed: usage,
      costUsd,
    };
  }

  async extractBatch(reviews: ReviewForExtraction[]): Promise<BatchExtractionResult[]> {
    const results: BatchExtractionResult[] = [];

    for (let i = 0; i < reviews.length; i += this.concurrency) {
      const batch = reviews.slice(i, i + this.concurrency);
      const settled = await Promise.allSettled(batch.map((review) => this.extract(review)));

      settled.forEach((outcome, index) => {
        const review = batch[index]!;
        if (outcome.status === 'fulfilled') {
          results.push({ review, result: outcome.value });
        } else {
          const error =
            outcome.reason instanceof Error
              ? outcome.reason
              : new Error(typeof outcome.reason === 'string' ? outcome.reason : 'Unknown extraction error');
          results.push({ review, error });
        }
      });
    }

    return results;
  }

  private parseExtraction(content: string): { features: Record<FeatureName, number | null>; confidence: number } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse extraction JSON: ${(error as Error).message}`);
    }

    const payload = parsed as { features?: Record<string, unknown>; confidence?: unknown };
    const features = this.sanitizeFeatureMap(payload.features ?? {});
    const confidence = this.sanitizeNumber(payload.confidence, 0.6);

    return { features, confidence };
  }

  private sanitizeFeatureMap(
    features: Record<string, unknown>,
  ): Record<FeatureName, number | null> {
    const sanitized: Record<FeatureName, number | null> = {} as Record<FeatureName, number | null>;

    FEATURE_NAMES.forEach((name) => {
      const value = features[name];
      sanitized[name] = this.sanitizeScore(value);
    });

    return sanitized;
  }

  private sanitizeScore(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'number') {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      return this.clampScore(numeric);
    }

    return this.clampScore(value);
  }

  private sanitizeNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return this.clampScore(value);
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return this.clampScore(numeric);
    }

    return fallback;
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(1, Math.max(0, Number(value.toFixed(3))));
  }

  private parseUsage(response: {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
    };
  }): { prompt: number; completion: number; total: number } {
    const usage = response.usage ?? {};
    const prompt = usage.prompt_tokens ?? usage.input_tokens ?? 0;
    const completion = usage.completion_tokens ?? usage.output_tokens ?? 0;
    const total = usage.total_tokens ?? prompt + completion;
    return { prompt, completion, total };
  }

  private calculateCost(usage: { prompt: number; completion: number }): number {
    const cost =
      usage.prompt * INPUT_COST_PER_TOKEN + usage.completion * OUTPUT_COST_PER_TOKEN;
    return Number(cost.toFixed(6));
  }

  private stubExtraction(review: ReviewForExtraction): FeatureExtractionResult {
    const lower = review.text.toLowerCase();
    const scores: Partial<Record<FeatureName, number | null>> = {};

    const setScore = (feature: FeatureName, value: number) => {
      scores[feature] = this.clampScore(value);
    };

    if (lower.includes('romantic') || lower.includes('date')) {
      setScore('romantic', 0.9);
      setScore('good_for_dates', 0.9);
    }

    if (lower.includes('cozy') || lower.includes('intimate')) {
      setScore('cozy', 0.85);
    }

    if (lower.includes('noisy') || lower.includes('loud')) {
      setScore('noise_level', 0.8);
    }

    if (lower.includes('quiet')) {
      setScore('noise_level', 0.2);
    }

    if (lower.includes('service') && lower.includes('slow')) {
      setScore('fast_service', 0.1);
      setScore('attentive_service', 0.3);
    }

    const confidence = Object.keys(scores).length > 0 ? 0.75 : 0.5;

    const featureMap: Record<FeatureName, number | null> = {} as Record<FeatureName, number | null>;
    FEATURE_NAMES.forEach((name) => {
      featureMap[name] = scores[name] ?? null;
    });

    return {
      reviewId: review.id,
      features: featureMap,
      confidence,
      promptVersion: this.promptVersion,
      modelUsed: 'stub',
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      costUsd: 0,
    };
  }
}
