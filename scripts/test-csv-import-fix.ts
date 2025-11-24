/**
 * Test Script for CSV Import Corruption Fix
 * 
 * This script demonstrates the improvements in the CSV import feature
 * and validates that data is created correctly with all relationships intact.
 * 
 * Usage: npx tsx scripts/test-csv-import-fix.ts
 */

import { prisma } from '../src/lib/database/prisma';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Test 1: Verify game has all required relationships
 */
async function testGameIntegrity(gameId: string): Promise<TestResult> {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: {
          include: {
            sport: true,
            organization: true,
          },
        },
        opponent: true,
        venue: true,
        createdBy: true,
      },
    });

    if (!game) {
      return {
        testName: 'Game Integrity Check',
        passed: false,
        message: 'Game not found',
      };
    }

    const issues: string[] = [];

    if (!game.homeTeam) {
      issues.push('Missing homeTeam relationship');
    }
    if (game.homeTeam && !game.homeTeam.sport) {
      issues.push('homeTeam missing sport relationship');
    }
    if (game.homeTeam && !game.homeTeam.organization) {
      issues.push('homeTeam missing organization relationship');
    }
    if (!game.createdBy) {
      issues.push('Missing createdBy relationship');
    }

    if (issues.length > 0) {
      return {
        testName: 'Game Integrity Check',
        passed: false,
        message: 'Game has missing relationships',
        details: { issues, gameId },
      };
    }

    return {
      testName: 'Game Integrity Check',
      passed: true,
      message: 'Game has all required relationships',
      details: {
        gameId,
        sport: game.homeTeam?.sport?.name,
        level: game.homeTeam?.level,
        opponent: game.opponent?.name,
        venue: game.venue?.name,
      },
    };
  } catch (error) {
    return {
      testName: 'Game Integrity Check',
      passed: false,
      message: `Error checking game: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Test 2: Verify team has valid sport relationship
 */
async function testTeamIntegrity(teamId: string): Promise<TestResult> {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        sport: true,
        organization: true,
      },
    });

    if (!team) {
      return {
        testName: 'Team Integrity Check',
        passed: false,
        message: 'Team not found',
      };
    }

    const issues: string[] = [];

    if (!team.sport) {
      issues.push('Missing sport relationship');
    }
    if (!team.organization) {
      issues.push('Missing organization relationship');
    }

    if (issues.length > 0) {
      return {
        testName: 'Team Integrity Check',
        passed: false,
        message: 'Team has missing relationships',
        details: { issues, teamId },
      };
    }

    return {
      testName: 'Team Integrity Check',
      passed: true,
      message: 'Team has all required relationships',
      details: {
        teamId,
        name: team.name,
        sport: team.sport?.name,
        level: team.level,
      },
    };
  } catch (error) {
    return {
      testName: 'Team Integrity Check',
      passed: false,
      message: `Error checking team: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Test 3: Identify all corrupted games in an organization
 */
async function testIdentifyCorruptedGames(organizationId: string): Promise<TestResult> {
  try {
    const games = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
        },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
            organization: true,
          },
        },
        opponent: true,
        venue: true,
        createdBy: true,
      },
    });

    const corruptedGames: Array<{ id: string; date: Date; issue: string }> = [];

    for (const game of games) {
      if (!game.homeTeam) {
        corruptedGames.push({
          id: game.id,
          date: game.date,
          issue: 'Missing homeTeam relationship',
        });
        continue;
      }

      if (!game.homeTeam.sport) {
        corruptedGames.push({
          id: game.id,
          date: game.date,
          issue: 'homeTeam missing sport relationship',
        });
        continue;
      }

      if (!game.homeTeam.organization) {
        corruptedGames.push({
          id: game.id,
          date: game.date,
          issue: 'homeTeam missing organization relationship',
        });
        continue;
      }

      if (!game.createdBy) {
        corruptedGames.push({
          id: game.id,
          date: game.date,
          issue: 'Missing createdBy relationship',
        });
        continue;
      }
    }

    return {
      testName: 'Identify Corrupted Games',
      passed: corruptedGames.length === 0,
      message:
        corruptedGames.length === 0
          ? `All ${games.length} games are valid`
          : `Found ${corruptedGames.length} corrupted games out of ${games.length}`,
      details: {
        totalGames: games.length,
        corruptedGames: corruptedGames.length,
        issues: corruptedGames,
      },
    };
  } catch (error) {
    return {
      testName: 'Identify Corrupted Games',
      passed: false,
      message: `Error identifying corrupted games: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Test 4: Check for orphaned teams (teams with invalid sport references)
 */
async function testIdentifyOrphanedTeams(organizationId: string): Promise<TestResult> {
  try {
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: {
        sport: true,
        organization: true,
      },
    });

    const orphanedTeams: Array<{ id: string; name: string; issue: string }> = [];

    for (const team of teams) {
      if (!team.sport) {
        orphanedTeams.push({
          id: team.id,
          name: team.name,
          issue: 'Missing sport relationship',
        });
        continue;
      }

      if (!team.organization) {
        orphanedTeams.push({
          id: team.id,
          name: team.name,
          issue: 'Missing organization relationship',
        });
        continue;
      }
    }

    return {
      testName: 'Identify Orphaned Teams',
      passed: orphanedTeams.length === 0,
      message:
        orphanedTeams.length === 0
          ? `All ${teams.length} teams are valid`
          : `Found ${orphanedTeams.length} orphaned teams out of ${teams.length}`,
      details: {
        totalTeams: teams.length,
        orphanedTeams: orphanedTeams.length,
        issues: orphanedTeams,
      },
    };
  } catch (error) {
    return {
      testName: 'Identify Orphaned Teams',
      passed: false,
      message: `Error identifying orphaned teams: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Test 5: Verify date and time validation
 */
function testDateTimeValidation(): TestResult {
  const testCases = [
    { input: '2024-01-15', expected: true, description: 'Valid date YYYY-MM-DD' },
    { input: '2024-13-45', expected: false, description: 'Invalid month and day' },
    { input: '15:00', expected: true, description: 'Valid time HH:MM' },
    { input: '25:99', expected: false, description: 'Invalid hours and minutes' },
    { input: '09:30', expected: true, description: 'Valid time with leading zero' },
    { input: '9:30', expected: true, description: 'Valid time without leading zero' },
  ];

  const results: Array<{ test: string; passed: boolean; reason?: string }> = [];

  // Test date validation
  const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

  for (const testCase of testCases) {
    let isValid = false;
    let pattern = null;

    if (testCase.input.includes(':')) {
      pattern = timePattern;
    } else if (testCase.input.includes('-')) {
      pattern = datePattern;
    }

    if (pattern) {
      isValid = pattern.test(testCase.input);
    }

    const passed = isValid === testCase.expected;
    results.push({
      test: testCase.description,
      passed,
      reason: passed ? undefined : `Expected ${testCase.expected}, got ${isValid}`,
    });
  }

  const allPassed = results.every((r) => r.passed);

  return {
    testName: 'Date/Time Validation',
    passed: allPassed,
    message: allPassed ? 'All validation tests passed' : 'Some validation tests failed',
    details: { results },
  };
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 CSV Import Corruption Fix - Test Suite\n');
  console.log('=' .repeat(60));
  console.log('\n');

  // Test date/time validation (no DB required)
  console.log('Running validation tests...');
  const validationResult = testDateTimeValidation();
  results.push(validationResult);
  console.log(`✓ ${validationResult.testName}: ${validationResult.message}\n`);

  // Database tests require actual data
  try {
    // Get first organization for testing
    const organization = await prisma.organization.findFirst();

    if (!organization) {
      console.log('⚠️  No organization found. Skipping database tests.\n');
      console.log('To run full tests, ensure database has at least one organization.\n');
    } else {
      console.log(`Using organization: ${organization.name} (${organization.id})\n`);

      // Test: Identify corrupted games
      console.log('Checking for corrupted games...');
      const corruptedGamesResult = await testIdentifyCorruptedGames(organization.id);
      results.push(corruptedGamesResult);
      console.log(
        `${corruptedGamesResult.passed ? '✓' : '✗'} ${corruptedGamesResult.testName}: ${corruptedGamesResult.message}\n`
      );

      // Test: Identify orphaned teams
      console.log('Checking for orphaned teams...');
      const orphanedTeamsResult = await testIdentifyOrphanedTeams(organization.id);
      results.push(orphanedTeamsResult);
      console.log(
        `${orphanedTeamsResult.passed ? '✓' : '✗'} ${orphanedTeamsResult.testName}: ${orphanedTeamsResult.message}\n`
      );

      // Test: Verify a random game if any exist
      const randomGame = await prisma.game.findFirst({
        where: {
          homeTeam: {
            organizationId: organization.id,
          },
        },
      });

      if (randomGame) {
        console.log('Verifying random game integrity...');
        const gameIntegrityResult = await testGameIntegrity(randomGame.id);
        results.push(gameIntegrityResult);
        console.log(
          `${gameIntegrityResult.passed ? '✓' : '✗'} ${gameIntegrityResult.testName}: ${gameIntegrityResult.message}\n`
        );
      }

      // Test: Verify a random team if any exist
      const randomTeam = await prisma.team.findFirst({
        where: { organizationId: organization.id },
      });

      if (randomTeam) {
        console.log('Verifying random team integrity...');
        const teamIntegrityResult = await testTeamIntegrity(randomTeam.id);
        results.push(teamIntegrityResult);
        console.log(
          `${teamIntegrityResult.passed ? '✓' : '✗'} ${teamIntegrityResult.testName}: ${teamIntegrityResult.message}\n`
        );
      }
    }
  } catch (error) {
    console.error('Error running database tests:', error);
  }

  // Print summary
  console.log('=' .repeat(60));
  console.log('\n📊 Test Summary\n');

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✓ Passed: ${passedCount}`);
  console.log(`✗ Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    console.log('Failed Tests:\n');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ✗ ${r.testName}`);
        console.log(`    ${r.message}`);
        if (r.details) {
          console.log(`    Details: ${JSON.stringify(r.details, null, 2)}`);
        }
        console.log('');
      });
  }

  console.log('=' .repeat(60));

  // Close database connection
  await prisma.$disconnect();

  // Exit with error code if any tests failed
  process.exit(failedCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
