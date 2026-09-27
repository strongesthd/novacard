export type UserRole = "USER" | "ORG_ADMIN" | "MODERATOR" | "ADMIN";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type QRCode = {
  id: string;
  profileId: string;
  targetUrl: string;
  logoAssetId?: string;
  label?: string;
  revokedAt?: string;
  scanCount: number;
  lastScannedAt?: string;
  createdAt: string;
};

export type QRCodeAnalytics = Pick<QRCode, "id" | "scanCount" | "lastScannedAt">;
