-- pgvector is optional during Phase 2.
-- No embeddings or vector columns are created.

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;

EXCEPTION
    WHEN undefined_file THEN
        RAISE NOTICE 'pgvector unavailable. Continuing without it.';

    WHEN feature_not_supported THEN
        RAISE NOTICE 'pgvector not installed. Continuing without it.';

    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges for pgvector. Continuing without it.';
END
$$;npm run db:migrate:dev --workspace server
