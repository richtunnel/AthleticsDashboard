import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        hideChatMenu:      true,
        hidePostsMenu:     true,
        hideParentsMenu:   true,
        hideFindGamesMenu: true,
      },
    });

    return NextResponse.json({
      hideChatMenu:      user?.hideChatMenu      ?? false,
      hidePostsMenu:     user?.hidePostsMenu     ?? false,
      hideParentsMenu:   user?.hideParentsMenu   ?? false,
      hideFindGamesMenu: user?.hideFindGamesMenu ?? false,
    });
  } catch (error) {
    console.error("Error fetching menu visibility settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const allowed = ["hideChatMenu", "hidePostsMenu", "hideParentsMenu", "hideFindGamesMenu"] as const;
    const data: Partial<Record<(typeof allowed)[number], boolean>> = {};

    for (const key of allowed) {
      if (typeof body[key] === "boolean") {
        data[key] = body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Error updating menu visibility settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
