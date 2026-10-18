const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('./errors');

const ROLES = ['patient', 'doctor', 'pharmacist', 'lab', 'chw', 'admin'];

// Verifies the short-lived access token issued by the Auth Service. Services only hold the
// Auth Service PUBLIC key, so a compromised service cannot create tokens.
function createAuthenticator({ publicKey, issuer, audience }) {
  return function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return next(unauthorized());
    try {
      const claims = jwt.verify(token, publicKey, { algorithms: ['RS256'], issuer, audience });
      if (claims.typ !== 'access' || !ROLES.includes(claims.role)) throw new Error('wrong token type');
      req.user = { id: claims.sub, role: claims.role, credentialHash: claims.chash || null, sessionId: claims.sid };
      return next();
    } catch (error) {
      return next(unauthorized('Invalid or expired access token'));
    }
  };
}

const requireRole = (...roles) => (req, res, next) =>
  req.user && roles.includes(req.user.role) ? next() : next(forbidden());

module.exports = { ROLES, createAuthenticator, requireRole };
