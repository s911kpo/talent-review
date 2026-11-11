export interface BackupTable { name: string; key: string[] }
export const TABLES: BackupTable[];
export function buildRestoreSql(data: Record<string, unknown[]>): string;
