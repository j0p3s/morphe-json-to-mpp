const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function app(resolver) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, {
        value: '', textContent: '', innerHTML: '', disabled: false,
        classList: { add() {}, remove() {}, toggle() {} },
      });
      return elements.get(id);
    },
    createElement() { throw new Error('Getting links must not create download elements'); },
  };
  const context = vm.createContext({ document, URL, Blob, console });
  vm.runInContext(script.split('// ---------- wiring ----------')[0] + `
    globalThis.api = { mppDetails, getSelectedLinks, renderSelection, hideList,
      select(items) { listState = { items, selected: new Set(items.map((_, i) => i)) }; renderSelection(); },
      setResolver(fn) { resolve = fn; }
    };
  })();`, context);
  context.api.setResolver(resolver);
  return { api: context.api, el: (id) => document.getElementById(id) };
}

function bundle(repo, version = '1.2.3') {
  return { bundle: { version, download_url: `https://github.com/${repo}/releases/download/v1.2.3/patches-1.2.3.mpp` } };
}

test('inline page script parses', () => { new vm.Script(script); });

test('JSON version and owner/repo determine safe filenames', () => {
  const { api } = app();
  assert.equal(api.mppDetails(bundle('alice/patches', '2.0.0')).filename, 'alice-patches-version-2.0.0.mpp');
  assert.equal(api.mppDetails(bundle('alice/patches', 0)).filename, 'alice-patches-version-0.mpp');
  assert.equal(api.mppDetails(bundle('alice/patches', '../bad:name')).filename, 'alice-patches-version-bad-name.mpp');
  assert.equal(api.mppDetails(bundle('alice/patches', '')).filename, 'alice-patches-version-1.2.3.mpp');
  assert.equal(api.mppDetails({ bundle: { download_url: 'https://example.com/a.mpp' } }).filename, 'a.mpp');
  const gitlab = api.mppDetails({ bundle: { version: '3', download_url: 'https://example.com/a.mpp' },
    source: { provider: 'gitlab', repo: 'team/subgroup/patches' } });
  assert.equal(gitlab.filename, 'team-subgroup-patches-version-3.mpp');
  assert.equal(gitlab.repository, 'https://gitlab.com/team/subgroup/patches');
});

test('batch only resolves metadata, preserves order, and lists partial failures', async () => {
  const { api, el } = app(async (source) => {
    if (source.endsWith('/bad')) throw new Error('Not found');
    return bundle(source.split('/').slice(-2).join('/'));
  });
  api.select([{ source: 'https://github.com/alice/one' }, { source: 'https://github.com/bob/two' },
    { source: 'https://github.com/bob/bad' }]);
  await api.getSelectedLinks();
  assert.equal(el('dl-text').value, [
    'https://github.com/alice/one/releases/download/v1.2.3/patches-1.2.3.mpp',
    'https://github.com/bob/two/releases/download/v1.2.3/patches-1.2.3.mpp',
  ].join(','));
  assert.match(el('dl-links').innerHTML, /download="alice-one-version-1.2.3.mpp"/);
  assert.match(el('dl-status').textContent, /No downloads started/);
  assert.match(el('dl-status').textContent, /Couldn't find a .mpp for: https:\/\/github.com\/bob\/bad/);
  assert.equal(el('dl-selected').disabled, false);
});

test('clearing a selection prevents old requests from displaying stale results', async () => {
  let finish;
  const { api, el } = app(() => new Promise((resolve) => { finish = resolve; }));
  api.select([{ source: 'https://github.com/alice/one' }]);
  const pending = api.getSelectedLinks();
  api.select([]);
  finish(bundle('alice/one'));
  await pending;
  assert.equal(el('dl-text').value, '');
  assert.equal(el('dl-links').innerHTML, '');
  assert.equal(el('dl-status').textContent, '');
  assert.equal(el('dl-selected').disabled, false);
});

test('failed or invalid download URLs do not produce stale links', async () => {
  const { api, el } = app(async () => ({ bundle: { download_url: 'javascript:alert(1)' } }));
  api.select([{ source: 'https://github.com/alice/one' }]);
  await api.getSelectedLinks();
  assert.equal(el('dl-text').value, '');
  assert.equal(el('dl-links').innerHTML, '');
  assert.match(el('dl-status').textContent, /Found 0 links/);
});
