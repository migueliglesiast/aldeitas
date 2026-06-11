# Guesty iCal Setup Guide

## Overview

Your database already supports iCal URLs for each room/listing. You can add Guesty iCal URLs (or any other calendar source) through the admin interface or directly in the database.

## How to Add Guesty iCal URLs

### Method 1: Using the Admin Interface (Recommended)

1. **Navigate to the Calendar Admin Page**
   - Go to `/admin/calendars` in your application
   - Or click "Manage Calendars" button on the homepage

2. **Fill out the form:**
   - **Name**: Give it a descriptive name (e.g., "Guesty - La Arbolita Room 1")
   - **iCal URL**: Paste your Guesty iCal URL
   - **Link to Listing**: Select the specific room/listing from the dropdown (optional but recommended)

3. **Click "Add"**

### Method 2: Direct Database Entry

You can also add calendar sources directly via Prisma:

```typescript
await prisma.calendarSource.create({
  data: {
    name: "Guesty - La Arbolita Room 1",
    icalUrl: "https://api.guesty.com/ical/your-calendar-id",
    listingId: "listing-id-here" // Optional: link to specific listing
  }
});
```

## Getting Guesty iCal URLs

1. **Log into Guesty for Hosts**
2. **Navigate to the property/listing**
3. **Go to Calendar settings**
4. **Find the "Export Calendar" or "iCal Feed" option**
5. **Copy the iCal URL** (usually looks like: `https://api.guesty.com/ical/...`)

## Database Structure

### CalendarSource Model
- `id`: Unique identifier
- `name`: Display name for the calendar
- `icalUrl`: The iCal feed URL (unique)
- `listingId`: Optional link to a specific listing/room
- `createdAt`: When it was added

### Listing Model
Each listing (room) can have:
- Multiple `calendarSources` (multiple iCal feeds)
- Multiple `images` (room-specific pictures)
- `description` field for room characteristics

## Room Pictures

**Room pictures are already supported!** Each listing can have multiple images:

1. **Via API**: Use `/api/images` endpoint to scrape images from Airbnb URLs
2. **Direct Database**: Add images directly:

```typescript
await prisma.image.create({
  data: {
    listingId: "listing-id",
    url: "https://your-image-url.jpg",
    position: 0 // Order: 0 = first image, 1 = second, etc.
  }
});
```

## Room Characteristics

The `Listing` model now has a `description` field where you can add room-specific characteristics:

```typescript
await prisma.listing.update({
  where: { id: "listing-id" },
  data: {
    description: "Spacious room with ocean view, private balcony, king bed, and ensuite bathroom. Includes kitchenette and air conditioning."
  }
});
```

## Example: Adding Guesty Calendar for La Arbolita Room 1

1. Find the listing ID for "La Arbolita - Room 1"
2. Get the Guesty iCal URL for that room
3. Add it via admin interface:
   - Name: "Guesty - La Arbolita Room 1"
   - iCal URL: `https://api.guesty.com/ical/abc123...`
   - Link to Listing: Select "La Arbolita - Room 1"

## Multiple Calendars per Room

You can add multiple calendar sources to the same listing. For example:
- One Guesty calendar
- One Airbnb calendar
- One Booking.com calendar

All will be checked when determining availability.

## Notes

- Each iCal URL must be unique (enforced by database)
- Calendar sources can exist without being linked to a listing (general calendars)
- The system checks all calendar sources linked to a listing when checking availability
- Room images are stored in the `Image` model with a `position` field for ordering


