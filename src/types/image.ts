export interface ImageMetadata {
  id: string;
  name: string;
  mimeType?: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface ImageUploadResponse {
  id: string;
  url: string;
  metadata: ImageMetadata;
}
