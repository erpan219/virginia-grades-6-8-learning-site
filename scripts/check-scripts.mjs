import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
let checked = 0;
const external = new Set();
for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  let code = body;
  const inline = attributes.match(/src="data:application\/javascript;base64,([^"]+)"/);
  if (inline) code = Buffer.from(inline[1], 'base64').toString('utf8');
  else if (/src=/.test(attributes)) {
    const src = attributes.match(/src=["']([^"']+)["']/)?.[1];
    if (!src || /^(?:https?:|\/\/|data:)/.test(src)) continue;
    const url = new URL(src, new URL('../index.html', import.meta.url));
    if (external.has(url.href)) continue;
    external.add(url.href);
    code = fs.readFileSync(url, 'utf8');
  }
  if (/type="text\/plain"/.test(attributes) && !/data-va-lab="js:/.test(attributes)) continue;
  new vm.Script(code, {filename: `inline-script-${checked}.js`});
  checked++;
}
console.log(`Parsed ${checked} executable and lazy-lab scripts, including ${external.size} local external scripts.`);
