import {
  RunsRepo,
  WorkflowsRepo,
  SourcesRepo,
  RecordsRepo,
  EventsRepo,
} from "@/lib/db/repos";
import { createSnapshotStore } from "@/lib/sources/snapshot";
import { FakeLlmClient } from "@/lib/llm/fake";
import { GeminiClient } from "@/lib/llm/gemini";
import { isDomainPermitted } from "@/lib/sources/policy";
import { fetchPage } from "@/lib/sources/fetcher";
import { extractTextFromHtml } from "@/lib/sources/extractText";
import { computeContentHash } from "@/lib/sources/snapshot";
import { RobotsCache } from "@/lib/sources/robots";
import { defaultRateLimiter } from "@/lib/sources/rateLimit";
import { validateCandidate } from "./validate";
import { deduplicateCandidates, verifyAndBuildRecord } from "./dedupe";
import type {
  EngineDependencies,
  AdvanceOptions,
  CandidateRow,
  ValidatedCandidate,
  DedupeGroup,
} from "./types";
import type { Run } from "@/lib/db/schemas";

function createDemoFetchFn(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    if (urlStr.endsWith("/robots.txt")) {
      return new Response("User-agent: *\nAllow: /\n", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    try {
      const fs = await import("fs");
      const path = await import("path");
      const pagesPath = path.resolve(process.cwd(), "tests/fixtures/demo/pages.json");
      if (fs.existsSync(pagesPath)) {
        const pages = JSON.parse(fs.readFileSync(pagesPath, "utf-8"));
        if (pages[urlStr]) {
          return new Response(pages[urlStr], {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        }
      }
    } catch {
      // Fall through
    }

    return fetch(input, init);
  }) as typeof fetch;
}

function resolveDependencies(deps: EngineDependencies) {
  const db = deps.db;
  const runsRepo = deps.runsRepo ?? new RunsRepo(db);
  const workflowsRepo = deps.workflowsRepo ?? new WorkflowsRepo(db);
  const sourcesRepo = deps.sourcesRepo ?? new SourcesRepo(db);
  const recordsRepo = deps.recordsRepo ?? new RecordsRepo(db);
  const eventsRepo = deps.eventsRepo ?? new EventsRepo(db);
  const snapshotStore = deps.snapshotStore ?? createSnapshotStore();

  let fetchFn = deps.fetchFn;
  if (!fetchFn && process.env.DEMO_MODE === "true") {
    fetchFn = createDemoFetchFn();
  }

  const robotsChecker = deps.robotsChecker ?? new RobotsCache({ fetchFn });
  const rateLimiter = deps.rateLimiter ?? defaultRateLimiter;

  let llmClient = deps.llmClient;
  if (!llmClient) {
    if (process.env.DEMO_MODE === "true" || !process.env.GEMINI_API_KEY) {
      llmClient = new FakeLlmClient();
    } else {
      llmClient = new GeminiClient();
    }
  }

  const now = deps.clock ?? Date.now;

  return {
    runsRepo,
    workflowsRepo,
    sourcesRepo,
    recordsRepo,
    eventsRepo,
    snapshotStore,
    llmClient,
    robotsChecker,
    rateLimiter,
    fetchFn,
    now,
  };
}

export async function pauseRun(
  runId: string,
  workspaceId: string,
  deps: EngineDependencies
): Promise<Run & { id: string }> {
  const { runsRepo, eventsRepo } = resolveDependencies(deps);
  const run = await runsRepo.findById(workspaceId, runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  if (run.status === "complete" || run.status === "failed" || run.status === "cancelled") {
    return run;
  }

  const updated = await runsRepo.updateStatus(workspaceId, runId, "paused", run.stage);
  if (!updated) {
    throw new Error(`Failed to pause run ${runId}`);
  }

  await eventsRepo.create(workspaceId, {
    runId,
    stage: run.stage,
    level: "info",
    message: "Run paused",
  });

  return updated;
}

export async function resumeRun(
  runId: string,
  workspaceId: string,
  deps: EngineDependencies
): Promise<Run & { id: string }> {
  const { runsRepo, eventsRepo } = resolveDependencies(deps);
  const run = await runsRepo.findById(workspaceId, runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  if (run.status !== "paused") {
    return run;
  }

  const targetStatus = (run.stage === "complete" ? "complete" : run.stage) as Run["status"];
  const updated = await runsRepo.updateStatus(workspaceId, runId, targetStatus, run.stage);
  if (!updated) {
    throw new Error(`Failed to resume run ${runId}`);
  }

  await eventsRepo.create(workspaceId, {
    runId,
    stage: run.stage,
    level: "info",
    message: "Run resumed",
  });

  return updated;
}

export async function cancelRun(
  runId: string,
  workspaceId: string,
  deps: EngineDependencies
): Promise<Run & { id: string }> {
  const { runsRepo, eventsRepo } = resolveDependencies(deps);
  const run = await runsRepo.findById(workspaceId, runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  if (run.status === "complete" || run.status === "failed" || run.status === "cancelled") {
    return run;
  }

  const updated = await runsRepo.updateStatus(workspaceId, runId, "cancelled", run.stage, {
    finishedAt: new Date(),
  });
  if (!updated) {
    throw new Error(`Failed to cancel run ${runId}`);
  }

  await eventsRepo.create(workspaceId, {
    runId,
    stage: run.stage,
    level: "info",
    message: "Run cancelled",
  });

  return updated;
}

export async function advance(
  runId: string,
  workspaceId: string,
  deps: EngineDependencies,
  options: AdvanceOptions = {}
): Promise<Run & { id: string }> {
  const {
    runsRepo,
    workflowsRepo,
    sourcesRepo,
    recordsRepo,
    eventsRepo,
    snapshotStore,
    llmClient,
    robotsChecker,
    rateLimiter,
    fetchFn,
    now,
  } = resolveDependencies(deps);

  const budgetMs = options.budgetMs ?? 20000;
  const startTime = now();

  const run = await runsRepo.findById(workspaceId, runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  // Terminal or paused checks
  if (run.status === "complete" || run.status === "failed" || run.status === "cancelled") {
    return run;
  }
  if (run.status === "paused") {
    return run;
  }

  const workflow = await workflowsRepo.findById(workspaceId, run.workflowId);
  if (!workflow) {
    const failedRun = await runsRepo.updateStatus(workspaceId, run.id, "failed", run.stage, {
      error: "Workflow not found",
      finishedAt: new Date(),
    });
    await eventsRepo.create(workspaceId, {
      runId: run.id,
      stage: run.stage,
      level: "error",
      message: "Associated workflow not found",
    });
    return failedRun!;
  }

  const blueprint = workflow.blueprint;

  // Record startedAt if not set
  if (!run.startedAt) {
    run.startedAt = new Date();
    await runsRepo.update(workspaceId, run.id, { startedAt: run.startedAt });
  }

  // Determine stage to execute
  const currentStage = run.stage;

  try {
    switch (currentStage) {
      case "planning": {
        // Stage 1: planning
        await eventsRepo.create(workspaceId, {
          runId: run.id,
          stage: "planning",
          level: "info",
          message: `Blueprint attached for entity: ${blueprint.entity}`,
        });

        const nextRun = await runsRepo.updateStatus(
          workspaceId,
          run.id,
          "discovering",
          "discovering"
        );
        return nextRun!;
      }

      case "discovering": {
        // Stage 2: discovering
        const candidateUrls: Array<{ url: string; title: string | null; discoveredVia: string }> = [];

        for (const src of blueprint.sources) {
          if (src.kind === "url" && src.url) {
            candidateUrls.push({
              url: src.url,
              title: null,
              discoveredVia: "blueprint_url",
            });
          } else if (src.kind === "search" && src.query) {
            const discoverResult = await llmClient.discover(src.query, {
              maxSources: blueprint.limits.maxSources,
            });
            for (const item of discoverResult.urls) {
              candidateUrls.push({
                url: item.url,
                title: item.title || null,
                discoveredVia: `search: ${src.query}`,
              });
            }
          }
        }

        // Deduplicate URLs and normalise
        const seenUrls = new Set<string>();
        const permittedItems: Array<{ url: string; title: string | null; discoveredVia: string; domain: string }> = [];

        for (const item of candidateUrls) {
          let parsed: URL;
          try {
            parsed = new URL(item.url);
          } catch {
            await eventsRepo.create(workspaceId, {
              runId: run.id,
              stage: "discovering",
              level: "warn",
              message: `Invalid URL discarded: ${item.url}`,
              meta: { url: item.url, reason: "Malformed URL" },
            });
            continue;
          }

          const normUrl = parsed.href;
          if (seenUrls.has(normUrl)) {
            continue;
          }
          seenUrls.add(normUrl);

          // Policy check
          const policyCheck = isDomainPermitted(normUrl);
          if (!policyCheck.permitted) {
            await eventsRepo.create(workspaceId, {
              runId: run.id,
              stage: "discovering",
              level: "warn",
              message: `URL rejected by policy: ${normUrl}`,
              meta: { url: normUrl, reason: policyCheck.reason },
            });
            continue;
          }

          permittedItems.push({
            url: normUrl,
            title: item.title,
            discoveredVia: item.discoveredVia,
            domain: parsed.hostname.toLowerCase(),
          });
        }

        // Cap at limits.maxSources
        let finalItems = permittedItems;
        if (permittedItems.length > blueprint.limits.maxSources) {
          const droppedCount = permittedItems.length - blueprint.limits.maxSources;
          finalItems = permittedItems.slice(0, blueprint.limits.maxSources);
          await eventsRepo.create(workspaceId, {
            runId: run.id,
            stage: "discovering",
            level: "info",
            message: `Capped sources at limit ${blueprint.limits.maxSources} (dropped ${droppedCount} excess URLs)`,
            meta: { maxSources: blueprint.limits.maxSources, droppedCount },
          });
        }

        // Idempotent insertion: do not duplicate already existing sources
        const existingSourcesResult = await sourcesRepo.list(workspaceId, {
          runId: run.id,
          limit: 100,
        });
        const existingUrlMap = new Map(existingSourcesResult.items.map((s) => [s.url, s]));

        const toInsert = finalItems.filter((item) => !existingUrlMap.has(item.url));
        if (toInsert.length > 0) {
          await sourcesRepo.createMany(
            workspaceId,
            toInsert.map((item) => ({
              runId: run.id,
              url: item.url,
              domain: item.domain,
              title: item.title,
              discoveredVia: item.discoveredVia,
              robots: { allowed: true, checkedAt: new Date() },
              status: "pending",
            }))
          );
        }

        const totalSourcesFound = finalItems.length;

        await eventsRepo.create(workspaceId, {
          runId: run.id,
          stage: "discovering",
          level: "info",
          message: `Discovered ${totalSourcesFound} permitted sources`,
          meta: { count: totalSourcesFound },
        });

        const nextRun = await runsRepo.updateStatus(
          workspaceId,
          run.id,
          "fetching",
          "fetching",
          {
            counts: {
              ...run.counts,
              sourcesFound: totalSourcesFound,
            },
            cursor: { sourceRetries: {} },
          }
        );
        return nextRun!;
      }

      case "fetching": {
        // Stage 3: fetching
        const allSources = await sourcesRepo.list(workspaceId, {
          runId: run.id,
          limit: 100,
        });

        const cursorRetries = (run.cursor?.sourceRetries as Record<string, number>) || {};

        // Candidate sources needing fetching: status pending OR failed with retries < 2
        const sourcesToFetch = allSources.items.filter((s) => {
          if (s.status === "pending") return true;
          if (s.status === "failed" && (cursorRetries[s.id] || 0) < 2) return true;
          return false;
        });

        if (sourcesToFetch.length === 0) {
          // All sources are fetched or final: move to extracting
          const nextRun = await runsRepo.updateStatus(
            workspaceId,
            run.id,
            "extracting",
            "extracting",
            {
              cursor: {
                extractedSourceIds: [],
                candidates: [],
              },
            }
          );
          return nextRun!;
        }

        let fetchedCount = run.counts.sourcesFetched;

        for (const source of sourcesToFetch) {
          // Bounded time budget check
          if (now() - startTime > budgetMs - 500) {
            break;
          }

          try {
            const fetchResult = await fetchPage(source.url, {
              robotsChecker,
              rateLimiter,
              fetchFn,
              timeoutMs: 8000,
            });

            if (fetchResult.status >= 500) {
              throw new Error(`HTTP ${fetchResult.status} Server Error`);
            }

            const extractedPage = extractTextFromHtml(fetchResult.html, fetchResult.finalUrl);
            const contentHash = computeContentHash(extractedPage.text);

            // Check if contentHash already exists in this run
            const isDuplicateContent = allSources.items.some(
              (s) => s.id !== source.id && s.contentHash === contentHash
            );

            if (isDuplicateContent) {
              await sourcesRepo.update(workspaceId, source.id, {
                status: "skipped",
                httpStatus: fetchResult.status,
                contentHash,
                textLength: extractedPage.text.length,
              });

              await eventsRepo.create(workspaceId, {
                runId: run.id,
                stage: "fetching",
                level: "info",
                message: `Skipping duplicate content source: ${source.url}`,
                meta: { url: source.url, contentHash },
              });
            } else {
              const snapshotResult = await snapshotStore.saveSnapshot({
                workspaceId,
                runId: run.id,
                url: source.url,
                text: extractedPage.text,
                sourceId: source.id,
              });

              await sourcesRepo.update(workspaceId, source.id, {
                status: "fetched",
                httpStatus: fetchResult.status,
                contentHash,
                textLength: extractedPage.text.length,
                snapshot: {
                  publicId: snapshotResult.publicId,
                  url: snapshotResult.url,
                },
                fetchedAt: new Date(),
              });

              fetchedCount++;

              await eventsRepo.create(workspaceId, {
                runId: run.id,
                stage: "fetching",
                level: "info",
                message: `Fetched source: ${source.url}`,
                meta: { url: source.url, status: fetchResult.status },
              });
            }
          } catch (err: unknown) {
            const error = err as Error;
            const isRobots = error.name === "RobotsDisallowedError";
            const isPolicy = error.name === "PolicyViolationError";

            if (isRobots) {
              await sourcesRepo.update(workspaceId, source.id, {
                status: "blocked",
                robots: { allowed: false, checkedAt: new Date() },
              });

              await eventsRepo.create(workspaceId, {
                runId: run.id,
                stage: "fetching",
                level: "warn",
                message: `Robots disallowed for source ${source.url}: ${error.message}`,
                meta: { url: source.url, reason: error.message },
              });
            } else if (isPolicy) {
              await sourcesRepo.update(workspaceId, source.id, {
                status: "blocked",
              });

              await eventsRepo.create(workspaceId, {
                runId: run.id,
                stage: "fetching",
                level: "warn",
                message: `Policy violation for source ${source.url}: ${error.message}`,
                meta: { url: source.url, reason: error.message },
              });
            } else {
              // Network error or 500 error: retry logic up to 2 times
              const currentAttempts = cursorRetries[source.id] || 0;
              const nextAttempt = currentAttempts + 1;
              cursorRetries[source.id] = nextAttempt;

              if (nextAttempt <= 2) {
                // Keep pending for retry
                await sourcesRepo.update(workspaceId, source.id, {
                  status: "pending",
                });

                await eventsRepo.create(workspaceId, {
                  runId: run.id,
                  stage: "fetching",
                  level: "warn",
                  message: `Source fetch failed (retry attempt ${nextAttempt}/2): ${source.url}`,
                  meta: { url: source.url, error: error.message, retry: nextAttempt },
                });
              } else {
                // Retries exhausted: mark failed
                await sourcesRepo.update(workspaceId, source.id, {
                  status: "failed",
                });

                await eventsRepo.create(workspaceId, {
                  runId: run.id,
                  stage: "fetching",
                  level: "error",
                  message: `Source fetch failed after 2 retries: ${source.url}`,
                  meta: { url: source.url, error: error.message },
                });
              }
            }
          }
        }

        // Re-check sources to see if any pending remain
        const updatedSources = await sourcesRepo.list(workspaceId, {
          runId: run.id,
          limit: 100,
        });

        const pendingRemain = updatedSources.items.some((s) => {
          if (s.status === "pending") return true;
          if (s.status === "failed" && (cursorRetries[s.id] || 0) < 2) return true;
          return false;
        });

        if (!pendingRemain) {
          const nextRun = await runsRepo.updateStatus(
            workspaceId,
            run.id,
            "extracting",
            "extracting",
            {
              counts: {
                ...run.counts,
                sourcesFetched: fetchedCount,
              },
              cursor: {
                extractedSourceIds: [],
                candidates: [],
              },
            }
          );
          return nextRun!;
        } else {
          const nextRun = await runsRepo.update(workspaceId, run.id, {
            counts: {
              ...run.counts,
              sourcesFetched: fetchedCount,
            },
            cursor: { sourceRetries: cursorRetries },
          });
          return nextRun!;
        }
      }

      case "extracting": {
        // Stage 4: extracting
        const allSources = await sourcesRepo.list(workspaceId, {
          runId: run.id,
          limit: 100,
        });
        const fetchedSources = allSources.items.filter((s) => s.status === "fetched");

        const extractedSourceIds =
          (run.cursor?.extractedSourceIds as string[]) || [];
        const candidates = (run.cursor?.candidates as CandidateRow[]) || [];
        let valuesExtractedCount = run.counts.valuesExtracted;

        const unextractedSources = fetchedSources.filter(
          (s) => !extractedSourceIds.includes(s.id)
        );

        if (unextractedSources.length === 0) {
          const nextRun = await runsRepo.updateStatus(
            workspaceId,
            run.id,
            "validating",
            "validating",
            {
              cursor: {
                ...run.cursor,
                candidates,
              },
            }
          );
          return nextRun!;
        }

        for (const source of unextractedSources) {
          if (now() - startTime > budgetMs - 500) {
            break;
          }

          if (!source.snapshot) {
            extractedSourceIds.push(source.id);
            continue;
          }

          const snapshotText = await snapshotStore.getSnapshot(source.snapshot.publicId);
          if (!snapshotText) {
            extractedSourceIds.push(source.id);
            continue;
          }

          // Truncate safely with a logged note
          const MAX_TEXT_LENGTH = 30000;
          let textForLlm = snapshotText;
          if (snapshotText.length > MAX_TEXT_LENGTH) {
            textForLlm = snapshotText.slice(0, MAX_TEXT_LENGTH);
            await eventsRepo.create(workspaceId, {
              runId: run.id,
              stage: "extracting",
              level: "info",
              message: `Truncated text from ${snapshotText.length} to ${MAX_TEXT_LENGTH} characters for extraction: ${source.url}`,
              meta: { sourceId: source.id, url: source.url },
            });
          }

          const extractedRows = await llmClient.extract({
            blueprint,
            sourceId: source.id,
            url: source.url,
            text: textForLlm,
          });

          for (const row of extractedRows) {
            candidates.push({
              sourceId: source.id,
              url: source.url,
              row,
            });

            for (const key of Object.keys(row)) {
              if (row[key] && row[key].value !== undefined && row[key].value !== null) {
                valuesExtractedCount++;
              }
            }
          }

          extractedSourceIds.push(source.id);

          await eventsRepo.create(workspaceId, {
            runId: run.id,
            stage: "extracting",
            level: "info",
            message: `Extracted ${extractedRows.length} rows from ${source.url}`,
            meta: { sourceId: source.id, rowsCount: extractedRows.length },
          });

          // Persist progress immediately after each source to guarantee crash idempotency
          await runsRepo.update(workspaceId, run.id, {
            counts: {
              ...run.counts,
              valuesExtracted: valuesExtractedCount,
            },
            cursor: {
              extractedSourceIds,
              candidates,
            },
          });
        }

        if (extractedSourceIds.length >= fetchedSources.length) {
          const nextRun = await runsRepo.updateStatus(
            workspaceId,
            run.id,
            "validating",
            "validating",
            {
              counts: {
                ...run.counts,
                valuesExtracted: valuesExtractedCount,
              },
              cursor: {
                candidates,
              },
            }
          );
          return nextRun!;
        } else {
          const updated = await runsRepo.findById(workspaceId, run.id);
          return updated!;
        }
      }

      case "validating": {
        // Stage 5: validating
        const candidates = (run.cursor?.candidates as CandidateRow[]) || [];
        const validatedCandidates: ValidatedCandidate[] = [];
        let valuesRejectedCount = run.counts.valuesRejected;

        // Cache snapshots for faster validation
        const snapshotCache = new Map<string, string | null>();
        const getSnapshotText = async (sourceId: string) => {
          if (snapshotCache.has(sourceId)) {
            return snapshotCache.get(sourceId)!;
          }
          const src = await sourcesRepo.findById(workspaceId, sourceId);
          if (!src || !src.snapshot) {
            snapshotCache.set(sourceId, null);
            return null;
          }
          const text = await snapshotStore.getSnapshot(src.snapshot.publicId);
          snapshotCache.set(sourceId, text);
          return text;
        };

        for (const candidate of candidates) {
          const outcome = await validateCandidate(candidate, blueprint, getSnapshotText);
          valuesRejectedCount += outcome.valuesRejectedCount;

          for (const reason of outcome.rejectionReasons) {
            await eventsRepo.create(workspaceId, {
              runId: run.id,
              stage: "validating",
              level: "warn",
              message: `Value rejected: ${reason}`,
              meta: { url: candidate.url, reason },
            });
          }

          if (!outcome.accepted) {
            await eventsRepo.create(workspaceId, {
              runId: run.id,
              stage: "validating",
              level: "warn",
              message: `Record dropped: ${outcome.dropReason}`,
              meta: { url: candidate.url, reason: outcome.dropReason },
            });
          } else if (outcome.validatedCandidate) {
            validatedCandidates.push(outcome.validatedCandidate);
          }
        }

        await eventsRepo.create(workspaceId, {
          runId: run.id,
          stage: "validating",
          level: "info",
          message: `Validation complete: ${validatedCandidates.length} candidate records accepted, ${valuesRejectedCount} values rejected`,
        });

        const nextRun = await runsRepo.updateStatus(
          workspaceId,
          run.id,
          "deduping",
          "deduping",
          {
            counts: {
              ...run.counts,
              valuesRejected: valuesRejectedCount,
            },
            cursor: {
              validatedCandidates,
            },
          }
        );
        return nextRun!;
      }

      case "deduping": {
        // Stage 6: deduping
        const validatedCandidates =
          (run.cursor?.validatedCandidates as ValidatedCandidate[]) || [];

        const { groups, duplicatesMergedCount } = deduplicateCandidates(
          validatedCandidates,
          blueprint.keyFields
        );

        await eventsRepo.create(workspaceId, {
          runId: run.id,
          stage: "deduping",
          level: "info",
          message: `Deduping merged ${duplicatesMergedCount} duplicates into ${groups.length} distinct records`,
          meta: { duplicatesMerged: duplicatesMergedCount, groupsCount: groups.length },
        });

        // Serialize groups safely for Mongo cursor
        const serializedGroups = groups.map((g) => ({
          ...g,
          keyTokens: Array.from(g.keyTokens),
        }));

        const nextRun = await runsRepo.updateStatus(
          workspaceId,
          run.id,
          "verifying",
          "verifying",
          {
            counts: {
              ...run.counts,
              duplicatesMerged: duplicatesMergedCount,
            },
            cursor: {
              dedupeGroups: serializedGroups,
            },
          }
        );
        return nextRun!;
      }

      case "verifying": {
        // Stage 7: verifying
        const rawGroups = (run.cursor?.dedupeGroups as Array<
          Omit<DedupeGroup, "keyTokens"> & { keyTokens: string[] }
        >) || [];

        const groups: DedupeGroup[] = rawGroups.map((g) => ({
          ...g,
          keyTokens: new Set(g.keyTokens),
        }));

        let verifiedCount = 0;
        let unverifiedCount = 0;
        let recordsKept = 0;

        for (const group of groups) {
          const { record, verifiedFieldsCount, unverifiedFieldsCount } =
            verifyAndBuildRecord(
              group,
              blueprint,
              run.workflowId,
              run.id,
              workspaceId
            );

          verifiedCount += verifiedFieldsCount;
          unverifiedCount += unverifiedFieldsCount;

          await recordsRepo.upsertByFingerprint(workspaceId, record);
          recordsKept++;

          if (record.flags.some((f) => f.startsWith("contradiction:"))) {
            await eventsRepo.create(workspaceId, {
              runId: run.id,
              stage: "verifying",
              level: "warn",
              message: `Contradiction detected in record: ${record.flags.join(", ")}`,
              meta: { flags: record.flags, mergedFrom: record.mergedFrom },
            });
          }
        }

        await eventsRepo.create(workspaceId, {
          runId: run.id,
          stage: "verifying",
          level: "info",
          message: `Verification complete: ${verifiedCount} verified fields, ${unverifiedCount} unverified fields across ${recordsKept} records`,
        });

        // Stage 8: complete
        const finishedAt = new Date();
        let previousRunId = run.previousRunId || null;

        if (workflow.latestRunId && workflow.latestRunId !== run.id) {
          previousRunId = workflow.latestRunId;
        }

        await workflowsRepo.update(workspaceId, workflow.id, {
          latestRunId: run.id,
          status: "completed",
        });

        await eventsRepo.create(workspaceId, {
          runId: run.id,
          stage: "complete",
          level: "info",
          message: `Run complete. Stored ${recordsKept} verified records.`,
          meta: { recordsKept, finishedAt: finishedAt.toISOString() },
        });

        const nextRun = await runsRepo.updateStatus(
          workspaceId,
          run.id,
          "complete",
          "complete",
          {
            counts: {
              ...run.counts,
              recordsKept,
              verified: verifiedCount,
              unverified: unverifiedCount,
            },
            finishedAt,
            previousRunId,
            cursor: {},
          }
        );

        return nextRun!;
      }

      default:
        return run;
    }
  } catch (error: unknown) {
    const err = error as Error;
    await eventsRepo.create(workspaceId, {
      runId: run.id,
      stage: run.stage,
      level: "error",
      message: `Pipeline execution error: ${err.message}`,
      meta: { error: err.message, stack: err.stack },
    });

    throw err;
  }
}
