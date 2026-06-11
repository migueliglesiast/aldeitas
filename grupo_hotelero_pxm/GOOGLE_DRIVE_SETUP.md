# Google Drive Image Setup Guide

## Folder Structure for Hotels

Create a Google Drive folder structure like this:

```
Hotels/
├── La Arbolita/
│   ├── cover.jpg (or cover.png)
│   ├── image-1.jpg
│   ├── image-2.jpg
│   ├── image-3.jpg
│   └── ... (more images)
├── La Otra Aldeita/
│   ├── cover.jpg
│   ├── image-1.jpg
│   └── ...
├── Aldeita Mixteca/
│   ├── cover.jpg
│   └── ...
└── ... (other hotels)
```

## Step-by-Step Setup

### 1. Create the Folder Structure

1. Go to Google Drive
2. Create a main folder called "Hotels" (or any name you prefer)
3. Inside "Hotels", create a folder for each hotel:
   - **La Arbolita**
   - **La Otra Aldeita**
   - **Aldeita Mixteca**
   - etc.

### 2. Upload Images

For each hotel folder:
- Upload a `cover.jpg` (or `cover.png`) - this will be the main image shown on the hotel card
- Upload additional images (name them `image-1.jpg`, `image-2.jpg`, etc.) for the gallery

### 3. Make Folders Public

For each hotel folder:
1. Right-click the folder → "Share"
2. Click "Change to anyone with the link"
3. Set permission to "Viewer"
4. Copy the sharing link

### 4. Get Folder IDs

The sharing URL will look like:
```
https://drive.google.com/drive/folders/1ABC123xyz456DEF789
```

The folder ID is: `1ABC123xyz456DEF789`

### 5. Store Folder IDs

You have two options:

**Option A: Store in Database (Recommended)**
Add a `googleDriveFolderId` field to the Hotel model in Prisma schema.

**Option B: Store in Environment Variables**
Create a mapping in `.env.local`:
```
GOOGLE_DRIVE_ARBOLITA_FOLDER_ID=1ABC123xyz456DEF789
GOOGLE_DRIVE_OTRA_ALDEITA_FOLDER_ID=2XYZ789abc123GHI456
```

## Using Direct Image URLs

### Method 1: Individual File IDs (Recommended)

For each image file in Google Drive:
1. Right-click the image → "Get link"
2. Copy the link (e.g., `https://drive.google.com/file/d/1FILE_ID123/view?usp=sharing`)
3. Extract the file ID: `1FILE_ID123`
4. Convert to direct URL: `https://drive.google.com/uc?export=view&id=1FILE_ID123`

### Method 2: Using Google Drive API

For automatic fetching, you'll need:
1. Google Cloud Project
2. Enable Google Drive API
3. Create credentials (Service Account or OAuth)
4. Use the API to list files in folders

## Example: La Arbolita Structure

```
La Arbolita/
├── cover.jpg          → File ID: 1ABC123
├── image-1.jpg        → File ID: 1DEF456
├── image-2.jpg        → File ID: 1GHI789
└── image-3.jpg        → File ID: 1JKL012
```

Direct URLs would be:
- Cover: `https://drive.google.com/uc?export=view&id=1ABC123`
- Image 1: `https://drive.google.com/uc?export=view&id=1DEF456`
- etc.

## Notes

- **File naming**: Use lowercase, kebab-case for consistency
- **Image formats**: JPG, PNG, or WEBP work best
- **Image size**: Optimize images (1600px wide recommended)
- **Permissions**: Make sure folders/files are set to "Anyone with the link can view"
- **Rate limits**: Google Drive has rate limits, consider caching image URLs


