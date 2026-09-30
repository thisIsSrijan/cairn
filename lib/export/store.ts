import { v2 as cloudinary } from "cloudinary";
import type { ExportStore, SaveExportParams, ExportResult } from "./types";
import { getEnv } from "@/lib/env";

export class MemoryExportStore implements ExportStore {
  private store = new Map<string, { buffer: Buffer; result: ExportResult }>();

  async saveExport(params: SaveExportParams): Promise<ExportResult> {
    const publicId = `cairn/exports/${params.workspaceId}/${params.runId}/${params.filename}`;
    const url = `memory://${publicId}`;

    const result: ExportResult = {
      url,
      publicId,
      format: params.format,
      rows: params.rows,
    };

    this.store.set(url, { buffer: params.buffer, result });
    this.store.set(publicId, { buffer: params.buffer, result });
    return result;
  }

  async getExport(urlOrId: string): Promise<Buffer | null> {
    const item = this.store.get(urlOrId);
    return item ? item.buffer : null;
  }

  clear(): void {
    this.store.clear();
  }
}

export class CloudinaryExportStore implements ExportStore {
  private client: typeof cloudinary;

  constructor() {
    this.client = cloudinary;
    try {
      const env = getEnv();
      this.client.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    } catch {
      this.client.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  }

  async saveExport(params: SaveExportParams): Promise<ExportResult> {
    const publicId = `cairn/exports/${params.workspaceId}/${params.runId}/${params.filename.replace(/\.[^/.]+$/, "")}`;

    return new Promise<ExportResult>((resolve, reject) => {
      const uploadStream = this.client.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "raw",
          folder: `cairn/exports/${params.workspaceId}/${params.runId}`,
          use_filename: true,
          unique_filename: false,
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            return reject(new Error(`Cloudinary upload failed: ${error?.message || "Unknown error"}`));
          }
          resolve({
            url: result.secure_url || result.url,
            publicId: result.public_id,
            format: params.format,
            rows: params.rows,
          });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async getExport(urlOrId: string): Promise<Buffer | null> {
    try {
      const res = await fetch(urlOrId);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }
}

declare global {
  var _memoryExportStoreInstance: MemoryExportStore | undefined;
}

export function getMemoryExportStore(): MemoryExportStore {
  if (!globalThis._memoryExportStoreInstance) {
    globalThis._memoryExportStoreInstance = new MemoryExportStore();
  }
  return globalThis._memoryExportStoreInstance;
}

export const defaultMemoryExportStore = getMemoryExportStore();

export function createExportStore(): ExportStore {
  if (
    process.env.DEMO_MODE === "true" ||
    process.env.NODE_ENV === "test" ||
    !process.env.CLOUDINARY_API_KEY
  ) {
    return getMemoryExportStore();
  }

  return new CloudinaryExportStore();
}

