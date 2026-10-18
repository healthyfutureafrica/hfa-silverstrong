// Runs every service's tests. Database tests need TEST_DATABASE_URL pointing at a PostgreSQL
// server (see README: `npm run db:test:start`); each service creates and drops its own database.
module.exports = {
  testEnvironment: 'node',
  roots: [
    '<rootDir>/shared/test',
    '<rootDir>/auth-service/test',
    '<rootDir>/user-service/test',
    '<rootDir>/pharmacy-service/test',
    '<rootDir>/payment-service/test',
    '<rootDir>/admin-service/test'
  ],
  testTimeout: 30000
};
