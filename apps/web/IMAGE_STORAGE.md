# Image storage (Cloudinary)

Production on Hostinger cannot rely on `public/uploads/` — those files are not in git and are lost on redeploy.

## Setup (one time)

1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. Dashboard → copy **Cloud name**, **API Key**, **API Secret**
3. Add to `.env` locally and Hostinger **Variables de entorno**:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

4. Redeploy on Hostinger

When these three variables are set:

- Admin manual uploads → Cloudinary URLs (`https://res.cloudinary.com/...`)
- Admin Airbnb import → photos mirrored to Cloudinary automatically
- Delete in admin → removes from Cloudinary

Without Cloudinary, uploads still work **locally** in dev (`/uploads/...`).

---

## Import room photos from Airbnb (CLI)

Edit `scripts/import-room-images.config.ts` with hotel names, room titles, and Airbnb URLs.

```bash
# Import La Arbolita (hotlinks to Airbnb CDN)
npm run images:import -- --hotel "La Arbolita"

# Import and save copies to Cloudinary (recommended for production)
npm run images:import -- --hotel "La Arbolita" --mirror

# Preview without writing to DB
npm run images:import -- --dry-run
```

Legacy shortcut (same config):

```bash
npx tsx scripts/populate-arbolita-images.ts --mirror
```

---

## Migrate existing DB URLs to Cloudinary

After setting Cloudinary env vars, upload existing `/uploads/`, muscache, and picsum URLs:

```bash
npm run images:mirror-cloud
npm run images:mirror-cloud -- --dry-run
```

Run against Neon by pointing `DATABASE_URL` in `.env` to production.

---

## Admin UI

No UI changes needed. Upload and **Import from Airbnb** on room/hotel edit pages use Cloudinary automatically when env vars are set.
