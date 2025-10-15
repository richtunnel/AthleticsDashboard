import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { name, email, hashedPassword, organizationId } = await req.json();
  await prisma.user.create({ data: { name, email, hashedPassword, organizationId } });
  return NextResponse.json({ success: true });
}
