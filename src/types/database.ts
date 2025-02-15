import { CollectionDefinition as Collection } from "./collection";
import { Firestore } from "firebase/firestore";
export interface DatabaseConfig {
  type: "firebase" | "mongodb";
  credentials: {
    // Firebase config
    apiKey?: string;
    appId?: string;
    projectId?: string;
    authDomain?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    measurementId?: string;
    // MongoDB config
    uri?: string;
  };
}

export interface DatabaseService {
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  getDatabase(): Promise<Firestore>;
  // Collection operations
  getAllCollections(): Promise<Collection[]>;
  getCollection(collectionId: string): Promise<Collection>;
  getCollections(collectionIds: string[]): Promise<Collection[]>;
  createCollection(collection: Omit<Collection, "id" | "fid">, mockData?: any[]): Promise<Collection>;
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
  batchDeleteDocuments(collectionId: string, documentIds: string[]): Promise<void>;
  batchUpdateDocuments(collectionId: string, documents: { id: string; data: any }[]): Promise<any[]>;
}

export interface QueryParams {
  where?: Array<[string, "eq" | "gt" | "lt" | "contains", any]>;
  orderBy?: Array<[string, "asc" | "desc"]>;
  limit?: number;
  offset?: number;
}
