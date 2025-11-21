import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'siha-b';
const UPLOAD_EXPIRY = 3600; // 1 hour for upload URLs
const DOWNLOAD_EXPIRY = 3600; // 1 hour for download URLs

export interface S3UploadInfo {
  key: string;
  uploadUrl: string;
}

export class S3Service {
  /**
   * Generate presigned URL for uploading a frame to S3
   */
  static async getUploadUrl(userId: string, frameIndex: number): Promise<S3UploadInfo> {
    try {
      const timestamp = Date.now();
      const uniqueId = randomUUID().substring(0, 8);
      const key = `video-frames/${userId}/${timestamp}-${uniqueId}-frame-${frameIndex}.jpg`;
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: 'image/jpeg',
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: UPLOAD_EXPIRY });

      if (!uploadUrl) {
        throw new Error('Failed to generate presigned URL');
      }

      return {
        key,
        uploadUrl,
      };
    } catch (error: any) {
      console.error(`[S3Service] Error generating upload URL for frame ${frameIndex}:`, error);
      throw new Error(`Failed to generate S3 upload URL: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate presigned URLs for multiple frames
   */
  static async getBatchUploadUrls(userId: string, frameCount: number): Promise<S3UploadInfo[]> {
    const uploadInfos: S3UploadInfo[] = [];
    
    for (let i = 0; i < frameCount; i++) {
      const info = await this.getUploadUrl(userId, i);
      uploadInfos.push(info);
    }

    return uploadInfos;
  }

  /**
   * Download a frame from S3 by key
   */
  static async downloadFrame(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error(`No body in S3 response for key: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Download multiple frames from S3
   */
  static async downloadFrames(keys: string[]): Promise<Buffer[]> {
    const downloadPromises = keys.map(key => this.downloadFrame(key));
    return Promise.all(downloadPromises);
  }

  /**
   * Delete a frame from S3
   */
  static async deleteFrame(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * Delete multiple frames from S3
   */
  static async deleteFrames(keys: string[]): Promise<void> {
    const deletePromises = keys.map(key => this.deleteFrame(key));
    await Promise.all(deletePromises);
  }

  /**
   * Get presigned download URL for a frame (for direct access)
   */
  static async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn: DOWNLOAD_EXPIRY });
  }
}

