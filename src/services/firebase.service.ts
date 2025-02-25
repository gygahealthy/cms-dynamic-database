import { initializeApp, FirebaseApp, deleteApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";
import { getAuth, signInAnonymously, Auth } from "firebase/auth";
// Types
import type { DatabaseConfig, QueryParams } from "../types/database";
import type { CollectionDefinition as Collection } from "../types/collection";
import { FirebaseDatabaseService } from "../types/firebase";
// Services
import { CollectionService } from "./collection.service";
import { DocumentService } from "./document.service";
import { ImageService } from "./image.service";
import { FileService } from "./file.service";
import { FreePlanService } from "./freeplan.service";

export class FirebaseService implements FirebaseDatabaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private rtdb: Database | null = null;
  private auth: Auth | null = null;
  private isConnecting: boolean = false;
  private collectionService: CollectionService;
  private documentService: DocumentService;
  private imageService: ImageService;
  private fileService: FileService;
  private freePlanService: FreePlanService;

  constructor() {
    this.collectionService = CollectionService.getInstance();
    this.documentService = DocumentService.getInstance();
    this.imageService = ImageService.getInstance();
    this.fileService = FileService.getInstance();
    this.freePlanService = FreePlanService.getInstance();
  }

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

      // Initialize Firebase with the full config
      const firebaseConfig = {
        apiKey: config.credentials.apiKey,
        authDomain: config.credentials.authDomain,
        projectId: config.credentials.projectId,
        databaseURL: config.credentials.databaseURL,
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

      // Get Realtime Database instance if databaseURL is provided
      if (config.credentials.databaseURL) {
        try {
          this.rtdb = getDatabase(this.app);
          console.log(`✅ Connected to Realtime Database: ${config.credentials.databaseURL}`);
        } catch (rtdbError) {
          console.warn(
            `⚠️ Realtime Database initialization failed: ${rtdbError instanceof Error ? rtdbError.message : "Unknown error"}`
          );
        }
      }

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

      this.initializeServices();
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
    this.rtdb = null;
    this.auth = null;
  }

  private initializeServices() {
    if (!this.app) throw new Error("Firebase app not initialized");
    if (!this.db) throw new Error("Firestore not initialized");

    // Pass both Firestore and Realtime Database to services that need them
    this.collectionService.setDb(this.db);
    this.documentService.setDb(this.db);
    this.imageService.initialize(this.app, this.rtdb || undefined);
    this.fileService.initialize(this.app);
    this.freePlanService.initialize(this.app);
  }

  //============================================================================
  // Collection Definition Methods
  //============================================================================

  async getAllCollections(): Promise<Collection[]> {
    return this.collectionService.getAllCollections();
  }

  async getCollections(collectionIds: string[]): Promise<Collection[]> {
    return this.collectionService.getCollections(collectionIds);
  }

  async getCollection(collectionId: string): Promise<Collection> {
    return this.collectionService.getCollection(collectionId);
  }

  async createCollection(collectionData: Omit<Collection, "id" | "fid">, mockData?: any[]): Promise<Collection> {
    return this.collectionService.createCollection(collectionData, mockData);
  }

  async updateCollection(id: string, collection: Partial<Collection>): Promise<Collection> {
    return this.collectionService.updateCollection(id, collection);
  }

  async deleteCollection(collectionId: string): Promise<void> {
    return this.collectionService.deleteCollection(collectionId);
  }

  //============================================================================
  // Single Document Operations
  //============================================================================

  async getDocument(collectionId: string, documentId: string): Promise<any> {
    return this.documentService.getDocument(collectionId, documentId);
  }

  async createDocument(collectionId: string, data: any): Promise<any> {
    return this.documentService.createDocument(collectionId, data);
  }

  async updateDocument(collectionId: string, documentId: string, data: any): Promise<any> {
    return this.documentService.updateDocument(collectionId, documentId, data);
  }

  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    return this.documentService.deleteDocument(collectionId, documentId);
  }

  //============================================================================
  // Batch Document Operations
  //============================================================================

  async batchCreateDocuments(collectionId: string, documents: any[]): Promise<any[]> {
    return this.documentService.batchCreateDocuments(collectionId, documents);
  }

  async batchUpdateDocuments(collectionId: string, documents: { id: string; data: any }[]): Promise<any[]> {
    return this.documentService.batchUpdateDocuments(collectionId, documents);
  }

  async batchDeleteDocuments(collectionId: string, documentIds: string[]): Promise<void> {
    return this.documentService.batchDeleteDocuments(collectionId, documentIds);
  }

  //============================================================================
  // Query and Search Operations
  //============================================================================

  async queryDocuments(
    collectionId: string,
    queryParams: QueryParams
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    return this.documentService.queryDocuments(collectionId, queryParams);
  }

  async searchDocuments(
    collectionId: string,
    searchText: string,
    fields: string[],
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    return this.documentService.searchDocuments(collectionId, searchText, fields, page, pageSize);
  }

  //============================================================================
  // Image Service Methods
  //============================================================================
  async uploadImage(base64Image: string, fileName: string, collectionId?: string) {
    return this.imageService.uploadImage(base64Image, fileName, collectionId);
  }

  async getImage(imageId: string, collectionId?: string) {
    return this.imageService.getImage(imageId, collectionId);
  }

  async getImageMetadata(imageId: string, collectionId?: string) {
    return this.imageService.getImageMetadata(imageId, collectionId);
  }

  async updateImage(imageId: string, base64Image: string, collectionId?: string) {
    return this.imageService.updateImage(imageId, base64Image, collectionId);
  }

  async deleteImage(imageId: string, collectionId?: string) {
    return this.imageService.deleteImage(imageId, collectionId);
  }

  async listImages(collectionId?: string) {
    return this.imageService.listImages(collectionId);
  }

  //============================================================================
  // File Service Methods
  //============================================================================
  async uploadFile(base64File: string, fileName: string, folderPath?: string) {
    return this.fileService.uploadFile(base64File, fileName, folderPath);
  }

  async getFile(fileId: string, folderPath?: string) {
    return this.fileService.getFile(fileId, folderPath);
  }

  async getFileMetadata(fileId: string, folderPath?: string) {
    return this.fileService.getFileMetadata(fileId, folderPath);
  }

  async updateFile(fileId: string, base64File: string, folderPath?: string) {
    return this.fileService.updateFile(fileId, base64File, folderPath);
  }

  async deleteFile(fileId: string, folderPath?: string) {
    return this.fileService.deleteFile(fileId, folderPath);
  }

  async listFiles(folderPath?: string) {
    return this.fileService.listFiles(folderPath);
  }

  //============================================================================
  // Usage Monitoring Methods
  //============================================================================

  async getUsageStats() {
    return this.freePlanService.getUsageStats();
  }

  async checkOperationFeasibility(operation: {
    type: "read" | "write" | "delete";
    size?: number;
    database: "realtime" | "firestore";
  }) {
    return this.freePlanService.checkOperationFeasibility(operation);
  }
}
