import { FieldType, FieldTypeToSettings, ValidationRules } from "@cms/dynamic-forms";

// 1. Collection/Table Definitions Schema
export interface CollectionDefinition {
  id: string;
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
    };
  };
  indexes?: Index[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Field {
  name: string;
  type: FieldType;
  settings: FieldTypeToSettings[FieldType];
  validation?: {
    required?: boolean;
    unique?: boolean;
    rules?: ValidationRules[];
  };
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
  id: string;
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
