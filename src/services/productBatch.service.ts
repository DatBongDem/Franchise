import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';
import { StatusEnum } from '../constants/status.enum';

export class ProductBatchService {
    static async createProductBatch(dto: { ProductId: string; QualityOrder: number }, storeId: string): Promise<any> {
        const creatingOrder = await queryOne(
            `SELECT OrderId FROM Orders WHERE Status = @status AND StoreId = @storeId`,
            { status: StatusEnum.Creating, storeId }
        );
        if (!creatingOrder) {
            throw new Error(`No order with 'Creating' status found for StoreId ${storeId}.`);
        }

        const existing = await queryOne(
            `SELECT * FROM ProductBatches WHERE OrderId = @orderId AND ProductId = @productId`,
            { orderId: creatingOrder.OrderId, productId: dto.ProductId }
        );
        if (existing) {
            throw new Error('Product already exists in the order.');
        }

        const product = await queryOne('SELECT * FROM Products WHERE ProductId = @id AND isDeleted = 0', {
            id: dto.ProductId
        });
        if (!product) {
            throw new Error('Product not found.');
        }

        if (dto.QualityOrder <= 0) {
            throw new Error('QualityOrder must be greater than 0.');
        }

        const batchId = uuidv4();
        const price = (product.Price || 0) * dto.QualityOrder;

        await execute(
            `INSERT INTO ProductBatches (BatchId, ProductId, OrderId, QualityOrder, RemainingQuantity, Price, Status, Manufacture, Expiry)
             VALUES (@batchId, @productId, @orderId, @qualityOrder, @qualityOrder, @price, @status, NULL, NULL)`,
            {
                batchId,
                productId: dto.ProductId,
                orderId: creatingOrder.OrderId,
                qualityOrder: dto.QualityOrder,
                price,
                status: StatusEnum.Uncooked
            }
        );

        await this.recalculateOrderTotal(creatingOrder.OrderId);

        return await queryOne('SELECT * FROM ProductBatches WHERE BatchId = @batchId', { batchId });
    }

    static async updateProductBatchInCreatingOrder(productId: string, qualityOrder: number, storeId: string): Promise<any | null> {
        const creatingOrder = await queryOne(
            `SELECT OrderId FROM Orders WHERE Status = @status AND StoreId = @storeId`,
            { status: StatusEnum.Creating, storeId }
        );
        if (!creatingOrder) {
            throw new Error(`No order with 'Creating' status found for StoreId ${storeId}.`);
        }

        const batch = await queryOne(
            `SELECT * FROM ProductBatches WHERE OrderId = @orderId AND ProductId = @productId`,
            { orderId: creatingOrder.OrderId, productId }
        );
        if (!batch) {
            throw new Error('Product not found in the current order.');
        }

        if (qualityOrder <= 0) {
            await execute('DELETE FROM ProductBatches WHERE BatchId = @batchId', { batchId: batch.BatchId });
            await this.recalculateOrderTotal(creatingOrder.OrderId);
            return null;
        }

        const product = await queryOne('SELECT Price FROM Products WHERE ProductId = @id', { id: productId });
        const newPrice = (product?.Price || 0) * qualityOrder;

        await execute(
            `UPDATE ProductBatches
             SET QualityOrder = @qty, RemainingQuantity = @qty, Price = @price
             WHERE BatchId = @batchId`,
            { batchId: batch.BatchId, qty: qualityOrder, price: newPrice }
        );

        await this.recalculateOrderTotal(creatingOrder.OrderId);

        return await queryOne('SELECT * FROM ProductBatches WHERE BatchId = @batchId', { batchId: batch.BatchId });
    }

    static async recalculateOrderTotal(orderId: string): Promise<void> {
        const result = await queryOne(
            `SELECT SUM(Price) AS Total FROM ProductBatches WHERE OrderId = @orderId`,
            { orderId }
        );
        const total = result?.Total || 0;
        await execute('UPDATE Orders SET TotalAmount = @total WHERE OrderId = @orderId', { orderId, total });
    }

    static async getStoreShrinkage(userId: string, storeId: string): Promise<any> {
        const now = new Date();
        const expiredBatches = await query(
            `SELECT pb.*, p.ProductName, p.Unit, p.SellingPrice, o.StoreId
             FROM ProductBatches pb
             JOIN Products p ON pb.ProductId = p.ProductId
             JOIN Orders o ON pb.OrderId = o.OrderId
             WHERE o.StoreId = @storeId
               AND o.Status = @completedStatus
               AND pb.Expiry <= @now
               AND pb.RemainingQuantity > 0`,
            { storeId, completedStatus: StatusEnum.Completed, now }
        );

        let totalLoss = 0;
        const items = expiredBatches.map(b => {
            const lossAmount = b.RemainingQuantity * (b.SellingPrice || 0);
            totalLoss += lossAmount;
            return {
                batchId: b.BatchId,
                productId: b.ProductId,
                productName: b.ProductName,
                unit: b.Unit,
                expiredQuantity: b.RemainingQuantity,
                unitPrice: b.SellingPrice,
                lossAmount,
                expiryDate: b.Expiry
            };
        });

        return {
            storeId,
            totalLoss,
            items
        };
    }
}
