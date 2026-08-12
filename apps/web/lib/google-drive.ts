/**
 * Google Drive Image Helper
 * 
 * To use Google Drive images:
 * 1. Create a Google Drive folder structure (see README)
 * 2. Make folders "Anyone with the link can view"
 * 3. Get the folder ID from the URL: https://drive.google.com/drive/folders/FOLDER_ID
 * 4. Store folder IDs in the database or environment variables
 */

/**
 * Convert Google Drive sharing URL to direct image URL
 * 
 * @param fileId - Google Drive file ID
 * @returns Direct image URL that can be used in <img> tags
 */
export function getGoogleDriveImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * Convert Google Drive folder sharing URL to folder ID
 * 
 * @param folderUrl - Google Drive folder sharing URL
 * @returns Folder ID
 */
export function extractFolderId(folderUrl: string): string | null {
  const match = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Get all image URLs from a Google Drive folder
 * Requires Google Drive API setup
 * 
 * @param folderId - Google Drive folder ID
 * @returns Array of image URLs
 */
export async function getImagesFromDriveFolder(folderId: string): Promise<string[]> {
  // This requires Google Drive API setup
  // See: https://developers.google.com/drive/api/guides/about-sdk
  // For now, return empty array - implement with API credentials
  return [];
}

/**
 * Convert Google Drive file sharing URL to direct image URL
 * 
 * @param sharingUrl - Google Drive file sharing URL
 * @returns Direct image URL
 */
export function convertDriveSharingUrlToDirectUrl(sharingUrl: string): string {
  // Extract file ID from various Google Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = sharingUrl.match(pattern);
    if (match) {
      return getGoogleDriveImageUrl(match[1]);
    }
  }
  
  // If no pattern matches, return original URL
  return sharingUrl;
}

