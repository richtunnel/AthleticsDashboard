// pages/api/orgs/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/database/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const where = q
      ? {
          where: {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
        }
      : { where: {}, take: 20 };

    const orgs = await prisma.organization.findMany({
      where: q
        ? {
            name: {
              contains: q,
              mode: "insensitive",
            },
          }
        : undefined,
      take: 20,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    res.status(200).json(orgs);
  } catch (err) {
    console.error("api/orgs error:", err);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
}
