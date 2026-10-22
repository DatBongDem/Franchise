import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';

export interface StoreDto {
    StoreId: string;
    StoreName: string;
    Address?: string | null;
    Status: boolean;
}

export class StoreService {
    static async getAll(): Promise<StoreDto[]> {
        return await query('SELECT StoreId, StoreName, Address, Status FROM Stores');
    }

    static async getById(id: string): Promise<StoreDto | null> {
        return await queryOne('SELECT StoreId, StoreName, Address, Status FROM Stores WHERE StoreId = @id', { id });
    }

    static async create(dto: { StoreName: string; Address?: string }): Promise<StoreDto> {
        const storeId = uuidv4();
        await execute(
            `INSERT INTO Stores (StoreId, StoreName, Address, Status)
             VALUES (@storeId, @storeName, @address, 1)`,
            {
                storeId,
                storeName: dto.StoreName,
                address: dto.Address || null
            }
        );

        // Auto-create quantitatives for all existing products for this new store
        const products = await query('SELECT ProductId FROM Products WHERE isDeleted = 0');
        for (const p of products) {
            await execute(
                `IF NOT EXISTS (SELECT * FROM Quantitatives WHERE StoreId = @storeId AND ProductId = @productId)
                 INSERT INTO Quantitatives (StoreId, ProductId, Quantity) VALUES (@storeId, @productId, 0)`,
                { storeId, productId: p.ProductId }
            );
        }

        return (await this.getById(storeId))!;
    }

    static async update(id: string, dto: { StoreName: string; Address?: string }): Promise<boolean> {
        const store = await this.getById(id);
        if (!store) return false;

        await execute(
            `UPDATE Stores SET StoreName = @storeName, Address = @address WHERE StoreId = @id`,
            {
                id,
                storeName: dto.StoreName,
                address: dto.Address ?? store.Address
            }
        );
        return true;
    }

    static async delete(id: string): Promise<boolean> {
        const result = await execute('DELETE FROM Stores WHERE StoreId = @id', { id });
        return (result.rowsAffected[0] || 0) > 0;
    }
}
