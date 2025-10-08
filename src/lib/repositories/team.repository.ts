import { Knex } from "knex";
import { db } from "../database/db";
import { CreateTeam, UpdateTeam, Team } from "../validations/games";
import { BaseRepository } from "./base.repository";

export class TeamRepository extends BaseRepository {
  constructor(dbInstance: Knex = db) {
    super(dbInstance, "teams");
  }

  async findAll(organizationId: string): Promise<Team[]> {
    const teams = await this.db(this.tableName)
      .where("organization_id", organizationId)
      .join("sports", "teams.sport_id", "sports.id")
      .select(
        "teams.*",
        this.db.raw(`
          json_build_object(
            'id', sports.id,
            'name', sports.name,
            'season', sports.season
          ) as sport
        `)
      )
      .orderBy("teams.name");

    return this.camelCaseKeys(teams);
  }

  async findById(id: string, organizationId: string): Promise<Team | null> {
    const team = await this.db(this.tableName).where("teams.id", id).where("organization_id", organizationId).join("sports", "teams.sport_id", "sports.id").select("teams.*").first();

    return team ? this.camelCaseKeys(team) : null;
  }

  async create(data: CreateTeam): Promise<Team> {
    const [team] = await this.db(this.tableName).insert(this.snakeCaseKeys(data)).returning("*");

    return this.camelCaseKeys(team);
  }

  async update(id: string, data: UpdateTeam, organizationId: string): Promise<Team> {
    await this.verifyOwnership(id, organizationId);

    const [updated] = await this.db(this.tableName)
      .where("id", id)
      .update({
        ...this.snakeCaseKeys(data),
        updated_at: this.db.fn.now(),
      })
      .returning("*");

    return this.camelCaseKeys(updated);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.verifyOwnership(id, organizationId);
    await this.db(this.tableName).where("id", id).delete();
  }

  private async verifyOwnership(id: string, organizationId: string): Promise<void> {
    const team = await this.db(this.tableName).where("id", id).where("organization_id", organizationId).first();

    if (!team) {
      throw new Error("Team not found or access denied");
    }
  }
}
