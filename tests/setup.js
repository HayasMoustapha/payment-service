/**
 * Jest Test Setup
 * Configures test environment and global test utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'event_planner_payments_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123456789';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.testUtils = {
  generateUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  generateEmail: () => `test-${Math.random().toString(36).substr(2, 9)}@test.com`,
  generatePhone: () => '+336' + Math.floor(Math.random() * 90000000) + 10000000,
  generateAmount: () => Math.round((Math.random() * 1000 + 1) * 100) / 100,
  generateTimestamp: () => new Date().toISOString()
};

// Mock database transactions
beforeEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  // Clean up any remaining connections
});

// Test timeout
jest.setTimeout(10000);
