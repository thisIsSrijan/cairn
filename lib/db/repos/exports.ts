import type { Db, Collection, Filter, Document } from "mongodb";
import { exportFileSchema, type ExportFile } from "../schemas";
import {
  toDomain,
  toObjectId,
  buildCursorFilter,
  encodeCursor,
  type PaginatedResult,
  type PaginationOptions,
  type IdentifiableDoc,
} from "./types";

export type CreateExportFileInput = Omit<
  ExportFile,
  "_id" | "workspaceId" | "createdAt"
> & {
  createdAt?: Date;
};

export interface ListExportsOptions extends PaginationOptions {
  runId?: string;
}

export class ExportsRepo {
  private collection: Collection<Document>;

  constructor(private db: Db) {
    this.collection = db.collection("exports");
  }

  async create(
    workspaceId: string,
    input: CreateExportFileInput
  ): Promise<ExportFile & { id: string }> {
    const validated = exportFileSchema.parse({
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

  async findById(
    workspaceId: string,
    id: string
  ): Promise<(ExportFile & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const doc = await this.collection.findOne({
      _id: objId,
      workspaceId,
    });

    return doc ? toDomain<ExportFile>(doc) : null;
  }

  async list(
    workspaceId: string,
    options?: ListExportsOptions
  ): Promise<PaginatedResult<ExportFile & { id: string }>> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const cursorFilter = buildCursorFilter(options?.cursor);

    const query: Filter<Document> = {
      workspaceId,
      ...(options?.runId ? { runId: options.runId } : {}),
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
      items: docs.map((d) => toDomain<ExportFile>(d)),
      nextCursor,
    };
  }
}
