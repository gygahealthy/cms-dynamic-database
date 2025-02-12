# @cms/dynamic-database

A flexible database abstraction layer supporting Firebase, MongoDB, and AWS DynamoDB for CMS operations.

## Installation

```bash
npm install @cms/dynamic-database
```

## Features

- 🔌 Multiple database support (Firebase, MongoDB, DynamoDB)
- 🔄 Unified API across different databases
- 📝 Full TypeScript support
- 🔍 Advanced querying capabilities
- 📋 Collection schema management
- 🔒 Type-safe operations

## Usage

### Initialize Database

```typescript
import { createDatabase, DatabaseConfig } from "@cms/dynamic-database";
// Firebase
const firebaseConfig: DatabaseConfig = {
  type: "firebase",
  credentials: {
    apiKey: "your-api-key",
    projectId: "your-project-id",
  },
};
// MongoDB
const mongoConfig: DatabaseConfig = {
  type: "mongodb",
  credentials: {
    uri: "mongodb://localhost:27017/your-database",
  },
};
// AWS DynamoDB
const dynamoConfig: DatabaseConfig = {
  type: "dynamodb",
  credentials: {
    accessKeyId: "your-access-key",
    secretAccessKey: "your-secret-key",
    region: "us-east-1",
  },
};
const db = createDatabase(firebaseConfig);
await db.connect();
```

### Collection Operations

```typescript
// Create collection
const collection = await db.createCollection({
  name: "Products",
  slug: "products",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
  ],
});
// Query documents
const results = await db.queryDocuments("products", {
  where: [
    ["price", "gt", 100],
    ["category", "eq", "electronics"],
  ],
  orderBy: [["price", "desc"]],
  limit: 10,
});
// Search documents
const searchResults = await db.searchDocuments("products", "phone", ["title", "description"], 1, 20);
```

### Document Operations

```typescript
// Create document
const product = await db.createDocument("products", {
  title: "Smartphone",
  price: 999.99,
});
// Update document
await db.updateDocument("products", product.id, {
  price: 899.99,
});
// Delete document
await db.deleteDocument("products", product.id);
```

## API Reference

### Database Operations

- `connect()`: Initialize database connection
- `disconnect()`: Close database connection

### Collection Operations

- `getCollection(id: string)`: Get collection by ID
- `listCollections()`: List all collections
- `createCollection(data: CollectionData)`: Create new collection
- `updateCollection(id: string, data: Partial<Collection>)`: Update collection
- `deleteCollection(id: string)`: Delete collection

### Document Operations

- `getDocument(collectionId: string, documentId: string)`: Get document
- `queryDocuments(collectionId: string, query: QueryParams)`: Query documents
- `searchDocuments(collectionId: string, text: string, fields: string[])`: Search documents
- `createDocument(collectionId: string, data: any)`: Create document
- `updateDocument(collectionId: string, documentId: string, data: any)`: Update document
- `deleteDocument(collectionId: string, documentId: string)`: Delete document
- `batchCreateDocuments(collectionId: string, documents: any[])`: Batch create documents

## License

MIT
