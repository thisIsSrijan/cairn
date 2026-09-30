import type { Db, Collection, Filter, Document } from "mongodb";
import { runSchema, type Run, type RunStatus } from "../schemas";
import {
  toDomain,
  toObjectId,
  buildCursorFilter,
  encodeCursor,
  type PaginatedResult,
  type PaginationOptions,
  type IdentifiableDoc,
} from "./types";

export type CreateRunInput = Omit<
  Run,
  | "_id"
  | "workspaceId"
  | "createdAt"
  | "counts"
  | "cursor"
  | "status"
  | "error"
  | "startedAt"
  | "finishedAt"
  | "previousRunId"
> & {
  status?: RunStatus;
  error?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  previousRunId?: string | null;
  counts?: Partial<Run["counts"]>;
  cursor?: Record<string, unknown>;
  createdAt?: Date;
};

export type UpdateRunInput = Partial<
  Omit<Run, "_id" | "workspaceId" | "createdAt" | "workflowId">
>;

export interface ListRunsOptions extends PaginationOptions {
  workflowId?: string;
  status?: RunStatus;
}

export class RunsRepo {
  private collection: Collection<Document>;

  constructor(private db: Db) {
    this.collection = db.collection("runs");
  }

  async create(
    workspaceId: string,
    input: CreateRunInput
  ): Promise<Run & { id: string }> {
    const validated = runSchema.parse({
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
  ): Promise<(Run & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const doc = await this.collection.findOne({
      _id: objId,
      workspaceId,
    });

    return doc ? toDomain<Run>(doc) : null;
  }

  async list(
    workspaceId: string,
    options?: ListRunsOptions
  ): Promise<PaginatedResult<Run & { id: string }>> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const cursorFilter = buildCursorFilter(options?.cursor);

    const query: Filter<Document> = {
      workspaceId,
      ...(options?.workflowId ? { workflowId: options.workflowId } : {}),
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
      items: docs.map((d) => toDomain<Run>(d)),
      nextCursor,
    };
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateRunInput
  ): Promise<(Run & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const result = await this.collection.findOneAndUpdate(
      { _id: objId, workspaceId },
      { $set: patch },
      { returnDocument: "after" }
    );

    return result ? toDomain<Run>(result) : null;
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: RunStatus,
    stage: string,
    extraPatch: UpdateRunInput = {}
  ): Promise<(Run & { id: string }) | null> {
    return this.update(workspaceId, id, {
      ...extraPatch,
      status,
      stage,
    });
  }
}
