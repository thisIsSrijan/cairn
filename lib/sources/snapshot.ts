import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { normalizeWhitespace } from "./extractText";
import { getEnv } from "../env";

export interface SaveSnapshotParams {
  workspaceId: string;
  runId: string;
  url: string;
  text: string;
  sourceId?: string;
}

export interface SnapshotResult {
  publicId: string;
  url: string;
  contentHash: string;
  byteLength: number;
  storedAt: string;
}

export interface SnapshotStore {
  saveSnapshot(params: SaveSnapshotParams): Promise<SnapshotResult>;
  getSnapshot(publicId: string): Promise<string | null>;
}

/**
 * Computes sha256 hex hash of normalized text.
 */
export function computeContentHash(text: string): string {
  const normalized = normalizeWhitespace(text);
  return crypto.createHash("sha256").update(normalized, "utf-8").digest("hex");
}

/**
 * In-memory snapshot store for tests, offline mode, and demo fixtures.
 */
export class MemorySnapshotStore implements SnapshotStore {
  private store = new Map<string, { text: string; result: SnapshotResult }>();

  async saveSnapshot(params: SaveSnapshotParams): Promise<SnapshotResult> {
    const normalized = normalizeWhitespace(params.text);
    const contentHash = computeContentHash(normalized);
    const byteLength = Buffer.byteLength(normalized, "utf-8");
    const snapshotId = params.sourceId || contentHash.slice(0, 16);
    const publicId = `cairn/snapshots/${params.workspaceId}/${params.runId}/${snapshotId}`;
    const url = `memory://${publicId}`;

    const result: SnapshotResult = {
      publicId,
      url,
      contentHash,
      byteLength,
      storedAt: new Date().toISOString(),
    };

    this.store.set(publicId, { text: normalized, result });
    return result;
  }

  async getSnapshot(publicId: string): Promise<string | null> {
    const item = this.store.get(publicId);
    return item ? item.text : null;
  }

  clear(): void {
    this.store.clear();
  }
}

export interface CloudinaryStoreOptions {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Production Cloudinary snapshot store uploading raw text resources.
 */
export class CloudinarySnapshotStore implements SnapshotStore {
  private client: typeof cloudinary;

  constructor(options: CloudinaryStoreOptions = {}) {
    this.client = cloudinary;
    let cloud_name = options.cloudName;
    let api_key = options.apiKey;
    let api_secret = options.apiSecret;

    if (!cloud_name || !api_key || !api_secret) {
      try {
        const env = getEnv();
        cloud_name = cloud_name || env.CLOUDINARY_CLOUD_NAME;
        api_key = api_key || env.CLOUDINARY_API_KEY;
        api_secret = api_secret || env.CLOUDINARY_API_SECRET;
      } catch {
        // Fall back to direct process.env if env validation was not triggered
        cloud_name = cloud_name || process.env.CLOUDINARY_CLOUD_NAME;
        api_key = api_key || process.env.CLOUDINARY_API_KEY;
        api_secret = api_secret || process.env.CLOUDINARY_API_SECRET;
      }
    }

    if (cloud_name && api_key && api_secret) {
      this.client.config({
        cloud_name,
        api_key,
        api_secret,
        secure: true,
      });
    }
  }

  async saveSnapshot(params: SaveSnapshotParams): Promise<SnapshotResult> {
    const normalized = normalizeWhitespace(params.text);
    const contentHash = computeContentHash(normalized);
    const folder = `cairn/snapshots/${params.workspaceId}/${params.runId}`;
    const filename = params.sourceId || contentHash.slice(0, 16);
    const byteBuffer = Buffer.from(normalized, "utf-8");

    return new Promise<SnapshotResult>((resolve, reject) => {
      const stream = this.client.uploader.upload_stream(
        {
          resource_type: "raw",
          folder,
          public_id: filename,
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Cloudinary upload returned empty response"));
          }

          resolve({
            publicId: result.public_id,
            url: result.secure_url || result.url,
            contentHash,
            byteLength: byteBuffer.length,
            storedAt: new Date().toISOString(),
          });
        }
      );

      stream.end(byteBuffer);
    });
  }

  async getSnapshot(publicId: string): Promise<string | null> {
    try {
      const resourceUrl = this.client.url(publicId, {
        resource_type: "raw",
        secure: true,
      });

      const response = await fetch(resourceUrl);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch snapshot from Cloudinary: HTTP ${response.status}`);
      }
      return await response.text();
    } catch {
      return null;
    }
  }
}

declare global {
  var _memorySnapshotStoreInstance: MemorySnapshotStore | undefined;
}

export function getMemorySnapshotStore(): MemorySnapshotStore {
  if (!globalThis._memorySnapshotStoreInstance) {
    globalThis._memorySnapshotStoreInstance = new MemorySnapshotStore();
  }
  return globalThis._memorySnapshotStoreInstance;
}

export const defaultMemorySnapshotStore = getMemorySnapshotStore();

/**
 * Creates snapshot store according to runtime mode (MemoryStore for demo/tests, CloudinaryStore for production).
 */
export function createSnapshotStore(options?: { demoMode?: boolean }): SnapshotStore {
  const isDemo = options?.demoMode || process.env.DEMO_MODE === "true";
  const hasCloudinary = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  if (isDemo || !hasCloudinary) {
    return getMemorySnapshotStore();
  }

  return new CloudinarySnapshotStore();
}
