import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('.', import.meta.url);
const output = fileURLToPath(new URL('dist/', root));

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('index.html', root), new URL('index.html', new URL('dist/', root)));
await cp(new URL('src/', root), new URL('src/', new URL('dist/', root)), { recursive: true });
await cp(new URL('_redirects', root), new URL('_redirects', new URL('dist/', root)));

console.log('Built static site in dist/');
