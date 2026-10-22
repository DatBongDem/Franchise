import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';

export class IngredientHistoryOrderNotFoundError extends Error {}

export interface CookingIngredientHistoryDto {
    ingredientId: string;
    ingredientName: string;
    quantityUsed: number;
    unit: string;
}

function toHistoryDto(row: any): CookingIngredientHistoryDto {
    return {
        ingredientId: row.IngredientId,
        ingredientName: row.IngredientName ?? 'N/A',
        quantityUsed: row.QuantityUsed,
        unit: row.Unit
    };
}

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

    static async update(id: string, dto: { IngredientName: string; Unit: string }): Promise<boolean> {
        const item = await this.getById(id);
        if (!item) return false;

        await execute(
            `UPDATE Ingredients
             SET IngredientName = @name, Unit = @unit
             WHERE IngredientId = @id`,
            {
                id,
                name: dto.IngredientName,
                unit: dto.Unit
            }
        );
        return true;
    }

    static async delete(id: string): Promise<boolean> {
        const result = await execute('DELETE FROM Ingredients WHERE IngredientId = @id', { id });
        return (result.rowsAffected[0] || 0) > 0;
    }

    static async getCookingIngredientsByOrder(orderId: string): Promise<CookingIngredientHistoryDto[]> {
        const order = await queryOne('SELECT OrderId FROM Orders WHERE OrderId = @orderId', { orderId });
        if (!order) throw new IngredientHistoryOrderNotFoundError('Order not found.');
        const batches = await query('SELECT BatchId FROM ProductBatches WHERE OrderId = @orderId', { orderId });
        if (batches.length === 0) return [];

        let histories;
        try {
            histories = await query(
                `SELECT cih.IngredientId, i.IngredientName, cih.QuantityUsed, cih.Unit
                 FROM CookingIngredientHistories cih
                 LEFT JOIN Ingredients i ON cih.IngredientId = i.IngredientId
                 WHERE cih.BatchId IN (SELECT BatchId FROM OPENJSON(@batchIds) WITH (BatchId uniqueidentifier '$'))`,
                { batchIds: JSON.stringify(batches.map(batch => batch.BatchId)) }
            );
        } catch {
            throw new Error('An error occurred while fetching data from the database.');
        }
        try {
            return histories.map(toHistoryDto);
        } catch {
            throw new Error('An error occurred while mapping data to DTO.');
        }
    }

    static async getAllCookingIngredientHistories(pageNumber: number = 1, pageSize: number = 10): Promise<{
        items: CookingIngredientHistoryDto[]; totalRecords: number; pageNumber: number; pageSize: number; totalPages: number;
    }> {
        const offset = (pageNumber - 1) * pageSize;
        const total = await queryOne('SELECT COUNT(*) AS count FROM CookingIngredientHistories');
        const items = await query(
            `SELECT cih.IngredientId, i.IngredientName, cih.QuantityUsed, cih.Unit
             FROM CookingIngredientHistories cih
             LEFT JOIN Ingredients i ON cih.IngredientId = i.IngredientId
             ORDER BY cih.CreatedTime DESC
             OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
            { offset, pageSize }
        );
        const totalRecords = total?.count ?? 0;
        return { items: items.map(toHistoryDto), totalRecords, pageNumber, pageSize, totalPages: Math.ceil(totalRecords / pageSize) };
    }
}
