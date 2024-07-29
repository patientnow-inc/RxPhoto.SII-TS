// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from "fs";

import { mockAwsS3 } from "./mock";

import { handler } from "../index";
import { ImageHandlerError, ImageHandlerEvent, StatusCodes } from "../lib";

describe("index", () => {
  // Arrange
  process.env.SOURCE_BUCKETS = "source-bucket";
  const mockImage = Buffer.from("SampleImageContent\n");
  const mockImageURL = `https://${process.env.SOURCE_BUCKETS}.s3.us-west-1.amazonaws.com/image.png`;
  const mockFallbackImageURL = `https://${process.env.SOURCE_BUCKETS}.s3.us-west-1.amazonaws.com/fallback.png`;

  it("should return the image when there is no error", async () => {
    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Body: mockImage, ContentType: "image/jpeg" });
      },
    }));
    mockAwsS3.getSignedUrlPromise.mockImplementationOnce(() => (
      Promise.resolve(mockImageURL)
    ));

    // Arrange
    const event: ImageHandlerEvent = { path: "/test.jpg" };

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.MOVED_PERMANENTLY,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true,
        "Content-Type": "application/json",
        "Location": mockImageURL,
      }
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return the image with custom headers when custom headers are provided", async () => {
    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Body: mockImage, ContentType: "image/jpeg" });
      },
    }));
    mockAwsS3.getSignedUrlPromise.mockImplementationOnce(() => (
      Promise.resolve(mockImageURL)
    ));

    // Arrange
    const event: ImageHandlerEvent = {
      path: "/eyJidWNrZXQiOiJzb3VyY2UtYnVja2V0Iiwia2V5IjoidGVzdC5qcGciLCJoZWFkZXJzIjp7IkN1c3RvbS1IZWFkZXIiOiJDdXN0b21WYWx1ZSJ9fQ==",
    };

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.MOVED_PERMANENTLY,
      headers: {
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET",
        "Content-Type": "application/json",
        "Location": mockImageURL
      }
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return the image when the request is from ALB", async () => {
    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Body: mockImage, ContentType: "image/jpeg" });
      },
    }));
    mockAwsS3.getSignedUrlPromise.mockImplementationOnce(() => (
      Promise.resolve(mockImageURL)
    ));

    // Arrange
    const event: ImageHandlerEvent = {
      path: "/test.jpg",
      requestContext: {
        elb: {},
      },
    };

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.MOVED_PERMANENTLY,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json",
        "Location": mockImageURL
      }
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON when an error occurs", async () => {
    // Arrange
    const event: ImageHandlerEvent = { path: "/test.jpg" };
    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."));
      },
    }));

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return 500 error when there is no error status in the error", async () => {
    // Arrange
    const event: ImageHandlerEvent = {
      path: "eyJidWNrZXQiOiJzb3VyY2UtYnVja2V0Iiwia2V5IjoidGVzdC5qcGciLCJlZGl0cyI6eyJ3cm9uZ0ZpbHRlciI6dHJ1ZX19",
    };

    // Mock
    mockAwsS3.headObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Body: mockImage, ContentType: "image/jpeg" });
      },
    }));
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Body: mockImage, ContentType: "image/jpeg" });
      },
    }));

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Internal error. Please contact the system administrator.",
        code: "InternalError",
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      }),
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return the default fallback image when an error occurs if the default fallback image is enabled", async () => {
    // Arrange
    process.env.ENABLE_DEFAULT_FALLBACK_IMAGE = "Yes";
    process.env.DEFAULT_FALLBACK_IMAGE_BUCKET = "fallback-image-bucket";
    process.env.DEFAULT_FALLBACK_IMAGE_KEY = "fallback-image.png";
    process.env.CORS_ENABLED = "Yes";
    process.env.CORS_ORIGIN = "*";
    const event: ImageHandlerEvent = { path: "/test.jpg" };

    // Mock
    mockAwsS3.headObject.mockReset();
    mockAwsS3.headObject
        .mockImplementationOnce(() => ({
          promise() {
            return Promise.reject(new ImageHandlerError(StatusCodes.INTERNAL_SERVER_ERROR, "UnknownError", null));
          },
        }));

    mockAwsS3.getObject.mockReset();
    mockAwsS3.getObject
        .mockImplementationOnce(() => ({
          promise() {
            return Promise.reject(new ImageHandlerError(StatusCodes.INTERNAL_SERVER_ERROR, "UnknownError", null));
          },
        }));

    mockAwsS3.getSignedUrlPromise.mockReset();
    mockAwsS3.getSignedUrlPromise.mockImplementationOnce(() => (
      Promise.resolve(mockFallbackImageURL)
    ));

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.MOVED_PERMANENTLY,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
        "Location": mockFallbackImageURL
      }
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenNthCalledWith(1, {
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(mockAwsS3.getSignedUrlPromise).toHaveBeenNthCalledWith(1,
      "getObject",
      {
      Bucket: "fallback-image-bucket",
      Key: "fallback-image.png",
      }
    );
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON when getting the default fallback image fails if the default fallback image is enabled", async () => {
    // Arrange
    const event: ImageHandlerEvent = {
      path: "/test.jpg",
    };

    // Mock
    mockAwsS3.headObject.mockReset();
    mockAwsS3.headObject.mockImplementation(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."));
      },
    }));
    mockAwsS3.getObject.mockReset();
    mockAwsS3.getObject.mockImplementation(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."));
      },
    }));
    mockAwsS3.getSignedUrlPromise.mockImplementationOnce(() => (
      Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."))
    ));

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenNthCalledWith(1, {
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(mockAwsS3.getSignedUrlPromise).toHaveBeenNthCalledWith(
        1,
        "getObject",
        {"Bucket": "fallback-image-bucket", "Key": "fallback-image.png"}
    );
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON when the default fallback image key is not provided if the default fallback image is enabled", async () => {
    // Arrange
    process.env.DEFAULT_FALLBACK_IMAGE_KEY = "";
    const event: ImageHandlerEvent = { path: "/test.jpg" };

    // Mock
    mockAwsS3.headObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."));
      },
    }));
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."));
      },
    }));
    mockAwsS3.getSignedUrlPromise.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."));
      },
    }));

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON when the default fallback image bucket is not provided if the default fallback image is enabled", async () => {
    // Arrange
    process.env.DEFAULT_FALLBACK_IMAGE_BUCKET = "";
    const event: ImageHandlerEvent = { path: "/test.jpg" };

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."));
      },
    }));

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("Should return an error JSON when ALB request is failed", async () => {
    // Arrange
    const event: ImageHandlerEvent = {
      path: "/test.jpg",
      requestContext: {
        elb: {},
      },
    };

    // Mock
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject(new ImageHandlerError(StatusCodes.NOT_FOUND, "NoSuchKey", "NoSuchKey error happened."));
      },
    }));

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.NOT_FOUND,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: StatusCodes.NOT_FOUND,
        code: "NoSuchKey",
        message: `The image test.jpg does not exist or the request may not be base64 encoded properly.`,
      }),
    };

    // Assert
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: "source-bucket",
      Key: "test.jpg",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should return an error JSON with the expected message when one or both overlay image dimensions are greater than the base image dimensions", async () => {
    // Arrange
    // {"bucket":"source-bucket","key":"transparent-10x10.png","edits":{"overlayWith":{"bucket":"source-bucket","key":"transparent-5x5.png"}},"headers":{"Custom-Header":"Custom header test","Cache-Control":"max-age:1,public"}}
    const event: ImageHandlerEvent = {
      path: "eyJidWNrZXQiOiJzb3VyY2UtYnVja2V0Iiwia2V5IjoidHJhbnNwYXJlbnQtMTB4MTAucG5nIiwiZWRpdHMiOnsib3ZlcmxheVdpdGgiOnsiYnVja2V0Ijoic291cmNlLWJ1Y2tldCIsImtleSI6InRyYW5zcGFyZW50LTV4NS5wbmcifX0sImhlYWRlcnMiOnsiQ3VzdG9tLUhlYWRlciI6IkN1c3RvbSBoZWFkZXIgdGVzdCIsIkNhY2hlLUNvbnRyb2wiOiJtYXgtYWdlOjEscHVibGljIn19",
    };
    // Mock
    const overlayImage = fs.readFileSync("./test/image/transparent-5x5.jpeg");
    const baseImage = fs.readFileSync("./test/image/transparent-10x10.jpeg");

    // Mock
    mockAwsS3.getObject.mockImplementation((data) => ({
      promise() {
        return Promise.resolve({
          Body: data.Key === "transparent-10x10.png" ? overlayImage : baseImage,
        });
      },
    }));

    // Act
    const result = await handler(event);
    const expectedResult = {
      statusCode: StatusCodes.BAD_REQUEST,
      headers: {
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Image to overlay must have same dimensions or smaller`,
        code: "BadRequest",
        status: StatusCodes.BAD_REQUEST,
      }),
    };
    expect(result).toEqual(expectedResult);
  });
});
