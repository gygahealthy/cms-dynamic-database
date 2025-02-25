import { collection, doc, getDocs, getDoc, updateDoc, writeBatch, setDoc, where, query, Firestore } from "firebase/firestore";
import type { CollectionDefinition as Collection } from "../types/collection";
import { serializeForFirestore } from "../utils/firestore";
const COLLECTIONS_PATH = "collections";

function generateCollectionId(name: string): string {
  const shortId = Math.random().toString(36).substring(2, 9);
  return `${name.toLowerCase()}_${shortId}`;
}

export class CollectionService {
  private static instance: CollectionService;
  private db: Firestore | null = null;

  private constructor() {}

  static getInstance(): CollectionService {
    if (!CollectionService.instance) {
      CollectionService.instance = new CollectionService();
    }
    return CollectionService.instance;
  }

  setDb(db: Firestore) {
    this.db = db;
  }

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
      const normalizedName = collectionData.name.toLowerCase().trim();
      const existingQuery = query(collection(this.db, COLLECTIONS_PATH), where("name", "==", normalizedName));
      const existing = await getDocs(existingQuery);

      if (!existing.empty) {
        const existingDoc = existing.docs[0];
        const existingData = existingDoc.data();
        return {
          ...existingData,
          id: existingData.id || existingDoc.id,
          fid: existingDoc.id,
          name: normalizedName,
        } as Collection;
      }

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
      const serializedCollection = serializeForFirestore(newCollection);
      await setDoc(collectionRef, serializedCollection);

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
    const serializedUpdateData = serializeForFirestore(updateData);
    await updateDoc(docRef, serializedUpdateData);
    const updated = await getDoc(docRef);
    return { id: updated.id, ...updated.data() } as Collection;
  }

  async deleteCollection(collectionId: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");

    try {
      const collectionRef = doc(this.db, COLLECTIONS_PATH, collectionId);
      const collectionDoc = await getDoc(collectionRef);

      if (!collectionDoc.exists()) {
        throw new Error(`Collection ${collectionId} not found`);
      }

      const collectionData = collectionDoc.data();
      const batch = writeBatch(this.db);

      const dataSnapshot = await getDocs(collection(this.db, collectionData.id));

      if (!dataSnapshot.empty) {
        dataSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      batch.delete(collectionRef);
      await batch.commit();
    } catch (error) {
      console.error("Error in deleteCollection:", error);
      throw error;
    }
  }
}
