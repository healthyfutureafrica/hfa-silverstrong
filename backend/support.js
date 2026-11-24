// Help & support: every signed-in person (patients without a paid plan included — billing problems are a common
// reason to ask) can open a ticket; administrators answer and resolve. Replies notify the other side with generic
// text. Support is not for emergencies: the screens point to SOS and the emergency number instead.
const { randomUUID } = require('node:crypto');
const { z } = require('zod');

const envelope = data => ({ success: true, data, message: 'OK', timestamp: new Date().toISOString() });
const free = (max, min) => z.string().trim().min(min).max(max).regex(/^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/, 'remove < and > characters');
const CATEGORIES = ['account', 'billing', 'technical', 'care', 'privacy', 'other'];
const MAX_OPEN = 10;

function installSupportRoutes(app, store, authenticated, admin) {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL,
      status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES support_tickets(id), author_id TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS support_by_user ON support_tickets(user_id, status);`);
  const notify = (userId, message) => store.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?)').run(randomUUID(), userId, message, 'Account', new Date().toISOString());
  const admins = () => store.db.prepare("SELECT id FROM users WHERE role='admin' AND status='active'").all().map(row => row.id);
  const ticket = id => store.db.prepare('SELECT * FROM support_tickets WHERE id=?').get(id);
  const view = (row, actor) => ({
    id: row.id, subject: row.subject, category: row.category, priority: row.priority, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    ...(actor.role === 'admin' ? { user: (({ id, name, role, hfaId, phone }) => ({ id, name, role, hfaId, phone }))(store.user(row.user_id) || {}) } : {}),
    messages: store.db.prepare('SELECT author_id, text, created_at FROM support_messages WHERE ticket_id=? ORDER BY created_at').all(row.id)
      .map(message => ({ text: message.text, at: message.created_at, fromSupport: message.author_id !== row.user_id, author: message.author_id === row.user_id ? null : 'HFA support' }))
  });
  const mine = (request, row) => row && (row.user_id === request.user.id || request.user.role === 'admin');

  app.get('/api/v1/support', authenticated, (request, response) => {
    const rows = request.user.role === 'admin'
      ? store.db.prepare("SELECT * FROM support_tickets ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'answered' THEN 1 ELSE 2 END, updated_at DESC LIMIT 200").all()
      : store.db.prepare('SELECT * FROM support_tickets WHERE user_id=? ORDER BY updated_at DESC').all(request.user.id);
    response.json(envelope({ tickets: rows.map(row => view(row, request.user)) }));
  });
  app.post('/api/v1/support', authenticated, (request, response) => {
    if (request.impersonator) return response.status(403).json({ error: 'Open support requests from your own account' });
    const input = z.object({ subject: free(120, 4), category: z.enum(CATEGORIES), priority: z.enum(['normal', 'high']), description: free(4000, 10) }).strict().parse(request.body);
    const open = store.db.prepare("SELECT COUNT(*) AS n FROM support_tickets WHERE user_id=? AND status!='resolved'").get(request.user.id).n;
    if (open >= MAX_OPEN) return response.status(429).json({ error: 'You already have 10 open requests; wait for an answer or add to an existing one' });
    const id = `tk-${randomUUID()}`, now = new Date().toISOString();
    store.db.prepare("INSERT INTO support_tickets VALUES (?,?,?,?,?,'open',?,?)").run(id, request.user.id, input.subject, input.category, input.priority, now, now);
    store.db.prepare('INSERT INTO support_messages VALUES (?,?,?,?,?)').run(randomUUID(), id, request.user.id, input.description, now);
    admins().forEach(adminId => notify(adminId, `HFA SilverStrong: New ${input.priority === 'high' ? 'high-priority ' : ''}support request. Sign in to answer it.`));
    store.audit(request.user.id, 'SUPPORT_TICKET_OPENED', { targetId: request.user.id, details: { ticketId: id, category: input.category }, ip: request.ip });
    response.status(201).json(envelope({ ticket: view(ticket(id), request.user) }));
  });
  app.post('/api/v1/support/:id/reply', authenticated, (request, response) => {
    const row = ticket(request.params.id);
    if (!mine(request, row) || request.impersonator) return response.sendStatus(404);
    if (row.status === 'resolved') return response.status(409).json({ error: 'This request is resolved; open a new one' });
    const input = z.object({ text: free(4000, 2) }).strict().parse(request.body), now = new Date().toISOString();
    const fromSupport = request.user.role === 'admin' && row.user_id !== request.user.id;
    store.db.prepare('INSERT INTO support_messages VALUES (?,?,?,?,?)').run(randomUUID(), row.id, request.user.id, input.text, now);
    store.db.prepare('UPDATE support_tickets SET status=?, updated_at=? WHERE id=?').run(fromSupport ? 'answered' : 'open', now, row.id);
    if (fromSupport) notify(row.user_id, 'HFA SilverStrong: HFA support answered your request. Sign in to read it.');
    else admins().forEach(adminId => notify(adminId, 'HFA SilverStrong: A support request has a new message. Sign in to answer it.'));
    store.audit(request.user.id, 'SUPPORT_TICKET_REPLY', { targetId: row.user_id, details: { ticketId: row.id }, ip: request.ip });
    response.json(envelope({ ticket: view(ticket(row.id), request.user) }));
  });
  app.post('/api/v1/support/:id/resolve', authenticated, admin, (request, response) => {
    const row = ticket(request.params.id);
    if (!row) return response.sendStatus(404);
    store.db.prepare("UPDATE support_tickets SET status='resolved', updated_at=? WHERE id=?").run(new Date().toISOString(), row.id);
    notify(row.user_id, 'HFA SilverStrong: Your support request was resolved. Sign in to see the answer.');
    store.audit(request.user.id, 'SUPPORT_TICKET_RESOLVED', { targetId: row.user_id, details: { ticketId: row.id }, ip: request.ip });
    response.json(envelope({ ticket: view(ticket(row.id), request.user) }));
  });
}

module.exports = { installSupportRoutes, CATEGORIES };
