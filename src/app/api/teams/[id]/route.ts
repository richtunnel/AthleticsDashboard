import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const { id } = params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      sport: true,
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ data: team });
}

// export async function PATCH(req: Request, { params }: Params) {
//   const { id } = params;
//   const body = await req.json();

//   // Whitelist fields you allow to update
//   const { name, level, location, sportId } = body as {
//     name?: string;
//     level?: string;
//     location?: string;
//     sportId?: string;
//   };

//   try {
//     const updated = await prisma.team.update({
//       where: { id },
//       data: {
//         ...(name !== undefined ? { name } : {}),
//         ...(level !== undefined ? { level } : {}),
//         ...(location !== undefined ? { location } : {}),
//         ...(sportId !== undefined ? { sportId } : {}),
//       },
//       include: { sport: true },
//     });

//     return NextResponse.json({ data: updated });
//   } catch (err) {
//     return NextResponse.json({ error: "Failed to update team" }, { status: 400 });
//   }
// }

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = params;

  try {
    await prisma.team.delete({
      where: {
        id,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete team" }, { status: 400 });
  }
}
