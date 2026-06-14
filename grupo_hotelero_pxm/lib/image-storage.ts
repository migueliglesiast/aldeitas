import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { v2 as cloudinary } from "cloudinary";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const IMAGE_FETCH_TIMEOUT_MS = 15_000;

export type ImageFolder = "hotels" | "rooms";

export type SaveImageOptions = {
  folder: ImageFolder;
  filenameBase: string;
  extension?: string;
};

let cloudinaryConfigured = false;

export function isCloudStorageEnabled(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured || !isCloudStorageEnabled()) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  cloudinaryConfigured = true;
}

export function getImageExtension(sourceUrl: string): string {
  const pathPart = sourceUrl.split("?")[0];
  const ext = pathPart.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "jpg";
}

function localPublicPath(relativeUrl: string): string {
  const normalized = relativeUrl.replace(/^\/+/, "");
  return join(process.cwd(), "public", normalized);
}

async function ensureLocalUploadsDir(folder: ImageFolder) {
  const uploadsDir = join(process.cwd(), "public", "uploads", folder);
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

function extractCloudinaryPublicId(url: string): string | null {
  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).replace(/^v\d+\//, "");
  return path.replace(/\.[^/.]+$/, "");
}

export async function fetchImageBuffer(sourceUrl: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download image (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export async function saveUploadedImage(
  buffer: Buffer,
  options: SaveImageOptions
): Promise<string> {
  const extension = (options.extension || "jpg").replace(/^\./, "");
  const filename = `${options.filenameBase}.${extension}`;

  if (isCloudStorageEnabled()) {
    ensureCloudinaryConfigured();
    const publicId = options.filenameBase.replace(/[^a-zA-Z0-9-_]/g, "-");

    const uploaded = await cloudinary.uploader.upload(
      `data:image/${extension === "jpg" ? "jpeg" : extension};base64,${buffer.toString("base64")}`,
      {
        folder: `aldeitas/${options.folder}`,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      }
    );

    return uploaded.secure_url;
  }

  const uploadsDir = await ensureLocalUploadsDir(options.folder);
  const filepath = join(uploadsDir, filename);
  await writeFile(filepath, buffer);
  return `/uploads/${options.folder}/${filename}`;
}

export async function duplicateImageFile(
  sourceUrl: string,
  prefix: "hotel" | "room",
  targetId: string
): Promise<string> {
  const folder: ImageFolder = prefix === "hotel" ? "hotels" : "rooms";
  const extension = getImageExtension(sourceUrl);
  const filenameBase = `${prefix}-${targetId}-${Date.now()}-${randomBytes(4).toString("hex")}`;

  if (/^https?:\/\//i.test(sourceUrl)) {
    const buffer = await fetchImageBuffer(sourceUrl);
    return saveUploadedImage(buffer, { folder, filenameBase, extension });
  }

  const normalizedUrl = sourceUrl.startsWith("/") ? sourceUrl : `/${sourceUrl}`;
  const srcPath = localPublicPath(normalizedUrl);

  if (isCloudStorageEnabled()) {
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(srcPath);
    return saveUploadedImage(buffer, { folder, filenameBase, extension });
  }

  const uploadsDir = await ensureLocalUploadsDir(folder);
  const filename = `${filenameBase}.${extension}`;
  const destPath = join(uploadsDir, filename);
  await copyFile(srcPath, destPath);
  return `/uploads/${folder}/${filename}`;
}

export async function mirrorRemoteImageUrls(
  urls: string[],
  folder: ImageFolder,
  idPrefix: string
): Promise<string[]> {
  const mirrored: string[] = [];

  for (const [index, url] of urls.entries()) {
    const buffer = await fetchImageBuffer(url);
    const savedUrl = await saveUploadedImage(buffer, {
      folder,
      filenameBase: `${idPrefix}-${index}-${Date.now()}`,
      extension: getImageExtension(url),
    });
    mirrored.push(savedUrl);
  }

  return mirrored;
}

export async function deleteImageFile(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  if (imageUrl.includes("res.cloudinary.com")) {
    if (!isCloudStorageEnabled()) return;
    ensureCloudinaryConfigured();
    const publicId = extractCloudinaryPublicId(imageUrl);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      } catch {
        // Ignore missing assets.
      }
    }
    return;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return;
  }

  try {
    await unlink(localPublicPath(imageUrl));
  } catch {
    // File may already be missing.
  }
}
