import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { z } from "zod";
import { formatZodError } from "@/lib/zod-error";

export const dynamic = "force-dynamic";

// Empty inputs from the sign-up wizard are treated as "not provided".
const optionalUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));

const UnitSchema = z.object({
  name_of_unit: z.string(),
  num_of_guests: z.number().int().nonnegative(),
  description: z.string().min(1),
  private_ammenities: z.string().optional(),
  number_of_beds: z.number().int().nonnegative(),
  number_of_bathrooms: z.number().nonnegative(),
  cost_night: z.number().nonnegative(),
  calendar: optionalUrl,
});

const SignUpSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  hotel_name: z.string().min(1),
  phone_number: z.string().optional(),
  instagram_link: optionalUrl,
  short_description: z.string().optional(),
  public_ammenities: z.string().optional(),
  units: z.array(UnitSchema).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = SignUpSchema.parse(json);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: body.email }, { username: body.username }] },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        hotelName: body.hotel_name,
        phoneNumber: body.phone_number ?? null,
        instagramLink: body.instagram_link ?? null,
        shortDescription: body.short_description ?? null,
        publicAmenities: body.public_ammenities ?? null,
        passwordHash,
        units: body.units?.length
          ? {
              create: body.units.map((u) => ({
                nameOfUnit: u.name_of_unit,
                numOfGuests: u.num_of_guests,
                description: u.description,
                privateAmenities: u.private_ammenities ?? null,
                numberOfBeds: u.number_of_beds,
                numberOfBathrooms: u.number_of_bathrooms,
                costNight: u.cost_night,
                icalUrl: u.calendar ?? null,
              })),
            }
          : undefined,
      },
      select: { id: true, username: true, email: true, hotelName: true },
    });

    // Create a Hotel for the user and corresponding Listings for units
    const hotel = await prisma.hotel.create({
      data: {
        name: user.hotelName || `${user.username}'s Hotel`,
        description: "",
        location: "",
        ownerId: user.id,
        listings: body.units?.length
          ? {
              create: body.units.map((u) => ({
                airbnbId: `owner-unit-${u.name_of_unit}`,
                airbnbUrl: "",
                icalUrl: u.calendar ?? null,
                title: u.name_of_unit,
                nightlyBasePrice: Math.round((u.cost_night || 0) * 100),
                baseCurrency: "USD",
              })),
            }
          : undefined,
      },
      select: { id: true },
    });

    await createSession(user.id);
    return NextResponse.json({ user, hotelId: hotel.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(err) }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


