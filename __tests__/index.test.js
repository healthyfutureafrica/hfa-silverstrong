const fs = require('fs');
const path = require('path');

describe('index.html sanity checks', () => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  let content;

  beforeAll(() => {
    content = fs.readFileSync(indexPath, 'utf8');
  });

  test('file exists and is not empty', () => {
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
  });

  test('has a closing </html> element', () => {
    expect(content.toLowerCase()).toContain('</html>');
  });

  test('has a title tag', () => {
    expect(content.toLowerCase()).toMatch(/<title>.*<\/title>/);
  });
});
