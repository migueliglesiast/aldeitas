import { copyFile, mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

function getImageExtension(sourceUrl: string): string {
  const pathPart = sourceUrl.split("?")[0];
  const ext = pathPart.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext)) {
    return ext;
  }
  return "jpg";
}

async function ensureUploadsDir(folder: "hotels" | "rooms") {
  const uploadsDir = join(process.cwd(), "public", "uploads", folder);
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

export async function duplicateImageFile(
  sourceUrl: string,
  prefix: "hotel" | "room",
  targetId: string
): Promise<string> {
  const folder = prefix === "hotel" ? "hotels" : "rooms";
  const uploadsDir = await ensureUploadsDir(folder);
  const extension = getImageExtension(sourceUrl);
  const filename = `${prefix}-${targetId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const destPath = join(uploadsDir, filename);

  if (/^https?:\/\//i.test(sourceUrl)) {
    const response = await fetch(sourceUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(destPath, buffer);
  } else {
    const normalizedUrl = sourceUrl.startsWith("/") ? sourceUrl : `/${sourceUrl}`;
    const srcPath = join(process.cwd(), "public", normalizedUrl);
    await copyFile(srcPath, destPath);
  }

  return `/uploads/${folder}/${filename}`;
}

export async function deleteImageFile(imageUrl: string) {
  if (/^https?:\/\//i.test(imageUrl)) {
    return;
  }

  try {
    const normalizedUrl = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    const filepath = join(process.cwd(), "public", normalizedUrl);
    const { unlink } = await import("fs/promises");
    await unlink(filepath);
  } catch {
    // File may already be missing.
  }
}
