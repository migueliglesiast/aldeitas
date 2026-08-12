import { describe, it, expect } from "vitest";
import {
  getGoogleDriveImageUrl,
  extractFolderId,
  getImagesFromDriveFolder,
  convertDriveSharingUrlToDirectUrl,
} from "@/lib/google-drive";

describe("getGoogleDriveImageUrl", () => {
  it("builds a direct view url from a file id", () => {
    expect(getGoogleDriveImageUrl("abc-123")).toBe(
      "https://drive.google.com/uc?export=view&id=abc-123"
    );
  });
});

describe("extractFolderId", () => {
  it("extracts the id from a folder sharing url", () => {
    expect(extractFolderId("https://drive.google.com/drive/folders/FOLDER_1?usp=sharing")).toBe(
      "FOLDER_1"
    );
  });

  it("returns null when the url has no folder segment", () => {
    expect(extractFolderId("https://drive.google.com/file/d/FILE_1/view")).toBeNull();
  });
});

describe("getImagesFromDriveFolder", () => {
  it("returns an empty list until the Drive API is wired up", async () => {
    await expect(getImagesFromDriveFolder("FOLDER_1")).resolves.toEqual([]);
  });
});

describe("convertDriveSharingUrlToDirectUrl", () => {
  it.each([
    ["https://drive.google.com/file/d/FILE_1/view?usp=sharing", "FILE_1"],
    ["https://drive.google.com/open?id=FILE_2", "FILE_2"],
    ["https://drive.google.com/drive/folders/FOLDER_3", "FOLDER_3"],
  ])("converts %s", (input, id) => {
    expect(convertDriveSharingUrlToDirectUrl(input)).toBe(
      `https://drive.google.com/uc?export=view&id=${id}`
    );
  });

  it("returns the original url when no pattern matches", () => {
    expect(convertDriveSharingUrlToDirectUrl("https://example.com/photo.jpg")).toBe(
      "https://example.com/photo.jpg"
    );
  });
});
