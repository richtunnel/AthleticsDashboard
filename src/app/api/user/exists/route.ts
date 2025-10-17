import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // TODO: Add rate limiting middleware here!
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    return NextResponse.json({ exists: !!user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to check email" }, { status: 500 });
  }
}
