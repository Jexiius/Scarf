#!/usr/bin/env tsx

import axios from 'axios';

// Get base URL from command line argument or environment variable
const baseUrl = process.argv[2] || process.env.RAILWAY_URL || process.env.TEST_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: baseUrl,
  timeout: 10000, // 10 second timeout for health checks
  validateStatus: () => true,
});

async function checkHealth() {
  try {
    const response = await api.get('/health');

    if (response.status === 200 && response.data?.status === 'ok') {
      console.log(JSON.stringify({
        status: 'healthy',
        url: baseUrl,
        timestamp: response.data.timestamp || new Date().toISOString(),
        responseTime: response.headers['x-response-time'] || 'unknown',
      }));
      process.exit(0);
    } else {
      console.error(JSON.stringify({
        status: 'unhealthy',
        url: baseUrl,
        httpStatus: response.status,
        message: 'Health check endpoint returned non-200 status',
      }));
      process.exit(1);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.error(JSON.stringify({
          status: 'unreachable',
          url: baseUrl,
          error: error.code,
          message: 'Server is not reachable',
        }));
      } else {
        console.error(JSON.stringify({
          status: 'error',
          url: baseUrl,
          error: error.message,
          message: 'Health check failed',
        }));
      }
    } else {
      console.error(JSON.stringify({
        status: 'error',
        url: baseUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Health check failed',
      }));
    }
    process.exit(1);
  }
}

// Run health check
checkHealth();

