import { CollectionDefinition as Collection } from "./collection";

export interface DatabaseConfig {
  type: "firebase" | "mongodb";
  credentials: {
    // Firebase config
    apiKey?: string;
    projectId?: string;
    // MongoDB config
    uri?: string;
  };
}

export interface DatabaseService {
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  getCollection(collectionId: string): Promise<Collection>;
  listCollections(): Promise<Collection[]>;
  createCollection(collection: Omit<Collection, "id">): Promise<Collection>;
  updateCollection(id: string, collection: Partial<Collection>): Promise<Collection>;
  deleteCollection(id: string): Promise<void>;

  // Document operations
  getDocument(collectionId: string, documentId: string): Promise<any>;
  queryDocuments(collectionId: string, query: QueryParams): Promise<{ data: any[]; total: number; hasMore: boolean }>;
  createDocument(collectionId: string, data: any): Promise<any>;
  updateDocument(collectionId: string, documentId: string, data: any): Promise<any>;
  deleteDocument(collectionId: string, documentId: string): Promise<void>;

  searchDocuments(
    collectionId: string,
    searchText: string,
    fields: string[],
    page?: number,
    pageSize?: number
  ): Promise<{ data: any[]; total: number; hasMore: boolean }>;

  batchCreateDocuments(collectionId: string, documents: any[]): Promise<any[]>;
}

export interface QueryParams {
  where?: Array<[string, "eq" | "gt" | "lt" | "contains", any]>;
  orderBy?: Array<[string, "asc" | "desc"]>;
  limit?: number;
  offset?: number;
}
