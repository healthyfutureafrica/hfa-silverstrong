const { Client } = require('pg');

// Test helper: creates a fresh, empty database on the PostgreSQL server in TEST_DATABASE_URL
// (e.g. postgres://postgres:test@localhost:55432/postgres) and returns its connection URL.
async function createTestDatabase(name) {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error('Set TEST_DATABASE_URL to a PostgreSQL server to run database tests (see services/README.md)');
  const admin = new Client({ connectionString: base });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
}

async function dropTestDatabase(name) {
  const admin = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.connect();
  try { await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`); } finally { await admin.end(); }
}

// Test helper: an RS256 key pair plus a function that signs access tokens for any role, so a
// service can be tested without running the Auth Service.
function createTestAuth() {
  const { generateKeyPairSync, randomUUID } = require('node:crypto');
  const jwt = require('jsonwebtoken');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const tokenFor = ({ id = randomUUID(), role, credentialHash } = {}) => ({
    id,
    token: jwt.sign({ typ: 'access', role, sid: randomUUID(), ...(credentialHash ? { chash: credentialHash } : {}) }, privateKey, { algorithm: 'RS256', issuer: 'hfa-auth', audience: 'hfa-api', subject: id, expiresIn: 600 })
  });
  return { publicKey, publicKeyB64: Buffer.from(publicKey).toString('base64'), tokenFor };
}

module.exports = { createTestDatabase, dropTestDatabase, createTestAuth };
