import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Firestore,
  writeBatch,
} from "firebase/firestore";
import type { DatabaseService, DatabaseConfig, QueryParams } from "../types/database";
import type { CollectionDefinition as Collection } from "../types/collection";

export class FirebaseService implements DatabaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;

  async connect(config: DatabaseConfig): Promise<void> {
    if (!config.credentials.apiKey || !config.credentials.projectId) {
      throw new Error("Firebase credentials missing");
    }

    this.app = initializeApp({
      apiKey: config.credentials.apiKey,
      projectId: config.credentials.projectId,
    });
    this.db = getFirestore(this.app);
  }

  async disconnect(): Promise<void> {
    // Firebase handles connection management automatically
  }

  async getCollection(collectionId: string): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = doc(this.db, "collections", collectionId);
    const docSnap = await getDoc(docRef);
    return docSnap.data() as Collection;
  }

  async listCollections(): Promise<Collection[]> {
    if (!this.db) throw new Error("Database not connected");
    const snapshot = await getDocs(collection(this.db, "collections"));
    return snapshot.docs.map((doc) => doc.data() as Collection);
  }

  async createCollection(collectionData: Omit<Collection, "id">): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = await addDoc(collection(this.db, "collections"), collectionData);
    return { id: docRef.id, ...collectionData };
  }

  async updateCollection(id: string, collection: Partial<Collection>): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = doc(this.db, "collections", id);
    await updateDoc(docRef, collection);
    const updated = await getDoc(docRef);
    return updated.data() as Collection;
  }

  async deleteCollection(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await deleteDoc(doc(this.db, "collections", id));
  }

  async getDocument(collectionId: string, documentId: string): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = doc(this.db, collectionId, documentId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  async queryDocuments(
    collectionId: string,
    queryParams: QueryParams
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    if (!this.db) throw new Error("Database not connected");

    const collectionRef = collection(this.db, collectionId);
    let queryRef = query(collectionRef);

    // Apply filters
    if (queryParams.where) {
      for (const [field, operator, value] of queryParams.where) {
        switch (operator) {
          case "eq":
            queryRef = query(queryRef, where(field, "==", value));
            break;
          case "gt":
            queryRef = query(queryRef, where(field, ">", value));
            break;
          case "lt":
            queryRef = query(queryRef, where(field, "<", value));
            break;
          case "contains":
            queryRef = query(queryRef, where(field, ">=", value), where(field, "<=", value + "\uf8ff"));
            break;
        }
      }
    }

    // Apply sorting
    if (queryParams.orderBy) {
      for (const [field, direction] of queryParams.orderBy) {
        queryRef = query(queryRef, orderBy(field, direction));
      }
    }

    // Get total count before pagination
    const totalSnapshot = await getDocs(queryRef);
    const total = totalSnapshot.size;

    // Apply pagination
    if (queryParams.offset) {
      const firstPageSnapshot = await getDocs(query(queryRef, limit(queryParams.offset)));
      const lastDoc = firstPageSnapshot.docs[firstPageSnapshot.docs.length - 1];
      queryRef = query(queryRef, startAfter(lastDoc));
    }

    if (queryParams.limit) {
      queryRef = query(queryRef, limit(queryParams.limit));
    }

    const snapshot = await getDocs(queryRef);
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      data,
      total,
      hasMore: data.length === queryParams.limit,
    };
  }

  // Search documents with text search and pagination
  async searchDocuments(
    collectionId: string,
    searchText: string,
    fields: string[],
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    if (!this.db) throw new Error("Database not connected");

    const collectionRef = collection(this.db, collectionId);

    // Create compound query for text search across specified fields
    const queries = fields.map((field) =>
      query(collectionRef, where(field, ">=", searchText), where(field, "<=", searchText + "\uf8ff"))
    );

    // Execute all queries and merge results
    const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
    const allDocs = snapshots.flatMap((snap) => snap.docs);

    // Remove duplicates
    const uniqueDocs = Array.from(new Map(allDocs.map((doc) => [doc.id, doc])).values());

    const total = uniqueDocs.length;
    const start = (page - 1) * pageSize;
    const paginatedDocs = uniqueDocs.slice(start, start + pageSize);

    return {
      data: paginatedDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
      total,
      hasMore: start + pageSize < total,
    };
  }

  async createDocument(collectionId: string, data: any): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const timestamp = new Date();
    const docRef = await addDoc(collection(this.db, collectionId), {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return { id: docRef.id, ...data, createdAt: timestamp, updatedAt: timestamp };
  }

  async updateDocument(collectionId: string, documentId: string, data: any): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = doc(this.db, collectionId, documentId);
    const timestamp = new Date();
    const updateData = {
      ...data,
      updatedAt: timestamp,
    };
    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return { id: updated.id, ...updated.data() };
  }

  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await deleteDoc(doc(this.db, collectionId, documentId));
  }

  // Batch operations
  async batchCreateDocuments(collectionId: string, documents: any[]): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");
    const batch = writeBatch(this.db);
    const timestamp = new Date();
    const results: any[] = [];

    for (const data of documents) {
      const docRef = doc(collection(this.db, collectionId));
      const docData = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      batch.set(docRef, docData);
      results.push({ id: docRef.id, ...docData });
    }

    await batch.commit();
    return results;
  }
}
