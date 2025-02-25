import { DatabaseConfig } from "../types/database";
import { FirebaseService } from "./firebase.service";

export function createDatabaseService(config: DatabaseConfig) {
  if (config.type !== "firebase") {
    throw new Error("Only Firebase is supported in browser environment");
  }
  return new FirebaseService();
}
