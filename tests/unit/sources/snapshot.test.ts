import { describe, it, expect, vi } from "vitest";
import {
  MemorySnapshotStore,
  CloudinarySnapshotStore,
  computeContentHash,
  createSnapshotStore,
  type SnapshotStore,
} from "@/lib/sources/snapshot";
import { normalizeWhitespace } from "@/lib/sources/extractText";
import { v2 as cloudinary } from "cloudinary";

describe("Snapshot store", () => {
  const workspaceId = "ws-test-123";
  const runId = "run-test-456";
  const sampleUrl = "https://news.ycombinator.com";
  const sampleText = "   Title   \n\nSome body text with   tabs\t\tand spaces.  ";

  describe("computeContentHash", () => {
    it("computes deterministic sha256 hash across identical normalized content", () => {
      const hash1 = computeContentHash("Verified evidence ledger");
      const hash2 = computeContentHash("Verified evidence ledger");
      const diffHash = computeContentHash("Different content");

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(diffHash);
    });
  });

  describe("MemorySnapshotStore", () => {
    it("saves and retrieves snapshots in-memory", async () => {
      const store: SnapshotStore = new MemorySnapshotStore();

      const result = await store.saveSnapshot({
        workspaceId,
        runId,
        url: sampleUrl,
        text: sampleText,
      });

      expect(result.publicId).toBeDefined();
      expect(result.publicId).toContain(`cairn/snapshots/${workspaceId}/${runId}/`);
      expect(result.url).toContain("memory://");
      expect(result.contentHash).toBe(computeContentHash(sampleText));
      expect(result.byteLength).toBeGreaterThan(0);

      const retrieved = await store.getSnapshot(result.publicId);
      expect(retrieved).toBe(normalizeWhitespace(sampleText));
    });

    it("returns null when retrieving non-existent snapshot id", async () => {
      const store = new MemorySnapshotStore();
      const retrieved = await store.getSnapshot("cairn/snapshots/unknown/id");
      expect(retrieved).toBeNull();
    });

    it("clears all saved snapshots upon clear()", async () => {
      const store = new MemorySnapshotStore();
      const saved = await store.saveSnapshot({
        workspaceId,
        runId,
        url: sampleUrl,
        text: "Temporary data",
      });

      expect(await store.getSnapshot(saved.publicId)).toBe("Temporary data");
      store.clear();
      expect(await store.getSnapshot(saved.publicId)).toBeNull();
    });
  });

  describe("CloudinarySnapshotStore", () => {
    it("uploads raw text resource to proper folder and returns result", async () => {
      const mockUploadStream = vi.fn().mockImplementation((options: Record<string, unknown>, callback: (err: Error | null, res: unknown) => void) => {
        const stream = {
          end: (buffer: Buffer) => {
            callback(null, {
              public_id: `${options.folder}/test-snapshot-id`,
              secure_url: `https://res.cloudinary.com/test-cloud/raw/upload/${options.folder}/test-snapshot-id.txt`,
              bytes: buffer.length,
            });
          },
        };
        return stream;
      });

      vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(
        mockUploadStream as unknown as typeof cloudinary.uploader.upload_stream
      );

      const store = new CloudinarySnapshotStore({
        cloudName: "test-cloud",
        apiKey: "test-key",
        apiSecret: "test-secret",
      });

      const result = await store.saveSnapshot({
        workspaceId,
        runId,
        url: sampleUrl,
        text: sampleText,
      });

      expect(mockUploadStream).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: "raw",
          folder: `cairn/snapshots/${workspaceId}/${runId}`,
        }),
        expect.any(Function)
      );

      expect(result.publicId).toBe(`cairn/snapshots/${workspaceId}/${runId}/test-snapshot-id`);
      expect(result.url).toContain("https://res.cloudinary.com");
      expect(result.contentHash).toBe(computeContentHash(sampleText));
    });

    it("propagates upload failure error", async () => {
      vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(
        ((_options: unknown, callback?: (err: Error | null, res: unknown) => void) => {
          return {
            end: () => {
              if (callback) {
                callback(new Error("Cloudinary rate limit exceeded"), null);
              }
            },
          };
        }) as unknown as typeof cloudinary.uploader.upload_stream
      );

      const store = new CloudinarySnapshotStore({
        cloudName: "test-cloud",
        apiKey: "test-key",
        apiSecret: "test-secret",
      });

      await expect(
        store.saveSnapshot({
          workspaceId,
          runId,
          url: sampleUrl,
          text: sampleText,
        })
      ).rejects.toThrow("Cloudinary rate limit exceeded");
    });

    it("retrieves snapshot content via Cloudinary URL", async () => {
      vi.spyOn(cloudinary, "url").mockReturnValue("https://res.cloudinary.com/raw/test.txt");

      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        text: async () => "Stored snapshot content from cloud",
      });
      vi.stubGlobal("fetch", fetchMock);

      const store = new CloudinarySnapshotStore({
        cloudName: "test-cloud",
        apiKey: "test-key",
        apiSecret: "test-secret",
      });

      const content = await store.getSnapshot("cairn/snapshots/ws/run/id");
      expect(content).toBe("Stored snapshot content from cloud");

      // Test 404
      fetchMock.mockResolvedValueOnce({
        status: 404,
        ok: false,
      });
      const missing = await store.getSnapshot("cairn/snapshots/ws/run/missing");
      expect(missing).toBeNull();

      // Test network failure
      fetchMock.mockRejectedValueOnce(new Error("Network down"));
      const failed = await store.getSnapshot("cairn/snapshots/ws/run/fail");
      expect(failed).toBeNull();

      vi.unstubAllGlobals();
    });

    it("falls back to environment variables in constructor when options omitted", () => {
      process.env.CLOUDINARY_CLOUD_NAME = "env-cloud";
      process.env.CLOUDINARY_API_KEY = "env-key";
      process.env.CLOUDINARY_API_SECRET = "env-secret";

      const store = new CloudinarySnapshotStore();
      expect(store).toBeInstanceOf(CloudinarySnapshotStore);
    });
  });

  describe("createSnapshotStore factory", () => {
    it("returns MemorySnapshotStore when demoMode is requested", () => {
      const store = createSnapshotStore({ demoMode: true });
      expect(store).toBeInstanceOf(MemorySnapshotStore);
    });

    it("returns CloudinarySnapshotStore when credentials exist and not in demo mode", () => {
      process.env.DEMO_MODE = "false";
      process.env.CLOUDINARY_CLOUD_NAME = "cairn-prod";
      process.env.CLOUDINARY_API_KEY = "prod-key";
      process.env.CLOUDINARY_API_SECRET = "prod-secret";

      const store = createSnapshotStore();
      expect(store).toBeInstanceOf(CloudinarySnapshotStore);
    });

    it("returns MemorySnapshotStore when credentials are missing", () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const store = createSnapshotStore();
      expect(store).toBeInstanceOf(MemorySnapshotStore);
    });
  });
});
