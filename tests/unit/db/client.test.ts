import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDatabase, type TestDatabaseContext } from "@/tests/fixtures/test-db";
import { getMongoClient, getDb, closeMongoClient } from "@/lib/db/client";

describe("MongoDB Client connection", () => {
  let testDb: TestDatabaseContext;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });

  afterAll(async () => {
    await closeMongoClient();
    await testDb.close();
  });

  it("connects to MongoDB and caches client promise across invocations", async () => {
    const client1 = await getMongoClient(testDb.uri);
    const client2 = await getMongoClient(testDb.uri);

    expect(client1 === client2).toBe(true);
    expect(Boolean(client1)).toBe(true);

    const ping = await client1.db("admin").command({ ping: 1 });
    expect(ping.ok).toBe(1);
  });

  it("returns database instance and reuses existing client", async () => {
    const db = await getDb("cairn_custom", testDb.uri);
    expect(db.databaseName).toBe("cairn_custom");

    const ping = await db.command({ ping: 1 });
    expect(ping.ok).toBe(1);
  });

  it("closes connection and clears global cache cleanly", async () => {
    await closeMongoClient();
    const freshClient = await getMongoClient(testDb.uri);
    expect(freshClient).toBeDefined();
    await closeMongoClient();
  });

  it("handles URI switching by closing previous client", async () => {
    await getMongoClient(testDb.uri);
    const client2 = await getMongoClient(testDb.uri + "?retryWrites=true");
    expect(Boolean(client2)).toBe(true);
    await closeMongoClient();
  });

  it("falls back to environment variable when explicit URI is omitted", async () => {
    const originalUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = testDb.uri;

    const defaultClient = await getMongoClient();
    expect(Boolean(defaultClient)).toBe(true);

    const defaultDb = await getDb();
    expect(defaultDb.databaseName).toBe("cairn");

    process.env.MONGODB_URI = originalUri;
    await closeMongoClient();
  });
});
