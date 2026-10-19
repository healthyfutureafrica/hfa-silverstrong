// Copies the static demo (the files GitHub Pages and Cloudflare serve) into dist/.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const files = ['index.html', 'offline.js', 'offline-uploads.js', 'offline-session.js', 'pharmacist.js', 'hfa-numbering.js', 'i18n.js', 'hfa-ui.js', 'patient-registration.js', 'portal-access.js', 'security.js', 'service-worker.js'];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(dist, file));
fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
console.log(`Static demo written to ${path.relative(root, dist)}/`);
