import { query } from '../config/db';
import { StatusEnum } from '../constants/status.enum';

export interface ProductInventoryDto {
    ProductId: string;
    ProductName: string;
    Unit?: string | null;
    TotalQuantity: number;
}

export class WarehouseService {
    static async getStoreInventory(storeId: string): Promise<ProductInventoryDto[]> {
        const now = new Date();
        const rows = await query(
            `SELECT p.ProductId, p.ProductName, p.Unit, ISNULL(SUM(pb.RemainingQuantity), 0) AS TotalQuantity
             FROM ProductBatches pb
             JOIN Orders o ON pb.OrderId = o.OrderId
             JOIN Products p ON pb.ProductId = p.ProductId
             WHERE o.StoreId = @storeId
               AND o.Status = @completedStatus
               AND (pb.Expiry IS NULL OR pb.Expiry > @now)
             GROUP BY p.ProductId, p.ProductName, p.Unit`,
            { storeId, completedStatus: StatusEnum.Completed, now }
        );

        return rows;
    }

    static async getAllProductsInventory(): Promise<ProductInventoryDto[]> {
        const now = new Date();
        const rows = await query(
            `SELECT p.ProductId, p.ProductName, p.Unit,
                    ISNULL(
                        (SELECT SUM(pb.RemainingQuantity)
                         FROM ProductBatches pb
                         JOIN Orders o ON pb.OrderId = o.OrderId
                         WHERE pb.ProductId = p.ProductId
                           AND o.Status = @completedStatus
                           AND (pb.Expiry IS NULL OR pb.Expiry > @now)),
                        0
                    ) AS TotalQuantity
             FROM Products p
             WHERE p.isDeleted = 0`,
            { completedStatus: StatusEnum.Completed, now }
        );

        return rows;
    }

    static async getExpiredInventorySummary(): Promise<ProductInventoryDto[]> {
        const now = new Date();
        const rows = await query(
            `SELECT p.ProductId, p.ProductName, p.Unit, SUM(pb.RemainingQuantity) AS TotalQuantity
             FROM ProductBatches pb
             JOIN Orders o ON pb.OrderId = o.OrderId
             JOIN Products p ON pb.ProductId = p.ProductId
             WHERE o.Status = @completedStatus
               AND pb.Expiry <= @now
               AND pb.RemainingQuantity > 0
             GROUP BY p.ProductId, p.ProductName, p.Unit`,
            { completedStatus: StatusEnum.Completed, now }
        );

        return rows;
    }

    static async getExpiredInventoryByDate(date: Date): Promise<ProductInventoryDto[]> {
        const dateStr = date.toISOString().split('T')[0];
        const rows = await query(
            `SELECT p.ProductId, p.ProductName, p.Unit, SUM(pb.RemainingQuantity) AS TotalQuantity
             FROM ProductBatches pb
             JOIN Orders o ON pb.OrderId = o.OrderId
             JOIN Products p ON pb.ProductId = p.ProductId
             WHERE o.Status = @completedStatus
               AND CAST(pb.Expiry AS DATE) = CAST(@dateStr AS DATE)
               AND pb.RemainingQuantity > 0
             GROUP BY p.ProductId, p.ProductName, p.Unit`,
            { completedStatus: StatusEnum.Completed, dateStr }
        );

        return rows;
    }

    static async getProductBatchesByProductId(productId: string): Promise<any[]> {
        const rows = await query(
            `SELECT pb.BatchId, pb.ProductId, p.ProductName, pb.Price, p.Unit,
                    pb.QualityOrder, pb.RemainingQuantity, pb.Status, pb.Manufacture, pb.Expiry
             FROM ProductBatches pb
             JOIN Orders o ON pb.OrderId = o.OrderId
             JOIN Products p ON pb.ProductId = p.ProductId
             WHERE pb.ProductId = @productId
               AND o.Status = @completedStatus`,
            { productId, completedStatus: StatusEnum.Completed }
        );

        return rows;
    }
}
