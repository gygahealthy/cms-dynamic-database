export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  extension: string;
  createdAt: number;
  updatedAt: number;
}

export interface FileUploadResponse {
  id: string;
  path: string;
  metadata: FileMetadata;
}
