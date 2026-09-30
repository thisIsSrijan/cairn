import type { Db, Collection, Filter, Document } from "mongodb";
import { runEventSchema, type RunEvent, type RunEventLevel } from "../schemas";
import {
  toDomain,
  toObjectId,
  buildCursorFilter,
  encodeCursor,
  type PaginatedResult,
  type PaginationOptions,
  type IdentifiableDoc,
} from "./types";

export type CreateRunEventInput = Omit<
  RunEvent,
  "_id" | "workspaceId" | "createdAt" | "meta" | "ts"
> & {
  ts?: Date;
  meta?: Record<string, unknown>;
  createdAt?: Date;
};

export interface ListEventsOptions extends PaginationOptions {
  runId?: string;
  level?: RunEventLevel;
  after?: string;
}

export class EventsRepo {
  private collection: Collection<Document>;

  constructor(private db: Db) {
    this.collection = db.collection("events");
  }

  async create(
    workspaceId: string,
    input: CreateRunEventInput
  ): Promise<RunEvent & { id: string }> {
    const validated = runEventSchema.parse({
      ...input,
      workspaceId,
      createdAt: input.createdAt || new Date(),
    });

    const docToInsert = { ...validated };
    delete docToInsert._id;
    const result = await this.collection.insertOne(docToInsert as Document);

    return {
      ...validated,
      id: result.insertedId.toString(),
    };
  }

  async list(
    workspaceId: string,
    options?: ListEventsOptions
  ): Promise<PaginatedResult<RunEvent & { id: string }>> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const cursorFilter = buildCursorFilter(options?.cursor);

    const query: Filter<Document> = {
      workspaceId,
      ...(options?.runId ? { runId: options.runId } : {}),
      ...(options?.level ? { level: options.level } : {}),
      ...cursorFilter,
    };

    if (options?.after) {
      const objId = toObjectId(options.after);
      if (objId) {
        query._id = { $gt: objId };
      }
    }

    const sortOrder = options?.after ? ({ createdAt: 1, _id: 1 } as const) : ({ createdAt: -1, _id: -1 } as const);

    const docs = await this.collection
      .find(query)
      .sort(sortOrder)
      .limit(limit + 1)
      .toArray();

    let nextCursor: string | null = null;
    if (docs.length > limit) {
      docs.pop();
      const lastDoc = docs[docs.length - 1];
      if (lastDoc) {
        nextCursor = encodeCursor(lastDoc as unknown as IdentifiableDoc);
      }
    }

    return {
      items: docs.map((d) => toDomain<RunEvent>(d)),
      nextCursor,
    };
  }
}
