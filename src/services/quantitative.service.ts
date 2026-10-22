import { query, queryOne, execute } from '../config/db';

export interface QuantitativeDto {
    StoreId: string;
    ProductId: string;
    ProductName: string;
    Quantity: number;
}

export class QuantitativeService {
    static async getByStoreId(storeId: string): Promise<QuantitativeDto[]> {
        return await query(
            `SELECT q.StoreId, q.ProductId, q.Quantity, p.ProductName
             FROM Quantitatives q
             JOIN Products p ON q.ProductId = p.ProductId
             WHERE q.StoreId = @storeId AND p.isDeleted = 0`,
            { storeId }
        );
    }

    static async update(storeId: string, productId: string, quantity: number): Promise<boolean> {
        const existing = await queryOne(
            'SELECT * FROM Quantitatives WHERE StoreId = @storeId AND ProductId = @productId',
            { storeId, productId }
        );

        if (!existing) {
            return false;
        }

        await execute(
            'UPDATE Quantitatives SET Quantity = @quantity WHERE StoreId = @storeId AND ProductId = @productId',
            { storeId, productId, quantity }
        );
        return true;
    }
}
