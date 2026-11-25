const { createServer } = require('node:http');
const { readFile, watch } = require('node:fs');
const { resolve, sep, extname } = require('node:path');

const lab = __dirname;
const game = resolve(lab, '../../game');
const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.png':'image/png', '.webp':'image/webp',
  '.woff2':'font/woff2', '.wav':'audio/wav'
};
let revision = 0;
for (const dir of [lab, game]) watch(dir, {recursive:true}, () => revision++);

const port = Number(process.argv[2] || 8765);
createServer((request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Cache-Control', 'no-store');
  if (route === '/revision') return response.end(String(revision));
  const inGame = route.startsWith('/game/');
  const root = inGame ? game : lab;
  let filename;
  try {
    filename = resolve(root, '.' + decodeURIComponent(inGame ? route.slice(5) : route === '/' ? '/index.html' : route));
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (!filename.startsWith(root + sep) || !types[extname(filename)]) {
    response.writeHead(404).end();
    return;
  }
  readFile(filename, (error, data) => {
    if (error) return response.writeHead(404).end();
    response.setHeader('Content-Type', types[extname(filename)]);
    if (inGame && filename === resolve(game, 'index.html')) {
      return response.end(data.toString().replace('</body>', '<script src="/fixture.js"></script></body>'));
    }
    response.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('Drop Zone Combat Lab: http://127.0.0.1:' + port));
