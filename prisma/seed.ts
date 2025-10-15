import { PrismaClient, UserRole, TeamLevel, Gender, GameStatus } from "@prisma/client";
import { config } from "dotenv";
import fs from "fs";

config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Create Organization
  const org = await prisma.organization.upsert({
    where: { id: "dev-org-id" },
    update: { name: "Central High School", timezone: "America/New_York", state: "Texas" },
    create: { id: "dev-org-id", name: "Central High School", timezone: "America/New_York", state: "Texas" },
  });
  console.log("✅ Organization ready:", org.name);

  // 2. Create User (fixed 'adminUser')
  const adminUser = await prisma.user.upsert({
    where: { id: "dev-user-id" },
    update: { name: "John Smith", email: "dev@example.com", role: UserRole.ATHLETIC_DIRECTOR, organizationId: org.id },
    create: { id: "dev-user-id", name: "John Smith", email: "dev@example.com", role: UserRole.ATHLETIC_DIRECTOR, organizationId: org.id },
  });
  console.log("✅ User ready:", adminUser.name);

  // 3. Create Sports
  const sportsData = [
    { name: "Football", season: "FALL" as const },
    { name: "Basketball", season: "WINTER" as const },
    { name: "Soccer", season: "FALL" as const },
    { name: "Volleyball", season: "FALL" as const },
    { name: "Baseball", season: "SPRING" as const },
    { name: "Softball", season: "SPRING" as const },
  ];
  const sports = await Promise.all(
    sportsData.map((sport) => prisma.sport.upsert({ where: { name: sport.name }, update: { season: sport.season }, create: { name: sport.name, season: sport.season } }))
  );
  console.log("✅ Sports ready:", sports.length);

  // 4. Cleanup old data
  await prisma.game.deleteMany({ where: { homeTeam: { organizationId: org.id } } });
  await prisma.team.deleteMany({ where: { organizationId: org.id } });
  await prisma.opponent.deleteMany({ where: { organizationId: org.id } });
  await prisma.venue.deleteMany({ where: { organizationId: org.id } });
  console.log("✅ Cleanup complete");

  // 5. Create Teams (fixed indices)
  const teams = await Promise.all([
    // Football
    prisma.team.create({ data: { name: "Tigers Varsity", level: TeamLevel.VARSITY, gender: Gender.MALE, sportId: sports[0].id, organizationId: org.id } }),
    prisma.team.create({ data: { name: "Tigers JV", level: TeamLevel.JV, gender: Gender.MALE, sportId: sports[0].id, organizationId: org.id } }),
    // Basketball Boys
    prisma.team.create({ data: { name: "Tigers Boys Varsity", level: TeamLevel.VARSITY, gender: Gender.MALE, sportId: sports[1].id, organizationId: org.id } }),
    // Basketball Girls
    prisma.team.create({ data: { name: "Tigers Girls Varsity", level: TeamLevel.VARSITY, gender: Gender.FEMALE, sportId: sports[1].id, organizationId: org.id } }),
    // Soccer
    prisma.team.create({ data: { name: "Tigers Soccer Varsity", level: TeamLevel.VARSITY, gender: Gender.MALE, sportId: sports[2].id, organizationId: org.id } }),
    // Volleyball
    prisma.team.create({ data: { name: "Tigers Volleyball Varsity", level: TeamLevel.VARSITY, gender: Gender.FEMALE, sportId: sports[3].id, organizationId: org.id } }),
  ]);
  console.log("✅ Teams ready:", teams.length);

  // 6. Create Opponents
  const opponents = await Promise.all([
    prisma.opponent.create({ data: { name: "Oakwood", mascot: "Owls", colors: "Blue & Gold", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "Providence", mascot: "Panthers", colors: "Green & White", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "Brentwood", mascot: "Bears", colors: "Red & Black", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "Shalhevet", mascot: "Firebirds", colors: "Orange & Purple", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "Windward", mascot: "Wolves", colors: "Gray & Silver", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "Crossroads", mascot: "Crusaders", colors: "Gold & Navy", organizationId: org.id } }),
  ]);
  console.log("✅ Opponents ready:", opponents.length);

  // 7. Create Venues
  const venues = await Promise.all([
    prisma.venue.create({ data: { name: "YULA Gym", address: "123 School St", city: "Los Angeles", state: "CA", organizationId: org.id } }),
    prisma.venue.create({ data: { name: "YULA Field", address: "456 Field Rd", city: "Los Angeles", state: "CA", organizationId: org.id } }),
    prisma.venue.create({ data: { name: "Pan Pacific Courts", address: "789 Court Ave", city: "Los Angeles", state: "CA", organizationId: org.id } }),
  ]);
  console.log("✅ Venues ready:", venues.length);

  // 8. Hard-coded Games (from seed)
  const today = new Date();
  const games: Promise<any>[] = [];
  // Add your original hard-coded games here (football, basketball, etc.) – omitted for brevity, copy from your original seed.ts
  // Example for one:
  for (let i = 0; i < 8; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(today.getDate() + i * 7 + (5 - today.getDay())); // Fridays
    games.push(
      prisma.game.create({
        data: {
          date: gameDate,
          time: "19:00",
          status: i === 0 ? GameStatus.CONFIRMED : GameStatus.SCHEDULED,
          isHome: i % 2 === 0,
          homeTeamId: teams[0].id, // Tigers Varsity Football
          opponentId: opponents[i % opponents.length].id,
          venueId: i % 2 === 0 ? venues[0].id : venues[1].id,
          createdById: adminUser.id,
        },
      })
    );
  }
  await Promise.all(games);
  console.log("✅ Hard-coded games ready:", games.length);

  // 9. Seed from mock JSON (your events.json)
  const mockData = JSON.parse(fs.readFileSync("mock_data.json", "utf-8")).events;
  const mockGames = [];
  for (const event of mockData) {
    const sport = sports.find((s) => s.name.toLowerCase().includes(event.sport.toLowerCase().split(" ")[0])); // Map sport
    const team = teams.find((t) => t.name.toLowerCase().includes(event.level.toLowerCase()) && t.sportId === sport?.id); // Map team
    const opponent = opponents.find((o) => o.name === event.opponent) || opponents[0]; // Map opponent
    const venue = venues.find((v) => v.name.includes(event.location.split(" ")[0])) || venues[0]; // Map venue
    mockGames.push(
      prisma.game.create({
        data: {
          date: new Date(event.date),
          time: event.time,
          status: event.confirmed === "Yes" ? GameStatus.CONFIRMED : GameStatus.SCHEDULED,
          isHome: event.hja === "Home",
          notes: event.notes,
          homeTeamId: team?.id || teams[0].id,
          opponentId: opponent.id,
          venueId: venue.id,
          createdById: adminUser.id,
        },
      })
    );
  }
  await Promise.all(mockGames);
  console.log("✅ Mock JSON games ready:", mockGames.length);

  console.log("🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
