// Objective 4: generate, verify and download a backend from natural language.
//
//   node src/web/server.js        then open http://localhost:3000
//
// A thin wrapper over the existing pipeline, not a product. No framework, no
// authentication, no persistence beyond the life of the process.
//
// THREE THINGS THIS LAYER OWES THE DISSERTATION
//
// 1. Verified-or-nothing at the HTTP boundary. On non-convergence the job ends
//    as HTTP 500 with the structured error and NO download link. §2.6.2 promises
//    a rollback to a clean pre-request state; here that means the artefacts are
//    never written and the job holds no code.
//
// 2. Metric 4 as §2.8 defines it: wall-clock from ingestion of the description
//    to serialisation of the output archive. Nothing before this layer existed
//    could measure that, because there was no archive. The clock starts when
//    POST /generate accepts the description and stops when the ZIP has been
//    fully written.
//
// 3. Sandboxing, as §1.3 claims it. Generated code is written to a temporary
//    directory, is never imported, executed, or evaluated by this server, and
//    leaves only as bytes in a download.
//
// A run takes minutes, so POST /generate returns immediately with a job id and
// the browser polls. Blocking the response would sit past every proxy timeout
// and would make the progress display impossible.
import express from "express";
import archiver from "archiver";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { synthesiseVerifiedSchema } from "../synthesise.js";
import { reflect } from "../reflect.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(here, "public")));

// In-memory only. A job map that outlived the process would be a database of
// past runs, which is outside the scope this layer was given.
const jobs = new Map();

app.post("/generate", (req, res) => {
  const description = String(req.body?.description ?? "").trim();
  if (description === "") {
    return res.status(400).json({ error: "A feature description is required" });
  }

  const id = randomUUID();
  // Metric 4 starts here: ingestion of the natural-language input.
  jobs.set(id, { id, status: "running", stage: "Agent 1: synthesising schema", startedAt: performance.now() });
  res.status(202).json({ id });

  run(id, description).catch((err) => {
    const job = jobs.get(id);
    job.status = "failed";
    job.outcome = "infrastructure";
    job.error = { type: err?.type ?? err?.name ?? "Error", message: err?.message ?? String(err) };
  });
});

async function run(id, description) {
  const job = jobs.get(id);

  const schema = await synthesiseVerifiedSchema(description);
  job.schemaAttempts = schema.attempts.length;
  job.stage = `Agent 1: ${schema.outcome} after ${schema.attempts.length} attempt(s)`;

  if (!schema.verified) {
    // Verified-or-nothing. Nothing is written and no archive is built.
    job.status = "failed";
    job.outcome = schema.outcome;
    job.failedLayer = 0;
    job.error = schema.error ?? {
      type: schema.attempts.at(-1)?.errorType ?? "Unverified",
      message: "The schema did not satisfy Layer 0 within the attempt cap; no artefacts were emitted.",
    };
    return;
  }

  job.stage = "Agent 2: designing routes";
  const routes = await reflect(schema.ddl);
  job.routeAttempts = routes.attempts.length;

  if (!routes.verified) {
    job.status = "failed";
    job.outcome = routes.outcome;
    job.failedLayer = routes.attempts.at(-1)?.failedLayer ?? null;
    job.error = routes.error ?? {
      type: routes.attempts.at(-1)?.errorType ?? "Unverified",
      message: "The module did not satisfy Layers 1 and 2 within the attempt cap; no artefacts were emitted.",
    };
    return;
  }

  // Sandboxing: a temporary directory, written to and never executed.
  job.stage = "Serialising archive";
  const dir = await mkdtemp(join(tmpdir(), "synthesised-"));
  const report = {
    verified: true,
    schemaAttempts: schema.attempts,
    routeAttempts: routes.attempts,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(join(dir, "schema.sql"), schema.ddl);
  await writeFile(join(dir, "routes.js"), routes.code);
  await writeFile(join(dir, "verification-report.json"), JSON.stringify(report, null, 2));

  const zipPath = join(dir, "backend.zip");
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(join(dir, "schema.sql"), { name: "schema.sql" });
    archive.file(join(dir, "routes.js"), { name: "routes.js" });
    archive.file(join(dir, "verification-report.json"), { name: "verification-report.json" });
    archive.finalize();
  });

  // Metric 4 stops here: the archive is serialised.
  job.latencyMs = Math.round(performance.now() - job.startedAt);
  job.dir = dir;
  job.zipPath = zipPath;
  job.status = "done";
  job.stage = "Complete";
}

app.get("/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "No such job" });
  res.json({
    id: job.id,
    status: job.status,
    stage: job.stage,
    schemaAttempts: job.schemaAttempts ?? null,
    routeAttempts: job.routeAttempts ?? null,
    latencyMs: job.latencyMs ?? null,
    failedLayer: job.failedLayer ?? null,
    error: job.error ?? null,
    // The download link exists only for a verified run.
    download: job.status === "done" ? `/download/${job.id}` : null,
  });
});

app.get("/download/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "No such job" });

  // The rollback §2.6.2 describes, enforced at the HTTP boundary: an unverified
  // run has no artefacts and cannot be downloaded, whatever the caller asks for.
  if (job.status !== "done") {
    return res.status(500).json({
      error: "The pipeline did not converge; no verified artefacts exist",
      outcome: job.outcome ?? null,
      failedLayer: job.failedLayer ?? null,
      detail: job.error ?? null,
    });
  }
  res.download(job.zipPath, "backend.zip");
});

// Best-effort cleanup so generated code does not accumulate on disk.
process.on("SIGINT", async () => {
  for (const job of jobs.values()) if (job.dir) await rm(job.dir, { recursive: true, force: true }).catch(() => {});
  process.exit(0);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
