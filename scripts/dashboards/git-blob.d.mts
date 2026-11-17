export interface ListedFile {
  path: string;
  size: number;
  sha: string;
}

export function gitBlobSha(buf: Buffer): string;
export function listFiles(root: string): ListedFile[];
