import type { Db, Collection, Filter, Document } from "mongodb";
import { sourceSchema, type Source, type SourceStatus } from "../schemas";
import {
  toDomain,
  toObjectId,
  buildCursorFilter,
  encodeCursor,
  type PaginatedResult,
  type PaginationOptions,
  type IdentifiableDoc,
} from "./types";

export type CreateSourceInput = Omit<
  Source,
  | "_id"
  | "workspaceId"
  | "createdAt"
  | "status"
  | "title"
  | "httpStatus"
  | "fetchedAt"
  | "contentHash"
  | "textLength"
  | "snapshot"
> & {
  status?: SourceStatus;
  title?: string | null;
  httpStatus?: number | null;
  fetchedAt?: Date | null;
  contentHash?: string | null;
  textLength?: number | null;
  snapshot?: Source["snapshot"];
  createdAt?: Date;
};

export type UpdateSourceInput = Partial<
  Omit<Source, "_id" | "workspaceId" | "createdAt" | "runId">
>;

export interface ListSourcesOptions extends PaginationOptions {
  runId?: string;
  status?: SourceStatus;
}

export class SourcesRepo {
  private collection: Collection<Document>;

  constructor(private db: Db) {
    this.collection = db.collection("sources");
  }

  async create(
    workspaceId: string,
    input: CreateSourceInput
  ): Promise<Source & { id: string }> {
    const validated = sourceSchema.parse({
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

  async createMany(
    workspaceId: string,
    inputs: CreateSourceInput[]
  ): Promise<(Source & { id: string })[]> {
    if (inputs.length === 0) return [];

    const validated = inputs.map((input) =>
      sourceSchema.parse({
        ...input,
        workspaceId,
        createdAt: input.createdAt || new Date(),
      })
    );

    const docsToInsert = validated.map((item) => {
      const doc = { ...item };
      delete doc._id;
      return doc;
    });
    const result = await this.collection.insertMany(docsToInsert as Document[]);

    return validated.map((item, idx) => ({
      ...item,
      id: result.insertedIds[idx]?.toString() ?? "",
    }));
  }

  async findById(
    workspaceId: string,
    id: string
  ): Promise<(Source & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const doc = await this.collection.findOne({
      _id: objId,
      workspaceId,
    });

    return doc ? toDomain<Source>(doc) : null;
  }

  async list(
    workspaceId: string,
    options?: ListSourcesOptions
  ): Promise<PaginatedResult<Source & { id: string }>> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const cursorFilter = buildCursorFilter(options?.cursor);

    const query: Filter<Document> = {
      workspaceId,
      ...(options?.runId ? { runId: options.runId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...cursorFilter,
    };

    const docs = await this.collection
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
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
      items: docs.map((d) => toDomain<Source>(d)),
      nextCursor,
    };
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSourceInput
  ): Promise<(Source & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const result = await this.collection.findOneAndUpdate(
      { _id: objId, workspaceId },
      { $set: patch },
      { returnDocument: "after" }
    );

    return result ? toDomain<Source>(result) : null;
  }
}
