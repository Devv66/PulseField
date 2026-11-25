import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const SOURCE = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://pulsefield.test';

function createWorker(initialFetch = async () => new Response('network')) {
  const listeners = new Map();
  const stores = new Map();
  let fetcher = initialFetch;
  let skipWaitingCalled = false;
  let clientsClaimed = false;

  const cacheKey = (request) => {
    const value = typeof request === 'string' ? request : request.url;
    return new URL(value, ORIGIN).href;
  };

  const createCache = (name) => {
    let entries = stores.get(name);
    if (!entries) {
      entries = new Map();
      stores.set(name, entries);
    }

    return {
      async addAll(paths) {
        for (const path of paths) {
          const response = await fetcher({ method: 'GET', url: new URL(path, ORIGIN).href });
          if (!response.ok) throw new Error('Could not precache ' + path);
          entries.set(cacheKey(path), response.clone());
        }
      },
      async match(request) {
        const response = entries.get(cacheKey(request));
        return response?.clone();
      },
      async put(request, response) {
        entries.set(cacheKey(request), response.clone());
      },
    };
  };

  const caches = {
    open: async (name) => createCache(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    async match(request) {
      for (const entries of [...stores.values()].reverse()) {
        const response = entries.get(cacheKey(request));
        if (response) return response.clone();
      }
      return undefined;
    },
  };

  const self = {
    location: { origin: ORIGIN },
    clients: { claim: async () => { clientsClaimed = true; } },
    skipWaiting: async () => { skipWaitingCalled = true; },
    addEventListener: (type, listener) => listeners.set(type, listener),
  };

  vm.runInNewContext(SOURCE, {
    self,
    caches,
    fetch: (...args) => fetcher(...args),
    URL,
    Response,
    Promise,
  }, { filename: 'public/sw.js' });

  return {
    caches,
    stores,
    setFetch: (nextFetch) => { fetcher = nextFetch; },
    async dispatch(type, event) {
      const listener = listeners.get(type);
      assert.ok(listener, 'Expected a ' + type + ' listener');
      listener(event);
      if (event.pending) await event.pending;
    },
    makeLifecycleEvent() {
      return {
        pending: null,
        waitUntil(promise) { this.pending = promise; },
      };
    },
    makeFetchEvent(request) {
      return {
        request,
        responsePromise: null,
        respondWith(promise) { this.responsePromise = promise; },
      };
    },
    flags: () => ({ skipWaitingCalled, clientsClaimed }),
  };
}

test('install precaches the app shell and activates the new worker immediately', async () => {
  const worker = createWorker(async () => new Response('shell', { status: 200 }));
  await worker.dispatch('install', worker.makeLifecycleEvent());

  assert.deepEqual(worker.flags(), { skipWaitingCalled: true, clientsClaimed: false });
  assert.deepEqual(await worker.caches.keys(), ['pulsefield-shell-v2']);

  const cachedIndex = await worker.caches.match('/index.html');
  assert.equal(await cachedIndex.text(), 'shell');
});

test('activation removes obsolete PulseField caches but preserves unrelated caches', async () => {
  const worker = createWorker();
  await (await worker.caches.open('pulsefield-shell-v1')).put('/old', new Response('old'));
  await (await worker.caches.open('another-app-cache')).put('/keep', new Response('keep'));
  await worker.dispatch('activate', worker.makeLifecycleEvent());

  const keys = await worker.caches.keys();
  assert.ok(keys.includes('another-app-cache'));
  assert.ok(!keys.includes('pulsefield-shell-v1'));
  assert.equal(worker.flags().clientsClaimed, true);
});

test('navigation is network-first and updates the offline HTML fallback', async () => {
  const worker = createWorker(async () => new Response('initial shell', { status: 200 }));
  await worker.dispatch('install', worker.makeLifecycleEvent());

  worker.setFetch(async () => new Response('fresh deployed shell', { status: 200 }));
  const event = worker.makeFetchEvent({
    method: 'GET',
    mode: 'navigate',
    url: ORIGIN + '/',
  });
  await worker.dispatch('fetch', event);

  assert.equal(await (await event.responsePromise).text(), 'fresh deployed shell');
  assert.equal(await (await worker.caches.match('/index.html')).text(), 'fresh deployed shell');

  worker.setFetch(async () => { throw new Error('offline'); });
  const offlineEvent = worker.makeFetchEvent({
    method: 'GET',
    mode: 'navigate',
    url: ORIGIN + '/',
  });
  await worker.dispatch('fetch', offlineEvent);
  assert.equal(await (await offlineEvent.responsePromise).text(), 'fresh deployed shell');
});

test('missing offline scripts fail instead of receiving HTML as a JavaScript response', async () => {
  const worker = createWorker();
  worker.setFetch(async () => { throw new Error('offline'); });

  const event = worker.makeFetchEvent({
    method: 'GET',
    mode: 'no-cors',
    url: ORIGIN + '/assets/missing-hash.js',
  });
  await worker.dispatch('fetch', event);

  const response = await event.responsePromise;
  assert.equal(response.type, 'error');
  assert.equal(response.status, 0);
});

test('non-GET requests and cross-origin requests are not intercepted', async () => {
  const worker = createWorker();

  const post = worker.makeFetchEvent({
    method: 'POST',
    mode: 'cors',
    url: ORIGIN + '/api/save',
  });
  await worker.dispatch('fetch', post);
  assert.equal(post.responsePromise, null);

  const external = worker.makeFetchEvent({
    method: 'GET',
    mode: 'cors',
    url: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
  });
  await worker.dispatch('fetch', external);
  assert.equal(external.responsePromise, null);
});
