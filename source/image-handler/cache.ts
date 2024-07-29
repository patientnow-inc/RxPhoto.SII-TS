import S3 from "aws-sdk/clients/s3";
import {ImageEdits, ImageHandlerError, ImageRequestInfo, StatusCodes} from "./lib";
import {mockAwsS3} from "./test/mock";
const hash = require('object-hash');


export class ImageCache {

  constructor(private readonly s3Client: S3 | typeof mockAwsS3) {}

  /**
   * Try to get cached image by the key if exists
   * @param key cached image key
   * @param bucket cache image bucket
   * @returns cached image URL
   */
  private async getImage(key: string, bucket: string): Promise<string | undefined> {
    let params = {
      Bucket: bucket,
      Key: key
    }

    try {
      await this.s3Client.headObject(params).promise();
      return this.s3Client.getSignedUrlPromise("getObject", params);
    } catch (error) {
      if (error.name === "NotFound") {
        console.debug(`Cached image for key: ${params.Key} not found.`);
      } else {
        console.error(error);
        throw new ImageHandlerError(
            StatusCodes.BAD_REQUEST,
            "S3Error",
            "Unexpected error occurred."
        );
      }
    }
  }

  /**
   * Cache modified image
   * @param key cached image key
   * @param bucket cache image bucket
   * @param imageBuffer modified image data
   * @returns cached image URL
   */
  private async cacheImage(key: string, bucket: string, imageBuffer: Buffer): Promise<string | undefined> {
    let params = {
      Bucket: bucket,
      Key: key,
      Body: imageBuffer
    }

    try {
      await this.s3Client.putObject(params).promise();
    } catch (error) {
      console.error(error);
      throw new ImageHandlerError(
          StatusCodes.BAD_REQUEST,
          "CacheError",
          "The converted image failed to cache."
      );
    }
    return this.s3Client.getSignedUrlPromise('getObject', {Bucket: bucket, Key: key});
  }


  /**
   * Get image cache key in the following format (<key>__<hash(edits)>.<ext>)
   * @param key source image key
   * @param edits image edits requested
   * @returns image cache key
   */
  private getCacheKey(key: string, edits: ImageEdits): string {
    let filePath = key;

    if (filePath.indexOf("/") >= 0) {
      filePath = filePath.split('/').pop();
    }

    const parts = filePath.split('.');
    const filename = parts[0];
    const ext = parts[1];
    return `cache/${filename}__${hash(edits)}.${ext}`;
  }


  /**
   * Get (if exists) or cache resized image to the source S3 bucket
   * @param imageBuffer the modified image buffer
   * @param imageRequestInfo the image request
   * @returns cached image URL
   */
  public async getOrCacheImage(imageBuffer: Buffer, imageRequestInfo: ImageRequestInfo): Promise<string> {
    const {originalImage, edits} = imageRequestInfo;

    const cacheKey = this.getCacheKey(imageRequestInfo.key, edits);
    let cachedImageURL = await this.getImage(cacheKey, imageRequestInfo.bucket);
    if (cachedImageURL === undefined) {
      cachedImageURL = await this.cacheImage(cacheKey, imageRequestInfo.bucket, imageBuffer);
    }
    return cachedImageURL;
  }
}