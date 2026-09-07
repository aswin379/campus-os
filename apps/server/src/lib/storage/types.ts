export interface StoredFileRef {
  key: string;
}

export interface FileStorage {
  save(key: string, data: Buffer, contentType: string): Promise<StoredFileRef>;
  getUrl(key: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
