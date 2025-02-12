import { MongoClient, Db } from "mongodb";
import type { DatabaseService, DatabaseConfig, QueryParams } from "../types/database";
import type { CollectionDefinition as Collection } from "../types/collection";

export class MongoDBService implements DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  // === Connection Management ===
  async connect(config: DatabaseConfig): Promise<void> {
    if (!config.credentials.uri) throw new Error("MongoDB URI missing");
    this.client = await MongoClient.connect(config.credentials.uri);
    this.db = this.client.db();
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  // === Collection Schema Management ===
  async getCollection(collectionId: string): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");
    const result = await this.db.collection("collections").findOne({ id: collectionId });
    if (!result) throw new Error("Collection not found");
    const { _id, ...collectionData } = result;
    return collectionData as unknown as Collection;
  }

  async listCollections(): Promise<Collection[]> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db.collection("collections").find().toArray()) as unknown as Collection[];
  }

  async createCollection(collectionData: Omit<Collection, "id">): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");
    const { insertedId } = await this.db.collection("collections").insertOne({
      ...collectionData,
      id: new Date().getTime().toString(),
    });
    return this.getCollection(insertedId.toString());
  }

  async updateCollection(id: string, collection: Partial<Collection>): Promise<Collection> {
    if (!this.db) throw new Error("Database not connected");
    await this.db.collection("collections").updateOne({ id }, { $set: collection });
    return this.getCollection(id);
  }

  async deleteCollection(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await this.db.collection("collections").deleteOne({ id });
  }

  // === Document Management ===
  async getDocument(collectionId: string, documentId: string): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    return await this.db.collection(collectionId).findOne({ id: documentId });
  }

  async queryDocuments(
    collectionId: string,
    queryParams: QueryParams
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    if (!this.db) throw new Error("Database not connected");

    let query = this.db.collection(collectionId).find();

    // Apply filters
    if (queryParams.where) {
      const filter = queryParams.where.reduce((acc: any, [field, operator, value]) => {
        switch (operator) {
          case "eq":
            acc[field] = value;
            break;
          case "gt":
            acc[field] = { $gt: value };
            break;
          case "lt":
            acc[field] = { $lt: value };
            break;
          case "contains":
            acc[field] = { $regex: value, $options: "i" };
            break;
        }
        return acc;
      }, {});
      query = query.filter(filter);
    }

    // Apply sorting
    if (queryParams.orderBy) {
      const sort = queryParams.orderBy.reduce((acc: any, [field, direction]) => {
        acc[field] = direction === "asc" ? 1 : -1;
        return acc;
      }, {});
      query = query.sort(sort);
    }

    const total = await query.count();

    // Apply pagination
    if (queryParams.offset) {
      query = query.skip(queryParams.offset);
    }
    if (queryParams.limit) {
      query = query.limit(queryParams.limit);
    }

    const data = await query.toArray();

    return {
      data,
      total,
      hasMore: data.length === queryParams.limit,
    };
  }

  async searchDocuments(
    collectionId: string,
    searchText: string,
    fields: string[],
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    if (!this.db) throw new Error("Database not connected");

    const query = {
      $or: fields.map((field) => ({
        [field]: { $regex: searchText, $options: "i" },
      })),
    };

    const total = await this.db.collection(collectionId).countDocuments(query);
    const data = await this.db
      .collection(collectionId)
      .find(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    return {
      data,
      total,
      hasMore: page * pageSize < total,
    };
  }

  async createDocument(collectionId: string, data: any): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const timestamp = new Date();
    const doc = {
      ...data,
      id: new Date().getTime().toString(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.db.collection(collectionId).insertOne(doc);
    return doc;
  }

  async batchCreateDocuments(collectionId: string, documents: any[]): Promise<any[]> {
    if (!this.db) throw new Error("Database not connected");
    const timestamp = new Date();
    const docs = documents.map((data) => ({
      ...data,
      id: new Date().getTime().toString(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    await this.db.collection(collectionId).insertMany(docs);
    return docs;
  }

  async updateDocument(collectionId: string, documentId: string, data: any): Promise<any> {
    if (!this.db) throw new Error("Database not connected");
    const timestamp = new Date();
    await this.db.collection(collectionId).updateOne(
      { id: documentId },
      {
        $set: {
          ...data,
          updatedAt: timestamp,
        },
      }
    );
    return this.getDocument(collectionId, documentId);
  }

  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    await this.db.collection(collectionId).deleteOne({ id: documentId });
  }
}
