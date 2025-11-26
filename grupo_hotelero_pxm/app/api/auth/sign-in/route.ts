import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SignInSchema = z.object({
  email_or_username: z.string(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = SignInSchema.parse(json);

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: body.email_or_username }, { username: body.email_or_username }],
      },
      select: { id: true, passwordHash: true, username: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


