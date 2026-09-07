export interface ReportColumn {
  key: string;
  header: string;
  width?: number;
}

export type ReportRow = Record<string, string | number | null>;
