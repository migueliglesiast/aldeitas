# Google Drive Setup Example: La Arbolita

## Folder Structure

In Google Drive, create this structure:

```
Hotels/
└── La Arbolita/
    ├── cover.jpg          (Main cover image for the hotel card)
    ├── image-1.jpg        (Gallery image 1)
    ├── image-2.jpg        (Gallery image 2)
    ├── image-3.jpg        (Gallery image 3)
    └── ... (more images as needed)
```

## Step-by-Step Instructions

### 1. Create the Folder

1. Go to [Google Drive](https://drive.google.com)
2. Create a folder named **"Hotels"** (or use an existing one)
3. Inside "Hotels", create a folder named **"La Arbolita"**

### 2. Upload Images

1. Open the **"La Arbolita"** folder
2. Upload your images:
   - **cover.jpg** - This will be the main image shown on the hotel card
   - **image-1.jpg**, **image-2.jpg**, etc. - These will be shown in the gallery when the hotel is expanded

### 3. Make Folder Public

1. Right-click the **"La Arbolita"** folder
2. Click **"Share"**
3. Click **"Change to anyone with the link"**
4. Set permission to **"Viewer"**
5. Click **"Done"**
6. Copy the sharing link (it will look like: `https://drive.google.com/drive/folders/1ABC123xyz456DEF789`)

### 4. Get Individual Image URLs

For each image file:

1. Right-click the image file (e.g., `cover.jpg`)
2. Click **"Get link"** or **"Share"**
3. Make sure it's set to **"Anyone with the link can view"**
4. Copy the link

The link will look like:
```
https://drive.google.com/file/d/1FILE_ID_HERE/view?usp=sharing
```

### 5. Convert to Direct Image URL

Extract the file ID from the URL and convert it to a direct image URL:

**Original sharing URL:**
```
https://drive.google.com/file/d/1ABC123xyz456DEF789/view?usp=sharing
```

**Direct image URL format:**
```
https://drive.google.com/uc?export=view&id=1ABC123xyz456DEF789
```

The file ID is: `1ABC123xyz456DEF789`

### 6. Store in Database

Update your database with the cover image URL:

```sql
UPDATE Hotel 
SET coverImageUrl = 'https://drive.google.com/uc?export=view&id=1ABC123xyz456DEF789'
WHERE name = 'La Arbolita';
```

Or update via Prisma:

```typescript
await prisma.hotel.update({
  where: { name: 'La Arbolita' },
  data: {
    coverImageUrl: 'https://drive.google.com/uc?export=view&id=1ABC123xyz456DEF789'
  }
});
```

## Example URLs for La Arbolita

Assuming your file IDs are:
- Cover: `1ABC123xyz456DEF789`
- Image 1: `1DEF456abc789GHI012`
- Image 2: `1GHI789def012JKL345`

Your URLs would be:
- Cover: `https://drive.google.com/uc?export=view&id=1ABC123xyz456DEF789`
- Image 1: `https://drive.google.com/uc?export=view&id=1DEF456abc789GHI012`
- Image 2: `https://drive.google.com/uc?export=view&id=1GHI789def012JKL345`

## Quick Reference: Converting URLs

**From sharing URL:**
```
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
```

**To direct image URL:**
```
https://drive.google.com/uc?export=view&id=FILE_ID
```

## Notes

- **File naming**: Use lowercase, descriptive names (cover.jpg, image-1.jpg, etc.)
- **Image formats**: JPG, PNG, or WEBP work best
- **Image optimization**: Compress images before uploading (aim for 1600px wide, ~200-500KB)
- **Permissions**: Always set to "Anyone with the link can view"
- **Organization**: Keep one folder per hotel for easy management

## For Other Hotels

Repeat the same process for each hotel:
- La Otra Aldeita
- Aldeita Mixteca
- Nido Escondido
- Casa Yahua
- etc.

Each hotel gets its own folder with the same structure.


