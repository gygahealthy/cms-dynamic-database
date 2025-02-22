import { initializeApp, FirebaseApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Firestore,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { getAuth, signInAnonymously, Auth } from "firebase/auth";
import type { DatabaseService, DatabaseConfig, QueryParams } from "../types/database";
import type { CollectionDefinition as Collection } from "../types/collection";

const COLLECTIONS_PATH = "collections";

function generateCollectionId(name: string): string {
  const shortId = Math.random().toString(36).substring(2, 9);
  return `${name.toLowerCase()}_${shortId}`;
}

export class FirebaseService implements DatabaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private auth: Auth | null = null;
  private isConnecting: boolean = false;

  //============================================================================
  // Database Connection Methods
  //============================================================================

  async getDatabase(): Promise<Firestore> {
    if (!this.db) throw new Error("Database not connected");
    return this.db;
  }

  async connect(config: DatabaseConfig): Promise<void> {
    if (this.isConnecting) {
      console.log("Connection already in progress, skipping duplicate attempt");
      return;
    }

    if (!config.credentials.projectId) {
      throw new Error("Firebase project ID is required");
    }

    this.isConnecting = true;

    try {
      // Clean up existing connection if any
      if (this.app) {
        await this.disconnect();
      }

      console.log("Connecting to Firebase project:", {
        projectId: config.credentials.projectId,
        authDomain: config.credentials.authDomain,
        authEnabled: Boolean(config.credentials.apiKey),
      });

      // Initialize Firebase with the full config
      const firebaseConfig = {
        apiKey: config.credentials.apiKey,
        authDomain: config.credentials.authDomain,
        projectId: config.credentials.projectId,
        storageBucket: config.credentials.storageBucket,
        messagingSenderId: config.credentials.messagingSenderId,
        appId: config.credentials.appId,
        measurementId: config.credentials.measurementId,
      };

      // Initialize app with unique name
      const appName = `${config.credentials.projectId}-${Date.now()}`;
      this.app = initializeApp(firebaseConfig, appName);

      // Get Firestore instance
      this.db = getFirestore(this.app);

      // Try authentication but don't fail if it's not configured
      if (config.credentials.apiKey) {
        this.auth = getAuth(this.app);
        try {
          await signInAnonymously(this.auth);
          console.log(`✅ Connected with authentication: ${config.credentials.projectId}`);
        } catch (authError) {
          console.warn(
            `⚠️ Authentication failed, continuing in public mode: ${
              authError instanceof Error ? authError.message : "Unknown error"
            }`
          );
          // Continue without authentication
        }
      }

      console.log(`📦 Connected to Firebase project: ${config.credentials.projectId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Firebase initialization error:", error);
      throw new Error(`Failed to initialize Firebase: ${errorMessage}`);
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    // Sign out if authenticated
    if (this.auth) {
      try {
        await this.auth.signOut();
      } catch (error) {
        console.warn("Error signing out:", error);
      }
    }

    // Delete the Firebase app instance
    if (this.app) {
      try {
        await deleteApp(this.app);
      } catch (error) {
        console.warn("Error deleting Firebase app:", error);
      }
    }

    this.app = null;
    this.db = null;
    this.auth = null;
  }

  //============================================================================
  // Collection Definition Methods
  //============================================================================

  async getAllCollections(): Promise<Collection[]> {
    if (!this.db) throw new Error("Database not connected");
    const snapshot = await getDocs(collection(this.db, COLLECTIONS_PATH));
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.data().id || doc.id,
          fid: doc.id,
          ...doc.data(),
        } as Collection)
    );
  }

  async getCollections(collectionIds: string[]): Promise<Collection[]> {
    if (!this.db) throw new Error("Database not connected");
    const collectionsRef = collection(this.db, COLLECTIONS_PATH);
    const q = query(collectionsRef, where("name", "in", collectionIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.data().id || doc.id,
          fid: doc.id,
          ...doc.data(),
        } as Collection)
    );
  }

  async getCollection(collectionId: string): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = doc(this.db, COLLECTIONS_PATH, collectionId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    return {
      id: docSnap.data().id || docSnap.id,
      fid: docSnap.id,
      ...docSnap.data(),
    } as Collection;
  }

  async createCollection(collectionData: Omit<Collection, "id" | "fid">, mockData?: any[]): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");

    try {
      // Normalize the collection name
      const normalizedName = collectionData.name.toLowerCase().trim();

      // First check if collection with this name already exists
      const existingQuery = query(collection(this.db, COLLECTIONS_PATH), where("name", "==", normalizedName));
      const existing = await getDocs(existingQuery);

      if (!existing.empty) {
        const existingDoc = existing.docs[0];
        const existingData = existingDoc.data();

        // Return the existing collection with both id and fid
        return {
          ...existingData,
          id: existingData.id || existingDoc.id,
          fid: existingDoc.id,
          name: normalizedName,
        } as Collection;
      }

      // Only create a new collection if one doesn't exist
      const timestamp = new Date();
      const generatedId = generateCollectionId(normalizedName);
      const collectionRef = doc(collection(this.db, COLLECTIONS_PATH));

      const newCollection = {
        ...collectionData,
        id: generatedId,
        fid: collectionRef.id,
        name: normalizedName,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await setDoc(collectionRef, newCollection);

      // Handle mock data if provided
      if (mockData && mockData.length > 0) {
        const dataCollectionRef = collection(this.db, generatedId);
        const batch = writeBatch(this.db);

        mockData.forEach((item) => {
          const docRef = doc(dataCollectionRef);
          batch.set(docRef, { ...item, fid: docRef.id, createdAt: timestamp, updatedAt: timestamp });
        });

        await batch.commit();
      }

      return newCollection;
    } catch (error) {
      console.error("Error in createCollection:", error);
      throw error;
    }
  }

  async updateCollection(id: string, collection: Partial<Collection>): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");
    const docRef = doc(this.db, COLLECTIONS_PATH, id);
    const updateData = { ...collection, updatedAt: new Date() };
    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return { id: updated.id, ...updated.data() } as Collection;
  }

  async deleteCollection(collectionId: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");

    try {
      // Get collection definition from 'collections'
      const collectionRef = doc(this.db, COLLECTIONS_PATH, collectionId);
      const collectionDoc = await getDoc(collectionRef);

      if (!collectionDoc.exists()) {
        throw new Error(`Collection ${collectionId} not found`);
      }

      const collectionData = collectionDoc.data();
      const batch = writeBatch(this.db);

      // Delete all documents in the collection using the collection's generated ID
      const dataSnapshot = await getDocs(collection(this.db, collectionData.id));

      if (!dataSnapshot.empty) {
        dataSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      // Delete the collection definition
      batch.delete(collectionRef);

      await batch.commit();
    } catch (error) {
      console.error("Error in deleteCollection:", error);
      throw error;
    }
  }

  //============================================================================
  // Single Document Operations
  //============================================================================

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
    const docRef = doc(this.db, collectionId, documentId);
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return updated.data();
  }

  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await deleteDoc(doc(this.db, collectionId, documentId));
  }

  //============================================================================
  // Batch Document Operations
  //============================================================================

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

  //============================================================================
  // Query and Search Operations
  //============================================================================

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
      data: paginatedDocs.map((doc) => doc.data()),
      total,
      hasMore: start + pageSize < total,
    };
  }
}
