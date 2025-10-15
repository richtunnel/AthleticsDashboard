import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/utils/authOptions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { schoolName, teamName, mascot } = await req.json();
  await prisma.user.update({
    where: { email: session.user.email },
    data: { schoolName, teamName, mascot },
  });
  return NextResponse.json({ success: true });
}
