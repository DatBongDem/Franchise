import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';

export interface IngredientDto {
    IngredientId: string;
    IngredientName: string;
    Unit: string;
    Status: string;
}

export class IngredientService {
    static async getAll(): Promise<IngredientDto[]> {
        return await query('SELECT IngredientId, IngredientName, Unit, Status FROM Ingredients');
    }

    static async getById(id: string): Promise<IngredientDto | null> {
        return await queryOne('SELECT IngredientId, IngredientName, Unit, Status FROM Ingredients WHERE IngredientId = @id', { id });
    }

    static async create(dto: { IngredientName: string; Unit: string; Status?: string }): Promise<IngredientDto> {
        const id = uuidv4();
        await execute(
            `INSERT INTO Ingredients (IngredientId, IngredientName, Unit, Status)
             VALUES (@id, @name, @unit, @status)`,
            {
                id,
                name: dto.IngredientName,
                unit: dto.Unit,
                status: dto.Status || 'Active'
            }
        );
        return (await this.getById(id))!;
    }

    static async update(id: string, dto: { IngredientName: string; Unit: string; Status?: string }): Promise<boolean> {
        const item = await this.getById(id);
        if (!item) return false;

        await execute(
            `UPDATE Ingredients
             SET IngredientName = @name, Unit = @unit, Status = @status
             WHERE IngredientId = @id`,
            {
                id,
                name: dto.IngredientName,
                unit: dto.Unit,
                status: dto.Status || item.Status
            }
        );
        return true;
    }

    static async delete(id: string): Promise<boolean> {
        const result = await execute('DELETE FROM Ingredients WHERE IngredientId = @id', { id });
        return (result.rowsAffected[0] || 0) > 0;
    }

    static async getCookingIngredientsByOrder(orderId: string): Promise<any[]> {
        return await query(
            `SELECT cih.*, i.IngredientName
             FROM CookingIngredientHistories cih
             JOIN Ingredients i ON cih.IngredientId = i.IngredientId
             JOIN ProductBatches pb ON (cih.BatchId = pb.BatchId OR cih.ProductBatchBatchId = pb.BatchId)
             WHERE pb.OrderId = @orderId`,
            { orderId }
        );
    }

    static async getAllCookingIngredientHistories(pageNumber: number = 1, pageSize: number = 10): Promise<{ items: any[]; totalCount: number }> {
        const offset = (pageNumber - 1) * pageSize;
        const total = await queryOne('SELECT COUNT(*) AS count FROM CookingIngredientHistories');
        const items = await query(
            `SELECT cih.*, i.IngredientName
             FROM CookingIngredientHistories cih
             JOIN Ingredients i ON cih.IngredientId = i.IngredientId
             ORDER BY cih.CreatedTime DESC
             OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
            { offset, pageSize }
        );
        return { items, totalCount: total?.count || 0 };
    }
}
