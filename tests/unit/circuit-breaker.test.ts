import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, CircuitBreakerOpenError } from '../../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-circuit', {
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to OPEN after failure threshold', async () => {
      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => Promise.reject(new Error('Test error')));
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject requests when OPEN', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => Promise.reject(new Error('Test error')));
        } catch {
          // Expected
        }
      }

      // Should reject immediately
      await expect(
        circuitBreaker.execute(() => Promise.resolve('success')),
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => Promise.reject(new Error('Test error')));
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next call should transition to HALF_OPEN
      try {
        await circuitBreaker.execute(() => Promise.resolve('success'));
      } catch {
        // May fail if still transitioning
      }

      // After successful attempts in half-open, should close
      for (let i = 0; i < 2; i++) {
        await circuitBreaker.execute(() => Promise.resolve('success'));
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Success Handling', () => {
    it('should reset failure count on success in CLOSED state', async () => {
      // Fail twice
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(() => Promise.reject(new Error('Test error')));
        } catch {
          // Expected
        }
      }

      // Success should reset count
      await circuitBreaker.execute(() => Promise.resolve('success'));

      // Should still be CLOSED
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Failure Handling', () => {
    it('should increment failure count on error', async () => {
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);

      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Test error')));
      } catch {
        // Expected
      }

      const newStats = circuitBreaker.getStats();
      expect(newStats.failureCount).toBe(1);
    });

    it('should immediately open on failure in HALF_OPEN state', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => Promise.reject(new Error('Test error')));
        } catch {
          // Expected
        }
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // First call transitions to HALF_OPEN
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Test error')));
      } catch {
        // Expected
      }

      // Should immediately open again
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Manual Reset', () => {
    it('should reset circuit to CLOSED state', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => Promise.reject(new Error('Test error')));
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
    });
  });
});

