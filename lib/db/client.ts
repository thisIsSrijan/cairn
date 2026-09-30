import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoClientInstance: MongoClient | undefined;
  var _mongoClientCachedUri: string | undefined;
  var _mongoMemoryServerInstance: unknown | undefined;
}

export async function getMongoClient(explicitUri?: string): Promise<MongoClient> {
  let uri = explicitUri || process.env.MONGODB_URI;

  if (!uri && process.env.DEMO_MODE === "true") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    let memoryServer = globalThis._mongoMemoryServerInstance as { getUri: () => string } | undefined;
    if (!memoryServer) {
      memoryServer = await MongoMemoryServer.create();
      globalThis._mongoMemoryServerInstance = memoryServer;
    }
    uri = memoryServer.getUri();
  }

  if (!uri) {
    uri = getEnv().MONGODB_URI;
  }
  const targetUri = uri;

  if (globalThis._mongoClientPromise && globalThis._mongoClientCachedUri === targetUri) {
    return globalThis._mongoClientPromise;
  }

  // If client is already connected to another URI, close it first
  if (globalThis._mongoClientInstance && globalThis._mongoClientCachedUri !== targetUri) {
    try {
      await globalThis._mongoClientInstance.close();
    } catch {
      // Ignore cleanup error
    }
    globalThis._mongoClientInstance = undefined;
    globalThis._mongoClientPromise = undefined;
  }

  const connectWithFallback = async (): Promise<MongoClient> => {
    // If using in-memory uri or external host, connect directly
    if (targetUri.startsWith("mongodb://127.0.0.1:") && targetUri !== "mongodb://localhost:27017") {
      const client = new MongoClient(targetUri);
      await client.connect();
      globalThis._mongoClientInstance = client;
      const { ensureIndexes } = await import("./indexes");
      await ensureIndexes(client.db(process.env.MONGODB_DB || "cairn"));
      return client;
    }

    // If explicit uri was provided or custom external host, connect directly
    if (explicitUri || (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes("localhost") && !process.env.MONGODB_URI.includes("127.0.0.1"))) {
      const client = new MongoClient(targetUri);
      await client.connect();
      globalThis._mongoClientInstance = client;
      return client;
    }

    // Try connecting to local mongodb with short timeout
    try {
      const client = new MongoClient(targetUri, { serverSelectionTimeoutMS: 1500 });
      await client.connect();
      await client.db().command({ ping: 1 });
      globalThis._mongoClientInstance = client;
      return client;
    } catch {
      // Fallback to in-memory mongodb in dev/demo mode
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      let memoryServer = globalThis._mongoMemoryServerInstance as { getUri: () => string } | undefined;
      if (!memoryServer) {
        memoryServer = await MongoMemoryServer.create();
        globalThis._mongoMemoryServerInstance = memoryServer;
      }
      uri = memoryServer.getUri();
      process.env.MONGODB_URI = uri;
      globalThis._mongoClientCachedUri = uri;
      const client = new MongoClient(uri);
      await client.connect();
      globalThis._mongoClientInstance = client;

      // Auto ensure indexes on in-memory server
      const { ensureIndexes } = await import("./indexes");
      await ensureIndexes(client.db(process.env.MONGODB_DB || "cairn"));

      return client;
    }
  };

  globalThis._mongoClientCachedUri = targetUri;
  globalThis._mongoClientPromise = connectWithFallback();
  return globalThis._mongoClientPromise;
}

export async function getDb(dbName?: string, explicitUri?: string): Promise<Db> {
  const client = await getMongoClient(explicitUri);
  const targetDb = dbName || (process.env.MONGODB_DB || "cairn");
  return client.db(targetDb);
}

export async function closeMongoClient(): Promise<void> {
  if (globalThis._mongoClientInstance) {
    try {
      await globalThis._mongoClientInstance.close();
    } catch {
      // Ignore close errors on teardown
    }
    globalThis._mongoClientInstance = undefined;
    globalThis._mongoClientPromise = undefined;
    globalThis._mongoClientCachedUri = undefined;
  }
}
