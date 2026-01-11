import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/utils/authOptions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { schoolName, teamName, schoolAddress, schoolEmail } = body;
  
  // Validate email format if provided
  if (schoolEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolEmail.trim())) {
    return NextResponse.json({ error: "Invalid school email format" }, { status: 400 });
  }

  // Build update data
  const updateData: { schoolName: string; teamName: string; schoolAddress: string; schoolEmail?: string | null } = { 
    schoolName, 
    teamName, 
    schoolAddress 
  };
  
  if (schoolEmail !== undefined) {
    updateData.schoolEmail = schoolEmail?.trim() || null;
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: updateData,
  });
  return NextResponse.json({ success: true });
}
