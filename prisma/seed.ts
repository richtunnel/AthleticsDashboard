import { PrismaClient, UserRole } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing data (optional - be careful in production!)
  // await prisma.game.deleteMany();
  // await prisma.team.deleteMany();
  // await prisma.sport.deleteMany();
  // await prisma.opponent.deleteMany();
  // await prisma.venue.deleteMany();
  // await prisma.user.deleteMany();
  // await prisma.organization.deleteMany();

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      id: "dev-org-id",
      name: "Central High School",
      timezone: "America/New_York",
      state: "Texas",
    },
  });
  console.log("✅ Created organization:", org.name);

  // 2. Create Users
  const adminUser = await prisma.user.create({
    data: {
      id: "dev-user-id",
      name: "John Smith",
      email: "dev@example.com",
      role: UserRole.ATHLETIC_DIRECTOR,
      organizationId: org.id,
    },
  });
  console.log("✅ Created user:", adminUser.name);

  // 3. Create Sports (global sports - no organizationId)
  // Check if sports already exist to avoid duplicates
  const existingSports = await prisma.sport.findMany();
  let sports;

  if (existingSports.length === 0) {
    sports = await Promise.all([
      prisma.sport.create({ data: { name: "Football", season: "FALL" } }),
      prisma.sport.create({ data: { name: "Basketball", season: "WINTER" } }),
      prisma.sport.create({ data: { name: "Soccer", season: "FALL" } }),
      prisma.sport.create({ data: { name: "Volleyball", season: "FALL" } }),
      prisma.sport.create({ data: { name: "Baseball", season: "SPRING" } }),
      prisma.sport.create({ data: { name: "Softball", season: "SPRING" } }),
    ]);
    console.log("✅ Created sports:", sports.length);
  } else {
    sports = existingSports;
    console.log("✅ Using existing sports:", sports.length);
  }

  // 4. Create Teams
  const teams = await Promise.all([
    // Football Teams
    prisma.team.create({ data: { name: "Tigers Varsity", level: "VARSITY", gender: "MALE", sportId: sports[0].id, organizationId: org.id } }),
    prisma.team.create({ data: { name: "Tigers JV", level: "JV", gender: "MALE", sportId: sports[0].id, organizationId: org.id } }),

    // Basketball Teams
    prisma.team.create({ data: { name: "Tigers Boys Varsity", level: "VARSITY", gender: "MALE", sportId: sports[1].id, organizationId: org.id } }),
    prisma.team.create({ data: { name: "Tigers Girls Varsity", level: "VARSITY", gender: "FEMALE", sportId: sports[1].id, organizationId: org.id } }),

    // Soccer Teams
    prisma.team.create({ data: { name: "Tigers Soccer Varsity", level: "VARSITY", gender: "MALE", sportId: sports[2].id, organizationId: org.id } }),

    // Volleyball Teams
    prisma.team.create({ data: { name: "Tigers Volleyball Varsity", level: "VARSITY", gender: "FEMALE", sportId: sports[3].id, organizationId: org.id } }),
  ]);
  console.log("✅ Created teams:", teams.length);

  // 5. Create Opponents
  const opponents = await Promise.all([
    prisma.opponent.create({ data: { name: "Eastside Eagles", mascot: "Eagles", colors: "Blue & White", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "Westbrook Warriors", mascot: "Warriors", colors: "Red & Gold", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "North Star Bulldogs", mascot: "Bulldogs", colors: "Green & Yellow", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "South Valley Panthers", mascot: "Panthers", colors: "Black & Orange", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "Lincoln Lions", mascot: "Lions", colors: "Purple & Gold", organizationId: org.id } }),
    prisma.opponent.create({ data: { name: "Jefferson Jaguars", mascot: "Jaguars", colors: "Teal & Silver", organizationId: org.id } }),
  ]);
  console.log("✅ Created opponents:", opponents.length);

  // 6. Create Venues
  const venues = await Promise.all([
    prisma.venue.create({
      data: {
        name: "Eastside Stadium",
        address: "456 East Rd",
        city: "Eastville",
        state: "TX",
        zipCode: "75001",
        organizationId: org.id,
      },
    }),
    prisma.venue.create({
      data: {
        name: "Westbrook Arena",
        address: "789 West Ave",
        city: "Westbrook",
        state: "TX",
        zipCode: "75002",
        organizationId: org.id,
      },
    }),
    prisma.venue.create({
      data: {
        name: "North Star Field",
        address: "321 North Blvd",
        city: "Northport",
        state: "TX",
        zipCode: "75003",
        organizationId: org.id,
      },
    }),
    prisma.venue.create({
      data: {
        name: "South Valley Sports Complex",
        address: "654 South St",
        city: "Southdale",
        state: "TX",
        zipCode: "75004",
        organizationId: org.id,
      },
    }),
  ]);
  console.log("✅ Created venues:", venues.length);

  // 7. Create Games
  const today = new Date();
  const games: Promise<any>[] = [];

  // Football Games - Next 8 weeks (Fridays)
  for (let i = 0; i < 8; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(today.getDate() + i * 7 + (5 - today.getDay())); // Next Friday

    games.push(
      prisma.game.create({
        data: {
          date: gameDate,
          time: "19:00",
          status: i === 0 ? "CONFIRMED" : "SCHEDULED",
          isHome: i % 2 === 0,
          homeTeamId: teams[0].id, // Football Varsity
          opponentId: opponents[i % opponents.length].id,
          venueId: i % 2 === 0 ? null : venues[i % venues.length].id,
          travelRequired: i % 2 !== 0,
          estimatedTravelTime: i % 2 !== 0 ? 45 + i * 5 : null,
          busCount: i % 2 !== 0 ? 2 : null,
          travelCost: i % 2 !== 0 ? 300 : null,
          notes: i === 0 ? "Homecoming game!" : i === 3 ? "Rivalry game" : null,
          createdById: adminUser.id,
        },
      })
    );
  }

  // Basketball Games - Multiple per week
  for (let i = 0; i < 12; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(today.getDate() + i * 3); // Every 3 days

    games.push(
      prisma.game.create({
        data: {
          date: gameDate,
          time: "18:30",
          status: "SCHEDULED",
          isHome: i % 2 === 1,
          homeTeamId: teams[2].id, // Boys Basketball
          opponentId: opponents[i % opponents.length].id,
          venueId: i % 2 === 1 ? null : venues[i % venues.length].id,
          travelRequired: i % 2 !== 1,
          estimatedTravelTime: i % 2 !== 1 ? 30 + i * 3 : null,
          busCount: i % 2 !== 1 ? 1 : null,
          travelCost: i % 2 !== 1 ? 150 : null,
          createdById: adminUser.id,
        },
      })
    );
  }

  // Girls Basketball Games
  for (let i = 0; i < 10; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(today.getDate() + i * 4 + 1);

    games.push(
      prisma.game.create({
        data: {
          date: gameDate,
          time: "17:00",
          status: i < 2 ? "CONFIRMED" : "SCHEDULED",
          isHome: i % 3 === 0,
          homeTeamId: teams[3].id, // Girls Basketball
          opponentId: opponents[i % opponents.length].id,
          venueId: i % 3 === 0 ? null : venues[i % venues.length].id,
          travelRequired: i % 3 !== 0,
          estimatedTravelTime: i % 3 !== 0 ? 35 + i * 4 : null,
          busCount: i % 3 !== 0 ? 1 : null,
          travelCost: i % 3 !== 0 ? 150 : null,
          notes: i === 0 ? "Senior night" : null,
          createdById: adminUser.id,
        },
      })
    );
  }

  // Soccer Games
  for (let i = 0; i < 8; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(today.getDate() + i * 5 + 2);

    games.push(
      prisma.game.create({
        data: {
          date: gameDate,
          time: "16:00",
          status: "SCHEDULED",
          isHome: i % 2 === 0,
          homeTeamId: teams[4].id, // Soccer
          opponentId: opponents[i % opponents.length].id,
          venueId: i % 2 === 0 ? null : venues[i % venues.length].id,
          travelRequired: i % 2 !== 0,
          estimatedTravelTime: i % 2 !== 0 ? 40 + i * 3 : null,
          busCount: i % 2 !== 0 ? 1 : null,
          travelCost: i % 2 !== 0 ? 150 : null,
          createdById: adminUser.id,
        },
      })
    );
  }

  // Volleyball Games
  for (let i = 0; i < 10; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(today.getDate() + i * 4 + 3);

    games.push(
      prisma.game.create({
        data: {
          date: gameDate,
          time: "18:00",
          status: "SCHEDULED",
          isHome: i % 2 === 1,
          homeTeamId: teams[5].id, // Volleyball
          opponentId: opponents[i % opponents.length].id,
          venueId: i % 2 === 1 ? null : venues[i % venues.length].id,
          travelRequired: i % 2 !== 1,
          estimatedTravelTime: i % 2 !== 1 ? 38 + i * 2 : null,
          busCount: i % 2 !== 1 ? 1 : null,
          travelCost: i % 2 !== 1 ? 150 : null,
          createdById: adminUser.id,
        },
      })
    );
  }

  await Promise.all(games);
  console.log("✅ Created games:", games.length);

  console.log("🎉 Seed completed successfully!");
  console.log(`
  📊 Summary:
  - Organizations: 1
  - Users: 1
  - Sports: ${sports.length}
  - Teams: ${teams.length}
  - Opponents: ${opponents.length}
  - Venues: ${venues.length}
  - Games: ${games.length}
  `);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
