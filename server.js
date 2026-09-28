import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 5173);
const files = new Map([
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/src/main.js', ['src/main.js', 'text/javascript; charset=utf-8']],
  ['/src/channel.js', ['src/channel.js', 'text/javascript; charset=utf-8']],
  ['/src/irc.js', ['src/irc.js', 'text/javascript; charset=utf-8']],
  ['/src/style.css', ['src/style.css', 'text/css; charset=utf-8']],
]);

createServer(async (request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url, 'http://localhost').pathname;
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  const file = files.get(pathname) ?? (pathname === '/' || /^\/[a-zA-Z0-9_]{1,25}\/?$/.test(pathname)
    ? files.get('/index.html')
    : null);

  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  try {
    const [relativePath, contentType] = file;
    const body = await readFile(fileURLToPath(new URL(relativePath, import.meta.url)));
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  } catch (error) {
    console.error(error);
    response.writeHead(500);
    response.end();
  }
}).listen(port, 'localhost', () => {
  console.log(`Overlay: http://localhost:${port}/`);
});
