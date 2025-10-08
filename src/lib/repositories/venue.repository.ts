import { Knex } from "knex";
import { db } from "../database/db";
import { CreateVenue, UpdateVenue, Venue } from "../validations/games";
import { BaseRepository } from "./base.repository";

export class VenueRepository extends BaseRepository {
  constructor(dbInstance: Knex = db) {
    super(dbInstance, "venues");
  }

  async findAll(organizationId: string): Promise<Venue[]> {
    const venues = await this.db(this.tableName).where("organization_id", organizationId).orderBy("name");

    return this.camelCaseKeys(venues);
  }

  async findById(id: string, organizationId: string): Promise<Venue | null> {
    const venue = await this.db(this.tableName).where("id", id).where("organization_id", organizationId).first();

    return venue ? this.camelCaseKeys(venue) : null;
  }

  async create(data: CreateVenue): Promise<Venue> {
    const [venue] = await this.db(this.tableName).insert(this.snakeCaseKeys(data)).returning("*");

    return this.camelCaseKeys(venue);
  }

  async update(id: string, data: UpdateVenue, organizationId: string): Promise<Venue> {
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
    const venue = await this.db(this.tableName).where("id", id).where("organization_id", organizationId).first();

    if (!venue) {
      throw new Error("Venue not found or access denied");
    }
  }
}
