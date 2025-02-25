import { DatabaseService } from "./database";
import { ImageMetadata, ImageUploadResponse } from "./image";
import { FileMetadata, FileUploadResponse } from "./file";

export interface StorageUsage {
  realtimeDatabase: {
    storageUsed: number;
    storageLimit: number;
    downloadUsed: number;
    downloadLimit: number;
    uploadUsed: number;
    uploadLimit: number;
  };
  firestore: {
    storageUsed: number;
    storageLimit: number;
    readOpsUsed: number;
    readOpsLimit: number;
    writeOpsUsed: number;
    writeOpsLimit: number;
    deleteOpsUsed: number;
    deleteOpsLimit: number;
  };
}

export interface UsageAlert {
  type: "realtime" | "firestore";
  metric: string;
  usage: number;
  limit: number;
  percentage: number;
}

// Extended Firebase-specific service interface
export interface FirebaseDatabaseService extends DatabaseService {
  // ===========================================================================
  // Image Operations
  // ===========================================================================
  uploadImage(
    image: string | File | Blob,
    fileName: string,
    collectionId?: string,
    options?: {
      maxSizeKB?: number;
      format?: string;
      quality?: number;
      rotation?: number;
      crop?: { x: number; y: number; width: number; height: number };
    }
  ): Promise<ImageUploadResponse>;

  getImage(imageId: string, collectionId?: string): Promise<string | null>;
  getImageMetadata(imageId: string, collectionId?: string): Promise<ImageMetadata | null>;
  updateImage(
    imageId: string,
    image: string | File | Blob,
    collectionId?: string,
    options?: {
      maxSizeKB?: number;
      format?: string;
      quality?: number;
      rotation?: number;
      crop?: { x: number; y: number; width: number; height: number };
    }
  ): Promise<ImageUploadResponse>;
  deleteImage(imageId: string, collectionId?: string): Promise<void>;
  listImages(collectionId?: string): Promise<ImageMetadata[]>;

  // ===========================================================================
  // File Operations
  // ===========================================================================

  uploadFile(base64File: string, fileName: string, folderPath?: string): Promise<FileUploadResponse>;
  getFile(fileId: string, folderPath?: string): Promise<string | null>;
  getFileMetadata(fileId: string, folderPath?: string): Promise<FileMetadata | null>;
  updateFile(fileId: string, base64File: string, folderPath?: string): Promise<FileUploadResponse>;
  deleteFile(fileId: string, folderPath?: string): Promise<void>;
  listFiles(folderPath?: string): Promise<FileMetadata[]>;

  // ===========================================================================
  // Usage Monitoring
  // ===========================================================================

  getUsageStats(): Promise<{
    usage: StorageUsage;
    alerts: UsageAlert[];
    recommendations: string[];
  }>;

  checkOperationFeasibility(operation: {
    type: "read" | "write" | "delete";
    size?: number;
    database: "realtime" | "firestore";
  }): Promise<{
    feasible: boolean;
    reason?: string;
  }>;
}
