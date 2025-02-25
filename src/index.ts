import { createDatabaseService } from "./services";
import { DatabaseConfig, DatabaseService, FirebaseDatabaseService } from "./types";

export * from "./types";
export { createDatabaseService } from "./services";

// Factory function to create database instance
export function createDatabase(config: DatabaseConfig): DatabaseService {
  return createDatabaseService(config);
}

// Factory function to create firebase database instance
export function createFirebaseDatabase(config: DatabaseConfig): FirebaseDatabaseService {
  return createDatabaseService(config);
}
