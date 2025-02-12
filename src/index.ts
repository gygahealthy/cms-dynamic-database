import { createDatabaseService } from "./services";

import { DatabaseService } from "./types/database";

import { DatabaseConfig } from "./types/database";

export { createDatabaseService } from "./services";
export type { DatabaseConfig, DatabaseService, QueryParams } from "./types/database";
export type { CollectionDefinition as Collection, Field, Index, CollectionData } from "./types/collection";

// Factory function to create database instance
export function createDatabase(config: DatabaseConfig): DatabaseService {
  return createDatabaseService(config);
}
