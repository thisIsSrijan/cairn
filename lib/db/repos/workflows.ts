import type { Db, Collection, Filter, Document } from "mongodb";
import { workflowSchema, type Workflow, type WorkflowStatus } from "../schemas";
import {
  toDomain,
  toObjectId,
  buildCursorFilter,
  encodeCursor,
  type PaginatedResult,
  type PaginationOptions,
  type IdentifiableDoc,
} from "./types";

export type CreateWorkflowInput = Omit<
  Workflow,
  "_id" | "workspaceId" | "createdAt" | "updatedAt" | "status" | "latestRunId" | "title"
> & {
  title?: string;
  status?: WorkflowStatus;
  latestRunId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateWorkflowInput = Partial<
  Omit<Workflow, "_id" | "workspaceId" | "createdAt">
>;

export class WorkflowsRepo {
  private collection: Collection<Document>;

  constructor(private db: Db) {
    this.collection = db.collection("workflows");
  }

  async create(
    workspaceId: string,
    input: CreateWorkflowInput
  ): Promise<Workflow & { id: string }> {
    const validated = workflowSchema.parse({
      ...input,
      title: input.title || input.blueprint.intent || input.prompt || "Untitled Ledger",
      workspaceId,
      createdAt: input.createdAt || new Date(),
      updatedAt: input.updatedAt || new Date(),
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
  ): Promise<(Workflow & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const doc = await this.collection.findOne({
      _id: objId,
      workspaceId,
    });

    return doc ? toDomain<Workflow>(doc) : null;
  }

  async list(
    workspaceId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Workflow & { id: string }>> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const cursorFilter = buildCursorFilter(options?.cursor);

    const query: Filter<Document> = {
      workspaceId,
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
      items: docs.map((d) => toDomain<Workflow>(d)),
      nextCursor,
    };
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateWorkflowInput
  ): Promise<(Workflow & { id: string }) | null> {
    const objId = toObjectId(id);
    if (!objId) return null;

    const updateDoc = {
      ...patch,
      updatedAt: new Date(),
    };

    const result = await this.collection.findOneAndUpdate(
      { _id: objId, workspaceId },
      { $set: updateDoc },
      { returnDocument: "after" }
    );

    return result ? toDomain<Workflow>(result) : null;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const objId = toObjectId(id);
    if (!objId) return false;

    const result = await this.collection.deleteOne({
      _id: objId,
      workspaceId,
    });

    return result.deletedCount > 0;
  }
}
