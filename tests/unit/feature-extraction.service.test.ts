import { describe, expect, it } from 'vitest';
import { FeatureExtractionService } from '../../src/services/feature-extraction.service';

describe('FeatureExtractionService (test stub)', () => {
  const service = new FeatureExtractionService();

  it('produces feature scores for romantic and cozy cues', async () => {
    const reviewText =
      'We had the most romantic evening here. The space felt incredibly cozy and intimate.';

    const result = await service.extract({
      id: 'review-1',
      text: reviewText,
      rating: 5,
    });

    expect(result.modelUsed).toBe('stub');
    expect(result.features.romantic).toBeGreaterThan(0.8);
    expect(result.features.cozy).toBeGreaterThan(0.8);
    expect(result.costUsd).toBe(0);
  });

  it('handles batch extraction and returns structured errors', async () => {
    const reviews = [
      { id: 'review-2', text: 'Service was painfully slow tonight.', rating: 2 },
      { id: 'review-3', text: '', rating: 4 },
    ];

    const results = await service.extractBatch(reviews);

    expect(results).toHaveLength(2);
    const success = results.find((item) => item.review.id === 'review-2');
    const failure = results.find((item) => item.review.id === 'review-3');

    expect(success?.result?.features.fast_service).toBeLessThan(0.5);
    expect(failure?.error).toBeInstanceOf(Error);
  });
});
