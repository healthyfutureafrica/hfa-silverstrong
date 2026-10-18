const { scrypt, randomBytes, timingSafeEqual } = require('node:crypto');

// Passwords are hashed with scrypt (built into Node, memory-hard, no native add-ons).
// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>, so the cost can be raised later and
// old hashes upgraded on the next successful login.
const R = 8;
const P = 1;

function derive(password, salt, cost) {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, 64, { N: cost, r: R, p: P, maxmem: 256 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

async function hashPassword(password, cost) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, cost);
  return `scrypt$${cost}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, cost, , , salt, hash] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(cost));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const needsRehash = (stored, cost) => !String(stored).startsWith(`scrypt$${cost}$${R}$${P}$`);

module.exports = { hashPassword, verifyPassword, needsRehash };
