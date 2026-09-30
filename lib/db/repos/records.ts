import type { Db, Collection, Filter, Document } from "mongodb";
import { recordSchema, type RecordDoc } from "../schemas";
import {
  toDomain,
  toObjectId,
  buildCursorFilter,
  encodeCursor,
  type PaginatedResult,
  type PaginationOptions,
  type IdentifiableDoc,
} from "./types";

export type CreateRecordInput = Omit<
  RecordDoc,
  | "_id"
  | "workspaceId"
  | "createdAt"
  | "flags"
  | "mergedFrom"
  | "rowConfidence"
  | "receipts"
> & {
  flags?: string[];
  mergedFrom?: string[];
  rowConfidence?: number;
  receipts?: RecordDoc["receipts"];
  createdAt?: Date;
};

export type UpdateRecordInput = Partial<
  Omit<RecordDoc, "_id" | "workspaceId" | "createdAt" | "runId" | "workflowId">
>;

export interface ListRecordsOptions extends PaginationOptions {
  runId?: string;
  search?: string;
  status?: string;
  minConfidence?: number;
  sort?: "confidence_desc" | "confidence_asc" | "created_desc" | "created_asc" | string;
}

export class RecordsRepo {
  private collection: Collection<Document>;

  constructor(private db: Db) {
    this.collection = db.collection("records");
  }

  async create(
    workspaceId: string,
    input: CreateRecordInput
  ): Promise<RecordDoc & { id: string }> {
    const validated = recordSchema.parse({
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
    inputs: CreateRecordInput[]
  ): Promise<(RecordDoc & { id: string })[]> {
    if (inputs.length === 0) return [];

    const validated = inputs.map((input) =>
      recordSchema.parse({
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

  async upsertByFingerprint(
    workspaceId: string,
    input: CreateRecordInput
  ): Promise<RecordDoc & { id: string }> {
    const validated = recordSchema.parse({
      ...input,
      workspaceId,
      createdAt: input.createdAt || new Date(),
    });

    const filter: Filter<Document> = {
      workspaceId,
      runId: validated.runId,
      fingerprint: validated.fingerprint,
    };

    const existing = await this.collection.findOne(filter);
    if (!existing) {
      const docToInsert = { ...validated };
      delete docToInsert._id;
      const result = await this.collection.insertOne(docToInsert as Document);
      return {
        ...validated,
        id: result.insertedId.toString(),
      };
    }

    // Merge values and receipts
    const mergedValues = {
      ...(existing.values as Record<string, unknown>),
      ...validated.values,
    };

    const mergedReceipts = {
      ...(existing.receipts as Record<string, unknown>),
      ...validated.receipts,
    };

    const mergedFrom = Array.from(
      new Set([...(existing.mergedFrom as string[] || []), ...validated.mergedFrom])
    );

    const flags = Array.from(
      new Set([...(existing.flags as string[] || []), ...validated.flags])
    );

    const updatedDoc = {
      values: mergedValues,
      receipts: mergedReceipts,
      rowConfidence: Math.max((existing.rowConfidence as number) || 0, validated.rowConfidence),
      mergedFrom,
      flags,
    };

    const result = await this.collection.findOneAndUpdate(
      filter,
      { $set: updatedDoc },
      { returnDocument: "after" }
    );

    return toDomain<RecordDoc>(result!);
  }

  async findById(
    workspaceId: string,
    id: string
  ): Promise<(RecordDoc & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const doc = await this.collection.findOne({
      _id: objId,
      workspaceId,
    });

    return doc ? toDomain<RecordDoc>(doc) : null;
  }

  async list(
    workspaceId: string,
    options?: ListRecordsOptions
  ): Promise<PaginatedResult<RecordDoc & { id: string }>> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const cursorFilter = buildCursorFilter(options?.cursor);

    const query: Filter<Document> = {
      workspaceId,
      ...(options?.runId ? { runId: options.runId } : {}),
      ...(options?.search ? { $text: { $search: options.search } } : {}),
      ...cursorFilter,
    };

    if (options?.minConfidence !== undefined) {
      query.rowConfidence = { $gte: options.minConfidence };
    }

    if (options?.status) {
      if (options.status === "verified") {
        query.flags = { $size: 0 };
        const existingConf =
          typeof query.rowConfidence === "object" && query.rowConfidence !== null
            ? (query.rowConfidence as Record<string, unknown>)
            : {};
        query.rowConfidence = { ...existingConf, $gte: 0.8 };
      } else if (options.status === "flagged" || options.status === "contradicted") {
        query["flags.0"] = { $exists: true };
      } else if (options.status === "unverified") {
        query.$or = [
          { rowConfidence: { $lt: 0.8 } },
          { flags: { $exists: true, $ne: [] } },
        ];
      }
    }

    let sortObj: Record<string, 1 | -1> = { createdAt: -1, _id: -1 };
    if (options?.sort === "confidence_desc") {
      sortObj = { rowConfidence: -1, _id: -1 };
    } else if (options?.sort === "confidence_asc") {
      sortObj = { rowConfidence: 1, _id: 1 };
    } else if (options?.sort === "created_asc") {
      sortObj = { createdAt: 1, _id: 1 };
    }

    const docs = await this.collection
      .find(query)
      .sort(sortObj)
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
      items: docs.map((d) => toDomain<RecordDoc>(d)),
      nextCursor,
    };
  }

  async count(
    workspaceId: string,
    options?: { runId?: string }
  ): Promise<number> {
    const query: Filter<Document> = {
      workspaceId,
      ...(options?.runId ? { runId: options.runId } : {}),
    };
    return this.collection.countDocuments(query);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateRecordInput
  ): Promise<(RecordDoc & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const result = await this.collection.findOneAndUpdate(
      { _id: objId, workspaceId },
      { $set: patch },
      { returnDocument: "after" }
    );

    return result ? toDomain<RecordDoc>(result) : null;
  }
}
