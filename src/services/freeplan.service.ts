import { getDatabase, ref, get, onValue, Database } from "firebase/database";
import { getFirestore, collection, getDocs, Firestore } from "firebase/firestore";
import type { FirebaseApp } from "firebase/app";
import type { StorageUsage, UsageAlert } from "../types/firebase";

export class FreePlanService {
  private static instance: FreePlanService;
  private db: Database | null = null;
  private firestore: Firestore | null = null;
  private readonly USAGE_PATH = "usage";

  // Free plan limits (as of 2024)
  private readonly LIMITS = {
    realtimeDatabase: {
      storage: 1024 * 1024 * 1024, // 1GB storage
      download: 10 * 1024 * 1024 * 1024, // 10GB/month download
      upload: 20 * 1024 * 1024, // 20MB/day upload
    },
    firestore: {
      storage: 1024 * 1024 * 1024, // 1GB storage
      readOps: 50000, // 50K/day reads
      writeOps: 20000, // 20K/day writes
      deleteOps: 20000, // 20K/day deletes
    },
  };

  private constructor() {}

  static getInstance(): FreePlanService {
    if (!FreePlanService.instance) {
      FreePlanService.instance = new FreePlanService();
    }
    return FreePlanService.instance;
  }

  initialize(app: FirebaseApp) {
    this.db = getDatabase(app);
    this.firestore = getFirestore(app);
    this.startUsageMonitoring();
  }

  /**
   * Start monitoring usage metrics
   */
  private startUsageMonitoring() {
    if (!this.db) throw new Error("Database not initialized");

    // Monitor Realtime Database usage
    const usageRef = ref(this.db, this.USAGE_PATH);
    onValue(usageRef, (snapshot) => {
      if (snapshot.exists()) {
        this.checkUsageLimits(snapshot.val());
      }
    });
  }

  /**
   * Check usage against limits and emit alerts if necessary
   */
  private checkUsageLimits(usage: StorageUsage): UsageAlert[] {
    const alerts: UsageAlert[] = [];
    const WARNING_THRESHOLD = 0.8; // 80% of limit

    // Check Realtime Database metrics
    const rtdb = usage.realtimeDatabase;
    Object.entries(rtdb).forEach(([metric, value]) => {
      const limit = this.LIMITS.realtimeDatabase[metric.replace("Used", "") as keyof typeof this.LIMITS.realtimeDatabase];
      const percentage = value / limit;

      if (percentage > WARNING_THRESHOLD) {
        alerts.push({
          type: "realtime",
          metric,
          usage: value,
          limit,
          percentage,
        });
      }
    });

    // Check Firestore metrics
    const fs = usage.firestore;
    Object.entries(fs).forEach(([metric, value]) => {
      const limit = this.LIMITS.firestore[metric.replace("Used", "") as keyof typeof this.LIMITS.firestore];
      const percentage = value / limit;

      if (percentage > WARNING_THRESHOLD) {
        alerts.push({
          type: "firestore",
          metric,
          usage: value,
          limit,
          percentage,
        });
      }
    });

    return alerts;
  }

  /**
   * Get current storage usage for both databases
   */
  async getCurrentUsage(): Promise<StorageUsage> {
    if (!this.db || !this.firestore) throw new Error("Databases not initialized");

    // Get Realtime Database usage
    const rtdbUsage = await get(ref(this.db, this.USAGE_PATH));

    // Get Firestore usage through collection size estimation
    const collections = await getDocs(collection(this.firestore, "_"));
    const estimatedSize = collections.size * 10 * 1024; // Rough estimation: 10KB per document

    return {
      realtimeDatabase: rtdbUsage.val()?.realtimeDatabase || {
        storageUsed: 0,
        storageLimit: this.LIMITS.realtimeDatabase.storage,
        downloadUsed: 0,
        downloadLimit: this.LIMITS.realtimeDatabase.download,
        uploadUsed: 0,
        uploadLimit: this.LIMITS.realtimeDatabase.upload,
      },
      firestore: {
        storageUsed: estimatedSize,
        storageLimit: this.LIMITS.firestore.storage,
        readOpsUsed: 0,
        readOpsLimit: this.LIMITS.firestore.readOps,
        writeOpsUsed: 0,
        writeOpsLimit: this.LIMITS.firestore.writeOps,
        deleteOpsUsed: 0,
        deleteOpsLimit: this.LIMITS.firestore.deleteOps,
      },
    };
  }

  /**
   * Check if an operation would exceed free plan limits
   */
  async checkOperationFeasibility(operation: {
    type: "read" | "write" | "delete";
    size?: number;
    database: "realtime" | "firestore";
  }): Promise<{ feasible: boolean; reason?: string }> {
    const usage = await this.getCurrentUsage();

    if (operation.database === "realtime") {
      const rtdb = usage.realtimeDatabase;

      if (operation.type === "write" && operation.size) {
        if (rtdb.uploadUsed + operation.size > this.LIMITS.realtimeDatabase.upload) {
          return {
            feasible: false,
            reason: "Daily upload limit would be exceeded",
          };
        }
        if (rtdb.storageUsed + operation.size > this.LIMITS.realtimeDatabase.storage) {
          return {
            feasible: false,
            reason: "Storage limit would be exceeded",
          };
        }
      }
    } else {
      const fs = usage.firestore;

      if (operation.type === "read" && fs.readOpsUsed >= this.LIMITS.firestore.readOps) {
        return {
          feasible: false,
          reason: "Daily read operations limit reached",
        };
      }
      if (operation.type === "write" && fs.writeOpsUsed >= this.LIMITS.firestore.writeOps) {
        return {
          feasible: false,
          reason: "Daily write operations limit reached",
        };
      }
      if (operation.type === "delete" && fs.deleteOpsUsed >= this.LIMITS.firestore.deleteOps) {
        return {
          feasible: false,
          reason: "Daily delete operations limit reached",
        };
      }
    }

    return { feasible: true };
  }

  /**
   * Get usage statistics and warnings
   */
  async getUsageStats(): Promise<{
    usage: StorageUsage;
    alerts: UsageAlert[];
    recommendations: string[];
  }> {
    const usage = await this.getCurrentUsage();
    const alerts = this.checkUsageLimits(usage);

    // Generate recommendations based on usage patterns
    const recommendations: string[] = [];

    if (alerts.some((a) => a.type === "realtime" && a.metric.includes("storage"))) {
      recommendations.push("Consider implementing data cleanup strategies for Realtime Database");
    }
    if (alerts.some((a) => a.type === "firestore" && a.metric.includes("readOps"))) {
      recommendations.push("Implement caching to reduce Firestore read operations");
    }
    if (alerts.some((a) => a.metric.includes("storage"))) {
      recommendations.push("Review data structure to optimize storage usage");
    }

    return {
      usage,
      alerts,
      recommendations,
    };
  }
}

// Export a default instance
export const freePlanService = FreePlanService.getInstance();
