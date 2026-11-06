import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface StoredObject {
  body: Readable;
  contentType: string;
}

/** Private object storage. Nothing in it is ever public; the API streams files after an access check. */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  prefix: string;
}

export class S3Storage implements Storage {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  private key(key: string) {
    return `${this.config.prefix}${key}`;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.key(key),
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: this.key(key) }),
      );
      return {
        body: res.Body as Readable,
        contentType: res.ContentType ?? 'application/octet-stream',
      };
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async delete(key: string) {
    // S3 deletes are idempotent: deleting a missing key succeeds.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.key(key) }),
    );
  }
}
