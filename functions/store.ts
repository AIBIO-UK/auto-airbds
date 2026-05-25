export interface UploadEntry {
  id: string;
  timestamp: string;
  data: unknown;
}

export const store: UploadEntry[] = [];
