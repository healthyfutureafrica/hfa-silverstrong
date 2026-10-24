// Anonymous Free Health Hub statistics: which topics people open, how often they search and use SLY, by day and
// language. No account, cookie, IP address or search text is stored, only counts, so administrators can see what
// the public needs without anyone being identifiable.
const { z } = require('zod');
const { rateLimit } = require('express-rate-limit');

function installHubStats(app, store, authenticated, admin) {
  store.db.exec('CREATE TABLE IF NOT EXISTS hub_stats (day TEXT NOT NULL, type TEXT NOT NULL, topic TEXT NOT NULL, lang TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day, type, topic, lang))');
  const limit = rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });

  app.post('/api/v1/hub/events', limit, (request, response) => {
    const input = z.object({ type: z.enum(['view', 'search', 'cta', 'assistant']), topic: z.string().regex(/^[a-z0-9_-]{0,60}$/).default(''), lang: z.enum(['en', 'fr']).default('en') }).strict().parse(request.body);
    store.db.prepare('INSERT INTO hub_stats VALUES (?,?,?,?,1) ON CONFLICT(day,type,topic,lang) DO UPDATE SET count=count+1').run(new Date().toISOString().slice(0, 10), input.type, input.topic, input.lang);
    response.sendStatus(204);
  });

  app.get('/api/v1/admin/hub-stats', authenticated, admin, (request, response) => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const rows = store.db.prepare('SELECT type, topic, lang, SUM(count) AS count FROM hub_stats WHERE day>=? GROUP BY type, topic, lang ORDER BY count DESC').all(since);
    const daily = store.db.prepare('SELECT day, SUM(count) AS count FROM hub_stats WHERE day>=? GROUP BY day ORDER BY day').all(since);
    response.json({ success: true, data: { rows, daily, since }, message: 'OK', timestamp: new Date().toISOString() });
  });
}

module.exports = { installHubStats };
