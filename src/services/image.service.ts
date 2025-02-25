import { getDatabase, ref, set, get, remove, push, Database } from "firebase/database";
import type { FirebaseApp } from "firebase/app";
import { imageService as formImageService, optimizeImage } from "@cms/dynamic-forms";
import type { ImageMetadata, ImageUploadResponse } from "../types/image";
import { onValue } from "firebase/database";

export class ImageService {
  private static instance: ImageService;
  private db: Database | null = null;
  private readonly TARGET_SIZE_KB = 30;

  private constructor() {}

  static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  initialize(app: FirebaseApp, rtdb?: Database) {
    // Use provided rtdb if available, otherwise get from app
    if (rtdb) {
      this.db = rtdb;
      console.log("Using provided Realtime Database instance");
    } else if (app) {
      try {
        this.db = getDatabase(app);
        console.log("Initialized Realtime Database from app");
      } catch (error) {
        console.error("Failed to initialize Realtime Database:", error);
      }
    }

    // Test database connection if db is available
    if (this.db) {
      const testRef = ref(this.db, ".info/connected");
      onValue(testRef, (snapshot) => {
        console.log("Database connection status:", snapshot.val() ? "Connected" : "Disconnected");
      });
    } else {
      console.warn("No Realtime Database instance available");
    }
  }

  /**
   * Always processes and optimizes image to target size
   */
  private async processImage(image: string | File | Blob): Promise<string> {
    let imageFile: File;

    if (image instanceof File) {
      imageFile = image;
    } else if (image instanceof Blob) {
      imageFile = new File([image], "image");
    } else if (typeof image === "string") {
      const blob = await fetch(image).then((r) => r.blob());
      imageFile = new File([blob], "image");
    } else {
      throw new Error("Invalid image format");
    }

    const { base64 } = await optimizeImage(imageFile, this.TARGET_SIZE_KB);
    return base64;
  }
  // Update the path builder to work directly with collections
  private buildImagePath(collectionId?: string | string[], imageId?: string): string {
    if (!collectionId) {
      throw new Error("Collection ID is required");
    }

    // Handle both string and array of collection paths
    const collections = Array.isArray(collectionId) ? collectionId : [collectionId];
    let basePath = collections.join("/");

    if (imageId) {
      basePath = `${basePath}/${imageId}`;
    }

    return basePath;
  }

  /**
   * Uploads an optimized image
   */
  async uploadImage(
    image: string | File | Blob,
    fileName: string,
    collectionId?: string | string[]
  ): Promise<ImageUploadResponse> {
    if (!this.db) throw new Error("Database not initialized");

    console.log(`Starting image upload for ${fileName} to collection:`, collectionId);
    console.log("Image type:", typeof image === "string" ? "String" : "File/Blob");

    try {
      console.log("Processing image to target size of 30KB");
      const processedBase64 = await this.processImage(image);
      console.log("Image processed successfully, base64 length:", processedBase64.length, "chars");

      const imagePath = this.buildImagePath(collectionId);
      console.log(`Built image path: ${imagePath}`);

      // Verify the database reference
      const dbRef = ref(this.db, imagePath);

      // Generate a new push ID
      const newImageRef = push(dbRef);
      const imageId = newImageRef.key;
      console.log(`Generated image ID: ${imageId}`);

      if (!imageId) throw new Error("Failed to generate image ID");

      const timestamp = Date.now();
      const size = Math.round((processedBase64.length * 3) / 4);
      console.log(`Calculated image size: ${size} bytes (${Math.round(size / 1024)}KB)`);

      const metadata = {
        id: imageId,
        name: fileName,
        size: size,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      console.log("Created metadata:", metadata);

      const imageData = {
        base64: processedBase64,
        metadata,
      };

      console.log(`Saving image to database at path: ${imagePath}/${imageId}`);

      // Add more detailed error handling for the set operation
      try {
        console.log("Starting database set operation...");
        await set(newImageRef, imageData);
        console.log("Database set operation completed successfully");

        // Verify the data was saved
        console.log("Verifying data was saved...");
        const checkRef = ref(this.db, `${imagePath}/${imageId}`);
        const snapshot = await get(checkRef);

        if (snapshot.exists()) {
          console.log("Verification successful: Data exists in database");
        } else {
          console.warn("Verification failed: Data not found in database after save");
        }
      } catch (setError) {
        console.error("Database set operation failed with error:", setError);
        if (setError instanceof Error) {
          console.error("Error name:", setError.name);
          console.error("Error message:", setError.message);
          console.error("Error stack:", setError.stack);
        }
        throw new Error(`Failed to save image: ${setError instanceof Error ? setError.message : "Unknown error"}`);
      }

      const fullUrl = `${imagePath}/${imageId}`;
      console.log("Upload completed successfully, returning URL:", fullUrl);

      return {
        id: imageId,
        url: fullUrl,
        metadata,
      };
    } catch (error) {
      console.error(`Image upload failed with error:`, error);
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw error;
    }
  }

  /**
   * Retrieves an image by its ID or full path
   */
  async getImage(imageIdOrPath: string, collectionId?: string | string[]): Promise<string | null> {
    if (!this.db) throw new Error("Database not initialized");

    let imagePath: string;

    // Check if imageIdOrPath is a full path (contains a slash)
    if (imageIdOrPath.includes("/")) {
      // Use the provided path directly
      imagePath = imageIdOrPath;
    } else {
      // Build the path using the collection ID and image ID
      imagePath = this.buildImagePath(collectionId, imageIdOrPath);
    }

    console.log(`Getting image from path: ${imagePath}`);

    try {
      const snapshot = await get(ref(this.db, imagePath));
      if (!snapshot.exists()) {
        console.log(`No image found at path: ${imagePath}`);
        return null;
      }

      const data = snapshot.val();

      // Handle different data structures
      if (data.base64) {
        console.log(`Found image with base64 data at: ${imagePath}`);
        return data.base64;
      } else if (data.metadata) {
        // This might be the parent object that contains base64 as a child
        console.log(`Found image with metadata at: ${imagePath}`);
        return data.base64 || null;
      } else {
        console.log(`Image data found but no base64 content at: ${imagePath}`);
        return null;
      }
    } catch (error) {
      console.error(`Error retrieving image from ${imagePath}:`, error);
      return null;
    }
  }

  /**
   * Retrieves image metadata
   */
  async getImageMetadata(imageIdOrPath: string, collectionId?: string | string[]): Promise<ImageMetadata | null> {
    if (!this.db) throw new Error("Database not initialized");

    let imagePath: string;

    // Check if imageIdOrPath is a full path (contains a slash)
    if (imageIdOrPath.includes("/")) {
      // Use the provided path directly
      imagePath = imageIdOrPath;
    } else {
      // Build the path using the collection ID and image ID
      imagePath = this.buildImagePath(collectionId, imageIdOrPath);
    }

    try {
      const snapshot = await get(ref(this.db, imagePath));
      if (!snapshot.exists()) return null;

      const data = snapshot.val();

      // Handle different data structures
      if (data.metadata) {
        return data.metadata;
      } else if (data.id) {
        // The data itself might be the metadata
        return data;
      }

      return null;
    } catch (error) {
      console.error(`Error retrieving image metadata from ${imagePath}:`, error);
      return null;
    }
  }

  /**
   * Updates an existing image
   */
  async updateImage(
    imageId: string,
    image: string | File | Blob,
    collectionId?: string | string[]
  ): Promise<ImageUploadResponse> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const processedBase64 = await this.processImage(image);
      const imagePath = this.buildImagePath(collectionId, imageId);

      // Check if image exists
      const existing = await get(ref(this.db, imagePath));
      if (!existing.exists()) {
        throw new Error(`Image with ID ${imageId} not found`);
      }

      const existingData = existing.val();
      const timestamp = Date.now();

      // Get new dimensions
      const dimensions = await formImageService.getDimensions(processedBase64);

      const metadata: ImageMetadata = {
        ...existingData.metadata,
        size: Math.round((processedBase64.length * 3) / 4),
        updatedAt: timestamp,
        dimensions,
      };

      const imageData = {
        base64: processedBase64,
        metadata,
      };

      await set(ref(this.db, imagePath), imageData);

      return {
        id: imageId,
        url: imagePath,
        metadata,
      };
    } catch (error) {
      throw new Error(`Update failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Deletes an image
   */
  async deleteImage(imageId: string, collectionId?: string | string[]): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const imagePath = this.buildImagePath(collectionId, imageId);

    await remove(ref(this.db, imagePath));
  }

  /**
   * Lists all images in a collection
   */
  async listImages(collectionId?: string | string[]): Promise<ImageMetadata[]> {
    if (!this.db) throw new Error("Database not initialized");

    const imagePath = this.buildImagePath(collectionId);

    const snapshot = await get(ref(this.db, imagePath));
    if (!snapshot.exists()) return [];

    return Object.values(snapshot.val()).map((item: any) => item.metadata as ImageMetadata);
  }
}
