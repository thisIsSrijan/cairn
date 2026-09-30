import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";

export interface TestDatabaseContext {
  mongod: MongoMemoryServer;
  client: MongoClient;
  db: Db;
  uri: string;
  cleanAll: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabaseContext> {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("cairn_test");

  const cleanAll = async () => {
    const collections = await db.collections();
    for (const col of collections) {
      await col.deleteMany({});
    }
  };

  const close = async () => {
    await client.close();
    await mongod.stop();
  };

  return {
    mongod,
    client,
    db,
    uri,
    cleanAll,
    close,
  };
}
