import { Knex } from "knex";

export abstract class BaseRepository {
  protected db: Knex;
  protected tableName: string;

  constructor(dbInstance: Knex, tableName: string) {
    this.db = dbInstance;
    this.tableName = tableName;
  }

  // Utility: Convert snake_case to camelCase
  protected camelCaseKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.camelCaseKeys(v));
    } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
      return Object.keys(obj).reduce((result, key) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = this.camelCaseKeys(obj[key]);
        return result;
      }, {} as any);
    }
    return obj;
  }

  // Utility: Convert camelCase to snake_case
  protected snakeCaseKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.snakeCaseKeys(v));
    } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
      return Object.keys(obj).reduce((result, key) => {
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        result[snakeKey] = this.snakeCaseKeys(obj[key]);
        return result;
      }, {} as any);
    }
    return obj;
  }

  // Common: Count records
  protected async count(where: Record<string, any> = {}): Promise<number> {
    const result = await this.db(this.tableName).where(where).count("id as count").first();

    return parseInt(result?.count as string) || 0;
  }

  // Common: Check if record exists
  protected async exists(id: string, organizationId?: string): Promise<boolean> {
    const where: any = { id };
    if (organizationId) {
      where.organization_id = organizationId;
    }

    const result = await this.db(this.tableName).where(where).first();

    return !!result;
  }
}

// Export singleton instances
export const teamRepository = new TeamRepository();
export const venueRepository = new VenueRepository();
export const opponentRepository = new OpponentRepository();
