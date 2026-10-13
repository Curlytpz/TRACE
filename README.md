# TRACE - Agentic RAG Investigation Workspace

TRACE Phase 2 stores real investigations and knowledge sources in PostgreSQL. It does not generate AI findings.

## Stack

- Client: React, Vite, TypeScript, Tailwind CSS
- Server: Node.js, Express, TypeScript, Zod
- Data: PostgreSQL and Prisma ORM 6.19.3
- Tests: Vitest, Supertest, Prisma integration tests

## Security and scope

Logs and knowledge content are untrusted plain text. TRACE never executes them, fetches origin URLs, or renders source content as HTML. Bodies are limited to 200 KB and all write requests use Zod validation.

Authentication is not implemented. All data is shared within the configured instance. Do not deploy this API publicly without access control.

AI APIs, LangGraph, embeddings, semantic search, vector columns, web crawling and autonomous execution are intentionally not implemented.

## Windows PowerShell setup

Prerequisites: Node.js 22.11+ and PostgreSQL 15+.

Create a PostgreSQL role plus separate development and test databases:

    CREATE ROLE trace_app LOGIN PASSWORD 'replace-with-a-strong-password';
    CREATE DATABASE trace OWNER trace_app;
    CREATE DATABASE trace_test OWNER trace_app;

Then:

    Copy-Item server/.env.example server/.env
    Copy-Item client/.env.example client/.env
    notepad server/.env
    npm install
    npm run prisma:generate --workspace server
    npm run db:migrate:dev --workspace server
    npm run dev

Replace the password in server/.env. The browser runs at http://localhost:5173 and the API at http://localhost:4000. Never commit .env files. DATABASE_URL is only used by the server.

## Schema and migrations

- Investigation: title, description, optional error logs, tags, status and timestamps.
- KnowledgeSource: metadata, untrusted content, optional origin URL and timestamps.
- InvestigationEvidence: a unique investigation/source relationship with optional note.

Foreign keys cascade only relationship rows when an investigation or source is deleted. Status, date and relationship indexes support common queries.

The pgvector preparation migration tries to enable the PostgreSQL extension and emits a notice when it is unavailable or unauthorized. It creates no vector column or arbitrary embedding dimension.

Commands:

    npm run prisma:generate --workspace server
    npm run db:migrate:dev --workspace server
    npm run db:migrate:deploy --workspace server
    npm run db:studio --workspace server

Use db:migrate:deploy for prepared databases in deployment.

## API

Collection endpoints accept page and pageSize; pageSize has a maximum of 100.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /api/health | Service health |
| POST, GET | /api/investigations | Create, list investigations |
| GET, PATCH, DELETE | /api/investigations/:id | Read, update, delete |
| POST, GET | /api/investigations/:id/evidence | Associate, list evidence |
| DELETE | /api/investigations/:id/evidence/:evidenceId | Remove evidence |
| POST, GET | /api/knowledge-sources | Create, list sources |
| GET, PATCH, DELETE | /api/knowledge-sources/:id | Read, update, delete |

## Verification

    npm run typecheck
    npm test
    npm run build

Integration tests require TEST_DATABASE_URL, which must point to a separate database and include the word test. Migrate that database before running:

    $env:DATABASE_URL = 'your-test-connection-url'
    npm run db:migrate:deploy --workspace server
    Remove-Item Env:DATABASE_URL
    npm run test:integration --workspace server

Without TEST_DATABASE_URL, persistence tests are skipped to protect development data; health testing still runs.

## Current functionality

The dashboard creates, lists and displays persisted investigations; changes investigation status; deletes with confirmation; creates, lists, displays and deletes knowledge sources; and associates/removes evidence. It includes loading, empty, error and success feedback.

## Next phase

Add access control before public deployment. A future phase can then design ingestion, choose an embedding model, add vector fields, retrieval, and evidence-grounded AI analysis.

## Phase 3.1: Knowledge ingestion

TRACE can turn an existing KnowledgeSource into ordered, traceable text chunks. Supported inputs are plain-text developer notes, pasted error logs, Markdown documentation, and pasted technical documentation. File uploads, PDFs, repositories, URL fetching, embeddings, and semantic search are not supported.

Use POST /api/knowledge-sources/:id/ingest to normalize and persist chunks. GET /api/knowledge-sources/:id/chunks returns chunks in chunkIndex order. GET /api/knowledge-sources/:id/ingestion-status reports whether stored chunks match current source content.

Chunks are character-based (maximum 1,500 characters with 200-character overlap), preferring paragraph, line, and whitespace boundaries. Offsets are JavaScript UTF-16 code-unit indexes into the normalized source text. Normalization converts line endings, trims trailing spaces, and limits excess blank lines while preserving indentation, stack traces, technical identifiers, and Markdown headings.

KnowledgeChunk stores content, SHA-256 contentHash, offsets, optional Markdown section heading, and timestamps. Updating source content removes its old chunks inside the same transaction; re-ingestion replaces chunks transactionally. Re-ingesting unchanged normalized content is idempotent.

Apply the new migration only after verifying DATABASE_URL points to the isolated TRACE development database:

    npm run prisma:generate --workspace server
    npm run db:migrate:dev --workspace server

Integration tests require a verified TEST_DATABASE_URL for trace_test. They intentionally skip otherwise.

## Phase 3.2: PostgreSQL keyword retrieval

TRACE now searches current ingested KnowledgeChunk records with PostgreSQL full-text search. GET /api/search accepts q (required), optional investigationId, page (default 1), and limit (default 10; maximum 50). It returns the normalized query, ranked chunk results, source traceability, and pagination metadata.

Retrieval uses PostgreSQL's simple text-search configuration, websearch_to_tsquery, ts_rank_cd, and a GIN expression index on KnowledgeChunk content. SQL values are parameterized through Prisma's safe SQL API. Results use deterministic secondary ordering by source ID and chunk index.

An optional investigation filter searches only knowledge sources linked through InvestigationEvidence. Sources must have a matching normalized-content freshness hash from successful ingestion; updating a source clears that marker and excludes stale chunks until re-ingested.

Apply the additive keyword-search migration to both isolated databases after verifying targets:

    npm run db:migrate:deploy --workspace server

The project integration script now runs persistence, ingestion, and search suites sequentially against the guarded trace_test database.

Keyword search is not semantic retrieval. Exact technical identifiers, punctuation-heavy error codes, inflections, and substrings may not match as users expect. It does not use embeddings, vectors, LLMs, or AI-generated answers.


## Phase 3.3: Bounded semantic retrieval

TRACE can now persist chunk embeddings and perform cosine-similarity retrieval, but embeddings remain **disabled by default**. This phase does not generate investigation answers or perform agentic analysis.

### Provider and lifecycle

Set `EMBEDDING_PROVIDER=openai` and provide `OPENAI_API_KEY` only when you deliberately authorize external OpenAI embedding requests. The provider is never called merely by starting TRACE; it is called only by the source embedding or semantic-search endpoints. With the default `disabled` setting, those operations return an explicit unavailable response. No local model is downloaded and test doubles are restricted to automated tests.

Each `KnowledgeChunkEmbedding` records its provider, model, dimension, numeric JSON vector, chunk content hash, and embedding time. `POST /api/knowledge-sources/:id/embed` embeds only chunks whose current hash is not already represented by the active provider/model. Editing a source or re-ingesting changed chunks removes dependent embeddings through the chunk foreign-key cascade. `GET /api/knowledge-sources/:id/embedding-status` reports whether current chunks are embedded, stale, unavailable, or not yet ingested.

### Semantic API and safety limits

`GET /api/search/semantic?q=...` supports the same optional `investigationId`, `page`, and bounded `limit` parameters as keyword search (semantic limit maximum: 25). It searches only current, provider/model-compatible embeddings and honors investigation evidence scope. The response includes coverage information; if a current chunk has no compatible embedding, the UI and API mark the result set incomplete.

The JSON fallback reads at most 1,000 compatible vectors. If a request would exceed that ceiling, TRACE returns an error and no partial ranking, so incomplete candidates are never presented as complete results. Vectors are rejected during storage when they are empty, non-finite, oversized, or dimensionally inconsistent within a batch. Exact keyword search remains unchanged at `GET /api/search`.

### JSON storage limitation and pgvector upgrade

PostgreSQL 18.4 is available locally, but its pgvector extension is not installed or available in this environment. JSONB vectors are a deliberately bounded fallback: PostgreSQL cannot build an approximate nearest-neighbor index over this representation, so it is unsuitable for large corpora. A future pgvector upgrade should first install and verify the extension, add an additive vector column/table for a selected fixed provider/model dimension, backfill only current compatible JSON embeddings, validate equivalent scoped ranking, and then move retrieval to an indexed cosine-distance query. Do not remove the JSON fallback until the migration and rollback path have been tested.

Additional endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | /api/knowledge-sources/:id/embed | Embed current chunks using the explicitly configured provider |
| GET | /api/knowledge-sources/:id/embedding-status | Report source embedding freshness and availability |
| GET | /api/search/semantic | Bounded, scoped cosine-similarity search |


## Phase 3.3.1: Google Gemini embeddings

TRACE supports Gemini as an opt-in real embedding provider. Configure it locally only when you are ready to permit source content to leave TRACE:

    EMBEDDING_PROVIDER=gemini
    GEMINI_API_KEY=replace-with-your-key
    GEMINI_EMBEDDING_MODEL=gemini-embedding-001
    GEMINI_EMBEDDING_DIMENSIONS=768

Do not commit `server/.env`. Gemini requests occur only after that configuration is present and a user explicitly runs **Generate embeddings** for a source or submits a semantic search. Startup does not make provider requests.

The Gemini adapter uses the official Gemini API's `embedContent` method and stores document vectors made with `RETRIEVAL_DOCUMENT`; semantic queries use `RETRIEVAL_QUERY`. It requests a fixed 768 dimensions and sets `autoTruncate: false`, so an over-limit input is rejected by the provider rather than silently shortened. TRACE retains its 16-item/24,000-character local batching, 15-second network timeout, one bounded retry for rate-limit/transient failures, JSON storage, and 1,000 compatible-candidate ceiling.

Google currently lists `gemini-embedding-001` as stable, text-only, with a 2,048-token input limit and flexible 128–3,072 output dimensions (768 is recommended). The current public pricing page does not clearly enumerate a `gemini-embedding-001` row, so free-tier eligibility and quotas must be confirmed in the account's Google AI Studio rate-limit page before enabling it. Do not assume the provider's batch API is free-tier eligible; TRACE uses synchronous embed requests instead.

## Phase 3.4: Hybrid retrieval

`GET /api/search/hybrid?q=...` combines the existing PostgreSQL keyword and bounded semantic retrieval branches with Reciprocal Rank Fusion (RRF): `1 / (60 + keywordRank) + 1 / (60 + semanticRank)`. Ranks are one-based; scores from different systems are never added directly. Results retain chunk/source traceability plus per-branch rank and score contributions.

Hybrid retrieval reads the top 100 keyword candidates and top 100 semantic candidates, deduplicates by chunk ID, fuses, and only then paginates. `pagination.isWindowed` and `retrievalWindow` make clear when this bounded candidate window is not an exhaustive global ranking. Semantic evaluation remains capped at 1,000 compatible JSON vectors and continues to refuse requests over that cap rather than silently returning a partial semantic set.

If Gemini is unavailable, rate limited, times out, or returns an invalid query vector, hybrid retrieval returns `mode: "keyword_only"` with a safe failure reason. A candidate-limit refusal, invalid request, or unknown server failure is never downgraded to an empty or keyword-only result. The Evidence Search UI defaults to Hybrid and displays branch contributions and degraded-mode warnings.

## Phase 4.1: Evidence-grounded analysis

AI analysis is independently opt-in: set `GENERATION_PROVIDER=gemini` and `GEMINI_GENERATION_MODEL=gemini-2.5-flash` only after deliberately authorizing Gemini requests. `POST /api/investigations/:id/analyze` accepts `{ "question": "..." }`, retrieves scoped hybrid evidence, includes at most 8 whole chunks and 12,000 characters, and validates Gemini JSON plus every `[E#]` citation against the sent evidence. Generated answers are not persisted. Citation validation confirms that an evidence item exists; it does not prove that a claim is factually supported.

Phase 4.1 is covered by mocked automated tests, but live Gemini structured-answer generation has not yet been accepted as verified. Validate it with one controlled request after configuring a local provider, and treat returned findings and hypotheses as evidence-assisted guidance rather than confirmed diagnoses.
