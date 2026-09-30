import { ObjectId, type Filter, type WithId, type Document } from "mongodb";

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorPayload {
  c: string;
  id: string;
}

export interface IdentifiableDoc {
  createdAt: Date | string;
  _id: { toString(): string };
}

export function encodeCursor(doc: IdentifiableDoc): string {
  const dateStr =
    doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString();
  const idStr = doc._id.toString();
  const payload: CursorPayload = { c: dateStr, id: idStr };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.c === "string" && typeof parsed.id === "string") {
      return parsed;
    }
  } catch {
    // Malformed cursor
  }
  return null;
}

export function buildCursorFilter(cursor?: string): Filter<Document> {
  if (!cursor) return {};
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};

  const cursorDate = new Date(decoded.c);
  const cursorId = toObjectId(decoded.id);

  if (cursorId) {
    return {
      $or: [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: cursorId } },
      ],
    };
  }

  return { createdAt: { $lt: cursorDate } };
}

export function toObjectId(id: string): ObjectId | null {
  try {
    if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
      return new ObjectId(id);
    }
  } catch {
    return null;
  }
  return null;
}

export function toDomain<T>(doc: WithId<Document>): T & { id: string } {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: _id.toString(),
  } as unknown as T & { id: string };
}
