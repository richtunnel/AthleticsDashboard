import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password, organizationId } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    await prisma.user.create({ data: { name, email, hashedPassword, organizationId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export async function GET() {
  return NextResponse.json({ message: "Signup endpoint. Use POST to create a user." });
}
