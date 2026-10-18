// Read configuration from environment variables only. Secrets are never hard-coded; in AWS they
// come from Secrets Manager / SSM Parameter Store injected into the ECS task definition.

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') throw new Error(`Missing required environment variable ${name}`);
  return value.trim();
}

function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function intEnv(name, fallback) {
  const raw = optionalEnv(name, undefined);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`Environment variable ${name} must be an integer`);
  return value;
}

function boolEnv(name, fallback) {
  const raw = optionalEnv(name, undefined);
  if (raw === undefined) return fallback;
  return raw === 'true';
}

// 256-bit keys are supplied as 64 hexadecimal characters (generate with `openssl rand -hex 32`).
function keyEnv(name) {
  const value = requireEnv(name);
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error(`${name} must be 64 hexadecimal characters (a 256-bit key)`);
  return Buffer.from(value, 'hex');
}

// PEM keys are supplied base64-encoded so they fit in a single environment variable.
function pemEnv(name) {
  return Buffer.from(requireEnv(name), 'base64').toString('utf8');
}

module.exports = { requireEnv, optionalEnv, intEnv, boolEnv, keyEnv, pemEnv };
