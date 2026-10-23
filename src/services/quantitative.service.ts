import { query, queryOne, execute } from '../config/db';

export interface QuantitativeDto {
    storeId: string;
    productId: string;
    productName: string;
    quantity: number;
}

export class QuantitativeService {
    static async getByStoreId(storeId: string): Promise<QuantitativeDto[]> {
        const rows = await query(
            `SELECT q.StoreId, q.ProductId, q.Quantity,
                    CASE WHEN p.ProductId IS NULL THEN N'Unknown Product' ELSE p.ProductName END AS ProductName
             FROM Quantitatives q
             LEFT JOIN Products p ON q.ProductId = p.ProductId
             WHERE q.StoreId = @storeId`,
            { storeId }
        );
        return rows.map(row => ({
            storeId: row.StoreId,
            productId: row.ProductId,
            productName: row.ProductName,
            quantity: row.Quantity
        }));
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
