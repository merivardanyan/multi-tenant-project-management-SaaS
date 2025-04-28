const redis = require('redis');

let client = null;

// fallback when redis isn't running locally
const memStore = new Map();
const memClient = {
  get: async (k) => memStore.get(k) ?? null,
  set: async (k, v, opts) => {
    memStore.set(k, v);
    if (opts?.EX) setTimeout(() => memStore.delete(k), opts.EX * 1000);
  },
  del: async (k) => memStore.delete(k),
  isReady: true,
};

async function getRedis() {
  if (client?.isReady) return client;

  try {
    client = redis.createClient({ url: process.env.REDIS_URL });
    client.on('error', () => {});
    await client.connect();
    return client;
  } catch {
    return memClient;
  }
}

module.exports = { getRedis };
