const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function app(resolver) {
  const elements = new Map();
  const blobs = new Map();
  const revoked = [];
  let blobId = 0;
  class TestURL extends URL {
    static createObjectURL(blob) { const url = 'blob:test-' + ++blobId; blobs.set(url, blob); return url; }
    static revokeObjectURL(url) { revoked.push(url); blobs.delete(url); }
  }
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
  const context = vm.createContext({ document, URL: TestURL, Blob, console });
  vm.runInContext(script.split('// ---------- wiring ----------')[0] + `
    globalThis.api = { mppDetails, getSelectedLinks, renderSelection, hideList,
      createDesktopConfig, extractSources, renderDesktopConfig,
      select(items) { configItems = items; listState = { items, selected: new Set(items.map((_, i) => i)) }; renderSelection(); },
      tick(indexes) { listState.selected = new Set(indexes); renderSelection(); },
      setResolver(fn) { resolve = fn; }
    };
  })();`, context);
  context.api.setResolver(resolver);
  document.getElementById('config-prerelease').checked = true;
  return { api: context.api, el: (id) => document.getElementById(id), blobs, revoked };
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
  assert.equal(el('dl-jd-text').value, [
    'directhttp://https://github.com/alice/one/releases/download/v1.2.3/patches-1.2.3.mpp',
    'directhttp://https://github.com/bob/two/releases/download/v1.2.3/patches-1.2.3.mpp',
  ].join('\n'));
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
  assert.equal(el('dl-jd-text').value, '');
  assert.equal(el('dl-links').innerHTML, '');
  assert.equal(el('dl-status').textContent, '');
  assert.equal(el('dl-selected').disabled, false);
});

test('failed or invalid download URLs do not produce stale links', async () => {
  const { api, el } = app(async () => ({ bundle: { download_url: 'javascript:alert(1)' } }));
  api.select([{ source: 'https://github.com/alice/one' }]);
  await api.getSelectedLinks();
  assert.equal(el('dl-text').value, '');
  assert.equal(el('dl-jd-text').value, '');
  assert.equal(el('dl-links').innerHTML, '');
  assert.match(el('dl-status').textContent, /Found 0 links/);
});

test('Desktop config deduplicates repositories and includes the official source exactly once', () => {
  const { api } = app();
  const items = [
    { name: 'Official duplicate', source: 'https://github.com/MorpheApp/morphe-patches' },
    { name: 'Alice', source: 'https://raw.githubusercontent.com/alice/patches/main/patches-bundle.json' },
    { source: 'https://github.com/ALICE/PATCHES/releases/tag/v1' },
    { source: 'https://gitlab.com/team/subgroup/patches/-/raw/dev/patches-bundle.json' },
    { source: 'https://codeberg.org/team/patches/src/branch/main/patches-bundle.json' },
  ];
  const { config, skipped } = api.createDesktopConfig(items);
  assert.equal(config.patchSource.length, 3);
  assert.equal(new Set(config.patchSource.map((s) => s.id)).size, 3);
  assert.equal(config.patchSource[0].id, 'morphe-default');
  assert.equal(config.patchSource[0].deletable, false);
  assert.equal(config.activePatchSourceId, 'morphe-default');
  assert.equal(config.patchSource[1].name, 'Alice');
  assert.equal(config.patchSource[1].type, 'GITHUB');
  assert.equal(config.patchSource[1].url, 'https://github.com/alice/patches');
  assert.equal(config.patchSource[2].type, 'GITLAB');
  assert.equal(config.patchSource[2].url, 'https://gitlab.com/team/subgroup/patches');
  assert.equal(skipped.length, 1);
  for (const source of config.patchSource) {
    assert.equal(source.enabled, true);
    assert.equal(source.usePreRelease, true);
    assert.equal(config.sourceVersionPrefs[source.id].mode, 'FOLLOW_DEV');
  }
});

test('Desktop starter template has no personal signing details and channel choices agree', () => {
  const { api } = app();
  const items = [{ source: 'https://github.com/alice/one' }];
  const stable = api.createDesktopConfig(items, false).config;
  assert.equal(stable.keystorePath, null);
  assert.equal(stable.keystorePassword, null);
  assert.equal(stable.keystoreEntryPassword, null);
  assert.equal(stable.gitHubPat, '');
  assert.equal(Object.keys(stable.lastPatchesVersionBySource).length, 0);
  assert.equal(Object.keys(stable.preferredPatchSourceByPackage).length, 0);
  assert.doesNotMatch(JSON.stringify(stable), /Joao|UserXYZ|ARHCOS|\.p12/);
  for (const source of stable.patchSource) {
    assert.equal(source.usePreRelease, false);
    assert.equal(stable.sourceVersionPrefs[source.id].mode, 'FOLLOW_STABLE');
  }
  assert.equal(api.createDesktopConfig(items, true).config.patchSource[1].usePreRelease, true);
});

test('download uses all input sources by default, selected-only mode updates preview and blob', async () => {
  const { api, el, blobs, revoked } = app();
  api.select([{ source: 'https://github.com/alice/one' }, { source: 'https://github.com/bob/two' }]);
  api.tick([1]);
  const allUrl = el('config-download').href;
  assert.equal(JSON.parse(el('config-preview').value).patchSource.length, 3);
  assert.equal(await blobs.get(allUrl).text(), el('config-preview').value);
  el('config-selected').checked = true;
  api.renderDesktopConfig();
  const selected = JSON.parse(el('config-preview').value);
  assert.equal(selected.patchSource.length, 2);
  assert.equal(selected.patchSource[1].url, 'https://github.com/bob/two');
  assert.ok(revoked.includes(allUrl));
  api.tick([]);
  assert.equal(el('config-download').href, '');
  assert.equal(el('config-preview').value, '');
  assert.equal(blobs.size, 0);
  el('config-selected').checked = false;
  api.renderDesktopConfig();
  assert.equal(JSON.parse(el('config-preview').value).patchSource.length, 3);
  api.hideList();
  assert.equal(el('config-preview').value, '');
  assert.equal(blobs.size, 0);
});

test('unsupported input cannot produce an unrelated default-only config', () => {
  const { api, el } = app();
  api.select([{ source: 'https://codeberg.org/team/patches' }]);
  assert.equal(el('config-download').href, '');
  assert.match(el('config-status').textContent, /None of these sources/);
});

test('Desktop and Android config source lists are accepted', () => {
  const { api } = app();
  const desktop = api.extractSources({ patchSource: [{ name: 'Alice', url: 'https://github.com/alice/one' }] });
  const android = api.extractSources({ settings: { customBundles: [{ name: 'Alice', source: 'https://github.com/alice/one' }] } });
  assert.equal(desktop.items[0].source, android.items[0].source);
  assert.equal(api.extractSources([]).items.length, 0);
});
