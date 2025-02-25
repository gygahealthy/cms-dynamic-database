import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Firestore,
} from "firebase/firestore";
import type { QueryParams } from "../types/database";

export class DocumentService {
  private static instance: DocumentService;
  private db: Firestore | null = null;

  private constructor() {}

  static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }

  setDb(db: Firestore) {
    this.db = db;
  }

  async getDocument(collectionId: string, documentId: string): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = doc(this.db, collectionId, documentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data();
  }

  async createDocument(collectionId: string, data: any): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = doc(collection(this.db, collectionId));
    const timestamp = new Date();
    const documentData = {
      ...data,
      fid: docRef.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await setDoc(docRef, documentData);
    return { fid: docRef.id, ...documentData };
  }

  async updateDocument(collectionId: string, documentId: string, data: any): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    if (!documentId) throw new Error("Document ID is required for update");

    const { fid, ...updateData } = data;
    const docRef = doc(this.db, collectionId, documentId);
    const finalUpdateData = {
      ...updateData,
      updatedAt: new Date(),
    };

    await updateDoc(docRef, finalUpdateData);
    const updated = await getDoc(docRef);
    return {
      fid: updated.id,
      ...updated.data(),
    };
  }

  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await deleteDoc(doc(this.db, collectionId, documentId));
  }

  async batchCreateDocuments(collectionId: string, documents: any[]): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");
    const batch = writeBatch(this.db);
    const timestamp = new Date();
    const results: any[] = [];

    for (const data of documents) {
      const docRef = doc(collection(this.db, collectionId));
      const documentData = {
        ...data,
        fid: docRef.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      batch.set(docRef, documentData);
      results.push(documentData);
    }

    await batch.commit();
    return results;
  }

  async batchUpdateDocuments(collectionId: string, documents: { id: string; data: any }[]): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");
    const batch = writeBatch(this.db);
    const timestamp = new Date();
    const results: any[] = [];

    for (const { id, data } of documents) {
      const docRef = doc(this.db, collectionId, id);
      const updateData = {
        ...data,
        updatedAt: timestamp,
      };
      batch.update(docRef, updateData);
      results.push({ id, ...updateData });
    }

    await batch.commit();
    return results;
  }

  async batchDeleteDocuments(collectionId: string, documentIds: string[]): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    const batch = writeBatch(this.db);

    documentIds.forEach((docId) => {
      const docRef = doc(this.db!, collectionId, docId);
      batch.delete(docRef);
    });

    await batch.commit();
  }

  async queryDocuments(
    collectionId: string,
    queryParams: QueryParams
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    if (!this.db) throw new Error("Database not connected");

    const collectionRef = collection(this.db, collectionId);
    let queryRef = query(collectionRef);

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

    if (queryParams.orderBy) {
      for (const [field, direction] of queryParams.orderBy) {
        queryRef = query(queryRef, orderBy(field, direction));
      }
    }

    const totalSnapshot = await getDocs(queryRef);
    const total = totalSnapshot.size;

    if (queryParams.offset) {
      const firstPageSnapshot = await getDocs(query(queryRef, limit(queryParams.offset)));
      const lastDoc = firstPageSnapshot.docs[firstPageSnapshot.docs.length - 1];
      queryRef = query(queryRef, startAfter(lastDoc));
    }

    if (queryParams.limit) {
      queryRef = query(queryRef, limit(queryParams.limit));
    }

    const snapshot = await getDocs(queryRef);
    const data = snapshot.docs.map((doc) => doc.data());

    return {
      data,
      total,
      hasMore: data.length === queryParams.limit,
    };
  }

  async searchDocuments(
    collectionId: string,
    searchText: string,
    fields: string[],
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    if (!this.db) throw new Error("Database not connected");

    const collectionRef = collection(this.db, collectionId);
    const queries = fields.map((field) =>
      query(collectionRef, where(field, ">=", searchText), where(field, "<=", searchText + "\uf8ff"))
    );

    const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
    const allDocs = snapshots.flatMap((snap) => snap.docs);
    const uniqueDocs = Array.from(new Map(allDocs.map((doc) => [doc.id, doc])).values());

    const total = uniqueDocs.length;
    const start = (page - 1) * pageSize;
    const paginatedDocs = uniqueDocs.slice(start, start + pageSize);

    return {
      data: paginatedDocs.map((doc) => doc.data()),
      total,
      hasMore: start + pageSize < total,
    };
  }
}
