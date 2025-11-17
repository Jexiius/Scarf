#!/usr/bin/env tsx

import axios, { AxiosError } from 'axios';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

// Get base URL from command line argument or environment variable
const baseUrl = process.argv[2] || process.env.RAILWAY_URL || process.env.TEST_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: baseUrl,
  timeout: 30000,
  validateStatus: () => true,
});

let authToken: string | null = null;
let userId: string | null = null;
const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';

async function testHealthCheck() {
  logInfo('Testing health check endpoint...');
  try {
    const response = await api.get('/health');
    if (response.status === 200 && response.data.status === 'ok') {
      logSuccess(`Health check passed (${response.status})`);
      return true;
    } else {
      logError(`Health check failed: Expected 200, got ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testRegistration() {
  logInfo('Testing user registration...');
  try {
    const response = await api.post('/api/v1/auth/register', {
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    });

    if (response.status === 201 && response.data.token) {
      authToken = response.data.token;
      userId = response.data.user.id;
      logSuccess(`Registration successful (${response.status})`);
      logInfo(`  Email: ${testEmail}`);
      logInfo(`  User ID: ${userId}`);
      return true;
    } else {
      logError(`Registration failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Registration failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    } else {
      logError(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return false;
  }
}

async function testLogin() {
  logInfo('Testing user login...');
  try {
    const response = await api.post('/api/v1/auth/login', {
      email: testEmail,
      password: testPassword,
    });

    if (response.status === 200 && response.data.token) {
      authToken = response.data.token;
      logSuccess(`Login successful (${response.status})`);
      return true;
    } else {
      logError(`Login failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Login failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    } else {
      logError(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return false;
  }
}

async function testProtectedRoute() {
  logInfo('Testing protected route (GET /api/v1/users/me)...');
  if (!authToken) {
    logError('No auth token available');
    return false;
  }

  try {
    const response = await api.get('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.status === 200 && response.data.user) {
      logSuccess(`Protected route access successful (${response.status})`);
      logInfo(`  User: ${response.data.user.email}`);
      logInfo(`  Subscription: ${response.data.user.subscriptionTier}`);
      return true;
    } else {
      logError(`Protected route failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Protected route failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    } else {
      logError(`Protected route failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return false;
  }
}

async function testSearch() {
  logInfo('Testing search endpoint...');
  try {
    const response = await api.post('/api/v1/search', {
      query: 'Italian restaurant',
      latitude: 40.7128,
      longitude: -74.0060,
      radiusMiles: 10,
      limit: 5,
    });

    if (response.status === 200 && Array.isArray(response.data.results)) {
      logSuccess(`Search successful (${response.status})`);
      logInfo(`  Results: ${response.data.results.length}`);
      logInfo(`  Query understood: ${JSON.stringify(response.data.queryUnderstood)}`);
      return true;
    } else {
      logError(`Search failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Search failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    } else {
      logError(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return false;
  }
}

async function testUnauthorizedAccess() {
  logInfo('Testing unauthorized access protection...');
  try {
    const response = await api.get('/api/v1/users/me');
    if (response.status === 401) {
      logSuccess(`Unauthorized access correctly rejected (${response.status})`);
      return true;
    } else {
      logError(`Security issue: Expected 401, got ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Unauthorized access test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function runAllTests() {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Testing Railway Server: ${baseUrl}`, 'blue');
  log(`${'='.repeat(60)}\n`, 'blue');

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run tests in sequence
  results.push({ name: 'Health Check', passed: await testHealthCheck() });
  results.push({ name: 'User Registration', passed: await testRegistration() });
  results.push({ name: 'User Login', passed: await testLogin() });
  results.push({ name: 'Protected Route', passed: await testProtectedRoute() });
  results.push({ name: 'Search Endpoint', passed: await testSearch() });
  results.push({ name: 'Unauthorized Access', passed: await testUnauthorizedAccess() });

  // Summary
  log(`\n${'='.repeat(60)}`, 'blue');
  log('Test Summary', 'blue');
  log(`${'='.repeat(60)}`, 'blue');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    if (result.passed) {
      logSuccess(`${result.name}: PASSED`);
    } else {
      logError(`${result.name}: FAILED`);
    }
  });

  log(`\n${'='.repeat(60)}`, 'blue');
  if (passed === total) {
    log(`All tests passed! (${passed}/${total})`, 'green');
    process.exit(0);
  } else {
    log(`Some tests failed (${passed}/${total} passed)`, 'red');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  logError(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});

