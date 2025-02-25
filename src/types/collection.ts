import { FieldType, FieldTypeToSettings } from "@cms/dynamic-forms";

// 1. Collection/Table Definitions Schema
export interface CollectionDefinition {
  id: string;
  fid?: string;
  name: string;
  slug: string;
  description?: string;
  fields: Field[];
  timestamps: boolean;
  settings: {
    isPublic: boolean; // Access control
    isSoftDelete: boolean; // Support for soft deletion
    versioning: boolean; // Enable version control
    hooks?: {
      beforeCreate?: string;
      afterCreate?: string;
      beforeUpdate?: string;
      afterUpdate?: string;
      beforeDelete?: string;
      afterDelete?: string;
      beforeRestore?: string;
      afterRestore?: string;
    };
    permissions?: {
      create?: string[]; // Role IDs or user IDs that can create
      read?: string[]; // Role IDs or user IDs that can read
      update?: string[]; // Role IDs or user IDs that can update
      delete?: string[]; // Role IDs or user IDs that can delete
      admin?: string[]; // Role IDs or user IDs with full access
    };
    audit?: {
      enabled: boolean; // Track all changes
      retention?: number; // Days to keep audit logs
      detailed?: boolean; // Include old/new values in logs
    };
    cache?: {
      enabled: boolean; // Enable caching for this collection
      ttl?: number; // Time to live in seconds
      strategy?: "memory" | "redis" | "custom";
    };
    api?: {
      enabled: boolean; // Expose REST API endpoints
      methods?: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
      rateLimit?: {
        requests: number; // Number of requests
        period: number; // Time period in seconds
      };
    };
    validation?: {
      customValidators?: string[]; // Custom validation function names
      skipValidation?: boolean; // Skip validation for trusted operations
    };
  };
  indexes?: Index[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Field {
  name: string;
  type: FieldType;
  settings: FieldTypeToSettings[keyof FieldTypeToSettings];
  defaultValue?: any;
  isSearchable?: boolean;
  isSortable?: boolean;
}

export interface Index {
  fields: string[];
  type: "unique" | "index";
}

// 2. Collection Data Schema
// Stored in: data/{collectionSlug}/{documentId}
export interface CollectionData {
  fid: string;
  [key: string]: any; // Dynamic fields based on collection definition
  _metadata: {
    version?: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string;
    deletedAt?: Date;
  };
}
