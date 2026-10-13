import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

export type IntegrationTestEnvironment = { testDatabaseUrl: string };

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '');
}

export function loadIntegrationTestEnvironment(): IntegrationTestEnvironment | undefined {
  const configuredTestUrl = process.env.TEST_DATABASE_URL;
  if (!configuredTestUrl) return undefined;

  const configuredDevelopmentUrl = process.env.DATABASE_URL;
  if (!configuredDevelopmentUrl) throw new Error('DATABASE_URL must be configured when TEST_DATABASE_URL is configured.');

  let testUrl: URL;
  let developmentUrl: URL;
  try {
    testUrl = new URL(configuredTestUrl);
    developmentUrl = new URL(configuredDevelopmentUrl);
  } catch {
    throw new Error('Integration database URLs must be valid PostgreSQL URLs.');
  }

  if (!['postgresql:', 'postgres:'].includes(testUrl.protocol) || !['postgresql:', 'postgres:'].includes(developmentUrl.protocol)) {
    throw new Error('Integration database URLs must use the PostgreSQL protocol.');
  }
  if (databaseName(testUrl) !== 'trace_test') throw new Error('TEST_DATABASE_URL must target exactly the trace_test database.');
  if (databaseName(developmentUrl) !== 'trace') throw new Error('DATABASE_URL must target exactly the trace database.');
  if (testUrl.hostname !== 'localhost' || testUrl.port !== '5432') {
    throw new Error('TEST_DATABASE_URL must use the intended local PostgreSQL host localhost:5432.');
  }
  if (developmentUrl.hostname !== 'localhost' || developmentUrl.port !== '5432') {
    throw new Error('DATABASE_URL must use the intended local PostgreSQL host localhost:5432.');
  }
  if (testUrl.href === developmentUrl.href) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL.');

  // Must happen before the app and Prisma modules are dynamically imported by each suite.
  process.env.DATABASE_URL = testUrl.href;
  return { testDatabaseUrl: testUrl.href };
}
