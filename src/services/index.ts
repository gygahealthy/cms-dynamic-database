import { DatabaseConfig } from "../types/database";
import { FirebaseService } from "./firebase";
import { MongoDBService } from "./mongodb";

export function createDatabaseService(config: DatabaseConfig) {
  switch (config.type) {
    case "firebase":
      return new FirebaseService();
    case "mongodb":
      return new MongoDBService();
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}
