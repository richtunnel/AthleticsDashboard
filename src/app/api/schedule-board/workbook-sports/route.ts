import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { sportComboLabel } from "@/lib/utils/formatGameDateTime";
import { normalizeGameCombo, comboKey, ColOverrides } from "@/lib/availability/normalizeGameCombo";

/**
 * GET /api/schedule-board/workbook-sports?workbookId=xxx
 *
 * Returns every unique (sport, level, gender) combo that has at least one
 * non-cancelled, non-sample game in the given workbook.
 *
 * Works with BOTH relational sport data AND raw customFields written by the
 * CSV importer, so it handles the common case where the importer falls back
 * to a "General" sport when it can't match the CSV text to an existing Sport.
 */
export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const workbookId = searchParams.get("workbookId");
  if (!workbookId) {
    return NextResponse.json({ error: "workbookId is required" }, { status: 400 });
  }

  const colOverrides: ColOverrides = {};
  const sportCol  = searchParams.get("sportCol");
  const levelCol  = searchParams.get("levelCol");
  const genderCol = searchParams.get("genderCol");
  if (sportCol)  colOverrides.sport  = sportCol;
  if (levelCol)  colOverrides.level  = levelCol;
  if (genderCol) colOverrides.gender = genderCol;
  const hasOverrides = !!(sportCol || levelCol || genderCol);

  try {
    // Verify ownership
    const workbook = await prisma.gamesWorkbook.findFirst({
      where: { id: workbookId, userId: session.user.id },
    });
    if (!workbook) {
      return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
    }

    const games = await prisma.game.findMany({
      where: {
        workbookId,
        status:      { not: "CANCELLED" },
        isSampleGame: false,
      },
      select: {
        customFields: true,
        customData:   true,
        homeTeam: {
          select: {
            name:   true,
            sport:  { select: { name: true } },
            level:  true,
            gender: true,
          },
        },
      },
    });

    // Collect all unique customFields keys across games for column mapping UI
    const colKeySet = new Set<string>();
    for (const g of games) {
      const cf = (g.customFields ?? g.customData ?? {}) as Record<string, unknown>;
      for (const k of Object.keys(cf)) {
        if (typeof cf[k] === "string" && cf[k]) colKeySet.add(k);
      }
    }
    const availableColumns = Array.from(colKeySet).sort();

    // Deduplicate combos using the normalizer that reads both relational + customFields
    const seen   = new Set<string>();
    const combos: Array<{
      key:    string;
      sport:  string;
      level:  string;
      gender: string;
      label:  string;
    }> = [];

    for (const g of games) {
      const { sport, level, gender } = normalizeGameCombo(g, hasOverrides ? colOverrides : undefined);
      const key = comboKey(sport, level, gender);

      if (!seen.has(key)) {
        seen.add(key);
        combos.push({ key, sport, level, gender, label: sportComboLabel(sport, level, gender) });
      }
    }

    combos.sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ combos, availableColumns });
  } catch (err) {
    console.error("[workbook-sports GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
