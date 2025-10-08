import { CreateOpponent, UpdateOpponent, Opponent } from "../validations/game";

export class OpponentRepository extends BaseRepository {
  constructor(dbInstance: Knex = db) {
    super(dbInstance, "opponents");
  }

  async findAll(organizationId: string): Promise<Opponent[]> {
    const opponents = await this.db(this.tableName).where("organization_id", organizationId).orderBy("name");

    return this.camelCaseKeys(opponents);
  }

  async findById(id: string, organizationId: string): Promise<Opponent | null> {
    const opponent = await this.db(this.tableName).where("id", id).where("organization_id", organizationId).first();

    return opponent ? this.camelCaseKeys(opponent) : null;
  }

  async create(data: CreateOpponent): Promise<Opponent> {
    const [opponent] = await this.db(this.tableName).insert(this.snakeCaseKeys(data)).returning("*");

    return this.camelCaseKeys(opponent);
  }

  async update(id: string, data: UpdateOpponent, organizationId: string): Promise<Opponent> {
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
    const opponent = await this.db(this.tableName).where("id", id).where("organization_id", organizationId).first();

    if (!opponent) {
      throw new Error("Opponent not found or access denied");
    }
  }
}
