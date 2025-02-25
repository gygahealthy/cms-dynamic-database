import { getDatabase, ref, set, get, remove, push, Database } from "firebase/database";
import type { FirebaseApp } from "firebase/app";
import type { FileMetadata, FileUploadResponse } from "../types/file";

export class FileService {
  private static instance: FileService;
  private db: Database | null = null;
  private readonly FILE_PATH = "files";
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

  private constructor() {}

  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  initialize(app: FirebaseApp) {
    this.db = getDatabase(app);
  }

  /**
   * Extracts file extension from filename
   */
  private getFileExtension(fileName: string): string {
    return fileName.split(".").pop()?.toLowerCase() || "";
  }

  /**
   * Validates and processes a base64 file string
   */
  private validateBase64File(base64String: string): {
    isValid: boolean;
    mimeType: string;
    size: number;
    error?: string;
  } {
    try {
      // Check if the string is a valid base64 format
      const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        return { isValid: false, mimeType: "", size: 0, error: "Invalid base64 format" };
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      // Calculate size (base64 string length * 0.75 gives approximate byte size)
      const size = Math.round((base64Data.length * 3) / 4);

      if (size > this.MAX_FILE_SIZE) {
        return {
          isValid: false,
          mimeType,
          size,
          error: `File size (${size} bytes) exceeds maximum allowed size (${this.MAX_FILE_SIZE} bytes)`,
        };
      }

      return { isValid: true, mimeType, size };
    } catch (error) {
      return {
        isValid: false,
        mimeType: "",
        size: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Uploads a base64 file to Firebase Realtime Database
   */
  async uploadFile(base64File: string, fileName: string, folderPath?: string): Promise<FileUploadResponse> {
    if (!this.db) throw new Error("Database not initialized");

    const validation = this.validateBase64File(base64File);
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid file");
    }

    const timestamp = Date.now();
    const filePath = folderPath ? `${this.FILE_PATH}/${folderPath}` : this.FILE_PATH;

    const newFileRef = push(ref(this.db, filePath));
    const fileId = newFileRef.key;

    if (!fileId) {
      throw new Error("Failed to generate file ID");
    }

    const metadata: FileMetadata = {
      id: fileId,
      name: fileName,
      mimeType: validation.mimeType,
      size: validation.size,
      extension: this.getFileExtension(fileName),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const fileData = {
      base64: base64File,
      metadata,
    };

    await set(newFileRef, fileData);

    return {
      id: fileId,
      path: `${filePath}/${fileId}`,
      metadata,
    };
  }

  /**
   * Retrieves a file by its ID
   */
  async getFile(fileId: string, folderPath?: string): Promise<string | null> {
    if (!this.db) throw new Error("Database not initialized");

    const filePath = folderPath ? `${this.FILE_PATH}/${folderPath}/${fileId}` : `${this.FILE_PATH}/${fileId}`;

    const snapshot = await get(ref(this.db, filePath));
    if (!snapshot.exists()) return null;

    const data = snapshot.val();
    return data.base64 || null;
  }

  /**
   * Retrieves file metadata
   */
  async getFileMetadata(fileId: string, folderPath?: string): Promise<FileMetadata | null> {
    if (!this.db) throw new Error("Database not initialized");

    const filePath = folderPath ? `${this.FILE_PATH}/${folderPath}/${fileId}` : `${this.FILE_PATH}/${fileId}`;

    const snapshot = await get(ref(this.db, filePath));
    if (!snapshot.exists()) return null;

    const data = snapshot.val();
    return data.metadata || null;
  }

  /**
   * Updates an existing file
   */
  async updateFile(fileId: string, base64File: string, folderPath?: string): Promise<FileUploadResponse> {
    if (!this.db) throw new Error("Database not initialized");

    const validation = this.validateBase64File(base64File);
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid file");
    }

    const filePath = folderPath ? `${this.FILE_PATH}/${folderPath}/${fileId}` : `${this.FILE_PATH}/${fileId}`;

    // Check if file exists
    const existing = await get(ref(this.db, filePath));
    if (!existing.exists()) {
      throw new Error(`File with ID ${fileId} not found`);
    }

    const existingData = existing.val();
    const timestamp = Date.now();

    const metadata: FileMetadata = {
      ...existingData.metadata,
      mimeType: validation.mimeType,
      size: validation.size,
      updatedAt: timestamp,
    };

    const fileData = {
      base64: base64File,
      metadata,
    };

    await set(ref(this.db, filePath), fileData);

    return {
      id: fileId,
      path: filePath,
      metadata,
    };
  }

  /**
   * Deletes a file
   */
  async deleteFile(fileId: string, folderPath?: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const filePath = folderPath ? `${this.FILE_PATH}/${folderPath}/${fileId}` : `${this.FILE_PATH}/${fileId}`;

    await remove(ref(this.db, filePath));
  }

  /**
   * Lists all files in a folder
   */
  async listFiles(folderPath?: string): Promise<FileMetadata[]> {
    if (!this.db) throw new Error("Database not initialized");

    const filePath = folderPath ? `${this.FILE_PATH}/${folderPath}` : this.FILE_PATH;

    const snapshot = await get(ref(this.db, filePath));
    if (!snapshot.exists()) return [];

    return Object.values(snapshot.val()).map((item: any) => item.metadata as FileMetadata);
  }
}
