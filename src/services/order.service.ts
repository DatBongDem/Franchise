import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';
import { StatusEnum } from '../constants/status.enum';

export class OrderNotFoundError extends Error {}
export class OrderInvalidStateError extends Error {}

export class OrderService {
    static async getCreatingOrderIdForStore(storeId: string): Promise<string | null> {
        const order = await queryOne(
            `SELECT OrderId FROM Orders WHERE StoreId = @storeId AND Status = @status`,
            { storeId, status: StatusEnum.Creating }
        );
        return order ? order.OrderId : null;
    }

    static async createOrder(dto: { Type?: string; Note?: string }, storeId: string, userId?: string | null): Promise<any> {
        const orderId = uuidv4();
        const type = dto.Type || StatusEnum.Normal;
        const note = dto.Note || '';

        await execute(
            `INSERT INTO Orders (OrderId, UserId, StoreId, TotalAmount, Status, Type, Note, SentTime)
             VALUES (@orderId, @userId, @storeId, 0, @status, @type, @note, NULL)`,
            {
                orderId,
                userId: userId || null,
                storeId,
                status: StatusEnum.Creating,
                type,
                note
            }
        );

        return await this.getOrderById(orderId);
    }

    static async getOrderById(orderId: string): Promise<any | null> {
        return await queryOne('SELECT * FROM Orders WHERE OrderId = @orderId', { orderId });
    }

    static async getAllOrders(): Promise<any[]> {
        return await query('SELECT * FROM Orders ORDER BY SentTime DESC');
    }

    static async getOrdersByStore(storeId: string): Promise<any[]> {
        return await query('SELECT * FROM Orders WHERE StoreId = @storeId ORDER BY SentTime DESC', { storeId });
    }

    static async getOrderWithDetails(orderId: string): Promise<any | null> {
        const order = await this.getOrderById(orderId);
        if (!order) return null;

        const batches = await query(
            `SELECT pb.*, p.ProductName, p.Unit
             FROM ProductBatches pb
             JOIN Products p ON pb.ProductId = p.ProductId
             WHERE pb.OrderId = @orderId`,
            { orderId }
        );

        return {
            ...order,
            ProductBatches: batches
        };
    }

    static async getAllOrdersWithProductBatches(): Promise<any[]> {
        const orders = await query('SELECT * FROM Orders ORDER BY SentTime DESC');
        const batches = await query(
            `SELECT pb.*, p.ProductName, p.Unit
             FROM ProductBatches pb
             JOIN Products p ON pb.ProductId = p.ProductId`
        );

        return orders.map(order => ({
            ...order,
            ProductBatches: batches.filter(b => b.OrderId === order.OrderId)
        }));
    }

    static async updateOrder(orderId: string, dto: { Type?: string; Note?: string }): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new Error(`Order with ID ${orderId} not found.`);
        if (order.Status === StatusEnum.Pending) {
            throw new Error('Cannot update an order that is already pending.');
        }

        await execute(
            `UPDATE Orders SET Type = @type, Note = @note WHERE OrderId = @orderId`,
            {
                orderId,
                type: dto.Type || order.Type,
                note: dto.Note ?? order.Note
            }
        );
    }

    static async sendOrderToPending(orderId: string, userId: string): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new Error(`Order with ID ${orderId} not found.`);
        if (order.Status !== StatusEnum.Creating) {
            throw new Error('Order status is not suitable for sending.');
        }

        const now = new Date();
        await execute(
            `UPDATE Orders
             SET Status = @status, SentTime = @now, UserId = @userId
             WHERE OrderId = @orderId`,
            {
                orderId,
                status: StatusEnum.Pending,
                now,
                userId
            }
        );

        // Auto create a new "Creating" order for this store
        await this.createOrder({ Type: StatusEnum.Normal, Note: '' }, order.StoreId, null);
    }

    static async pickUpOrder(orderId: string): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new OrderNotFoundError(`Order with ID ${orderId} not found.`);
        if (order.Status !== StatusEnum.Pending) {
            throw new OrderInvalidStateError('Order status is not suitable for pickup.');
        }

        await execute(
            `UPDATE Orders SET Status = @status, PickedUpTime = @now WHERE OrderId = @orderId`,
            // Match the Vietnam wall-clock time C# stores in SQL DATETIME2.
            { orderId, status: StatusEnum.PickedUp, now: new Date(Date.now() + 7 * 60 * 60 * 1000) }
        );
    }

    static async sendToKitchen(orderId: string): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new OrderNotFoundError(`Order with ID ${orderId} not found.`);
        if (order.Status !== StatusEnum.PickedUp) {
            throw new OrderInvalidStateError("Order status must be 'PickedUp' to be sent to the kitchen.");
        }

        await execute(
            `UPDATE Orders SET Status = @status, KitchenReceivedTime = @now WHERE OrderId = @orderId`,
            // Match the Vietnam wall-clock time C# stores in SQL DATETIME2.
            { orderId, status: StatusEnum.WaitingForCooking, now: new Date(Date.now() + 7 * 60 * 60 * 1000) }
        );
    }

    static async startCooking(orderId: string, userId: string): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new Error(`Order with ID ${orderId} not found.`);
        if (order.Status !== StatusEnum.WaitingForCooking && order.Status !== StatusEnum.Cooking) {
            throw new Error("Order status must be 'WaitingForCooking' to start cooking.");
        }

        const now = new Date();
        await execute(
            `UPDATE Orders SET Status = @status, CookingTime = @now WHERE OrderId = @orderId`,
            { orderId, status: StatusEnum.Cooking, now }
        );

        // Update batches
        await execute(
            `UPDATE ProductBatches SET Status = @status WHERE OrderId = @orderId AND Status != @cookedStatus`,
            { orderId, status: StatusEnum.Cooking, cookedStatus: StatusEnum.Cooked }
        );

        // Record cooking ingredient histories based on recipes
        const batches = await query('SELECT * FROM ProductBatches WHERE OrderId = @orderId', { orderId });
        for (const pb of batches) {
            const recipe = await queryOne('SELECT * FROM Recipes WHERE ProductID = @prodId', { prodId: pb.ProductId });
            if (recipe) {
                const recipeIngredients = await query(
                    `SELECT ri.*, i.Unit
                     FROM RecipeIngredients ri
                     JOIN Ingredients i ON ri.IngredientId = i.IngredientId
                     WHERE ri.RecipeId = @recipeId`,
                    { recipeId: recipe.RecipeID }
                );

                for (const ri of recipeIngredients) {
                    await execute(
                        `INSERT INTO CookingIngredientHistories
                         (CookingIngredientHistoryId, BatchId, ProductBatchBatchId, IngredientId, QuantityUsed, Unit, CreatedTime)
                         VALUES (@id, @batchId, @batchId, @ingId, @qty, @unit, @now)`,
                        {
                            id: uuidv4(),
                            batchId: pb.BatchId,
                            ingId: ri.IngredientId,
                            qty: ri.Quantity * pb.QualityOrder,
                            unit: ri.Unit,
                            now
                        }
                    );
                }
            }
        }
    }

    static async finishCooking(orderId: string): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new OrderNotFoundError(`Order with ID ${orderId} not found.`);

        // C# persists Vietnam wall-clock time in timezone-free SQL DATETIME2 fields.
        const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
        await execute(
            `UPDATE Orders SET Status = @status, CookedTime = @now WHERE OrderId = @orderId`,
            { orderId, status: StatusEnum.Cooked, now }
        );

        // Update batches with manufacture & expiry
        const batches = await query('SELECT pb.*, p.NumberOfDaysToExpire FROM ProductBatches pb JOIN Products p ON pb.ProductId = p.ProductId WHERE pb.OrderId = @orderId', { orderId });
        for (const b of batches) {
            const expiry = new Date(now);
            expiry.setUTCDate(expiry.getUTCDate() + b.NumberOfDaysToExpire);

            await execute(
                `UPDATE ProductBatches
                 SET Status = @status, Manufacture = @manufacture, Expiry = @expiry
                 WHERE BatchId = @batchId`,
                {
                    batchId: b.BatchId,
                    status: StatusEnum.Cooked,
                    manufacture: now,
                    expiry
                }
            );
        }
    }

    static async takeFromKitchen(orderId: string): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new Error(`Order with ID ${orderId} not found.`);
        if (order.Status !== StatusEnum.Cooked) {
            throw new Error("Order status must be 'Cooked' to be taken from the kitchen.");
        }

        await execute(
            `UPDATE Orders SET Status = @status, TakenFromKitchenTime = @now WHERE OrderId = @orderId`,
            { orderId, status: StatusEnum.TakenFromKitchen, now: new Date() }
        );
    }

    static async arriveAtStore(orderId: string): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new Error(`Order with ID ${orderId} not found.`);
        if (order.Status !== StatusEnum.TakenFromKitchen) {
            throw new Error("Order status must be 'TakenFromKitchen' to arrive at store.");
        }

        await execute(
            `UPDATE Orders SET Status = @status, ArrivedTime = @now WHERE OrderId = @orderId`,
            { orderId, status: StatusEnum.Arrived, now: new Date() }
        );
    }

    static async completeOrder(orderId: string, feedback?: string): Promise<void> {
        const order = await this.getOrderById(orderId);
        if (!order) throw new Error(`Order with ID ${orderId} not found.`);
        if (order.Status !== StatusEnum.Arrived) {
            throw new Error("Order status must be 'Arrived' to be marked as completed.");
        }

        const now = new Date();
        await execute(
            `UPDATE Orders SET Status = @status, CompletedTime = @now, Feedback = @feedback WHERE OrderId = @orderId`,
            { orderId, status: StatusEnum.Completed, now, feedback: feedback || null }
        );

        // Make batches available for sale in store
        await execute(
            `UPDATE ProductBatches
             SET Status = @normalStatus, RemainingQuantity = QualityOrder
             WHERE OrderId = @orderId`,
            { orderId, normalStatus: StatusEnum.Normal }
        );
    }

    static async cancelOrder(orderId: string, cancellationReason?: string): Promise<any> {
        const order = await this.getOrderById(orderId);
        if (!order) return null;
        if (order.Status === StatusEnum.Completed || order.Status === StatusEnum.Canceled) {
            throw new Error(`Order in status '${order.Status}' cannot be cancelled.`);
        }

        await execute(
            `UPDATE Orders
             SET Status = @status, CancellationReason = @reason, CancelledTime = @now
             WHERE OrderId = @orderId`,
            { orderId, status: StatusEnum.Canceled, reason: cancellationReason || null, now: new Date() }
        );

        return await this.getOrderById(orderId);
    }

    static async getOrdersHistoryAtStore(userId: string, storeId: string, pageNumber: number = 1, pageSize: number = 10): Promise<{ orders: any[]; totalRecords: number }> {
        const offset = (pageNumber - 1) * pageSize;
        const total = await queryOne('SELECT COUNT(*) AS count FROM Orders WHERE StoreId = @storeId', { storeId });
        const orders = await query(
            `SELECT * FROM Orders WHERE StoreId = @storeId ORDER BY SentTime DESC
             OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
            { storeId, offset, pageSize }
        );
        return { orders, totalRecords: total?.count || 0 };
    }

    static async getCookingOrders(): Promise<any[]> {
        const statuses = {
            s1: StatusEnum.WaitingForCooking,
            s2: StatusEnum.Cooking,
            s3: StatusEnum.Cooked
        };
        const orders = await query(
            `SELECT o.OrderId, o.UserId, o.StoreId, o.TotalAmount, o.Status,
                    o.Type, o.Note, o.SentTime, o.PickedUpTime, o.KitchenReceivedTime,
                    o.CookingTime, o.CookedTime, o.TakenFromKitchenTime, o.ArrivedTime,
                    o.CompletedTime, o.CancelledTime, o.Feedback
             FROM Orders o
             WHERE o.Status IN (@s1, @s2, @s3)
             ORDER BY o.SentTime ASC`,
            statuses
        );
        if (orders.length === 0) return [];

        // Load details in one query; C# includes batches even for soft-deleted products.
        const batches = await query(
            `SELECT pb.OrderId, pb.BatchId, pb.ProductId, p.ProductName, pb.Price,
                    p.Unit, pb.QualityOrder, pb.Status, pb.Manufacture, pb.Expiry
             FROM ProductBatches pb
             JOIN Products p ON pb.ProductId = p.ProductId
             JOIN Orders o ON pb.OrderId = o.OrderId
             WHERE o.Status IN (@s1, @s2, @s3)`,
            statuses
        );
        const batchesByOrder = new Map<string, any[]>();
        for (const batch of batches) {
            const key = batch.OrderId.toLowerCase();
            const details = batchesByOrder.get(key) ?? [];
            details.push({
                batchId: batch.BatchId,
                productId: batch.ProductId,
                productName: batch.ProductName,
                price: batch.Price,
                unit: batch.Unit,
                qualityOrder: batch.QualityOrder,
                status: batch.Status,
                manufacture: batch.Manufacture,
                expiry: batch.Expiry
            });
            batchesByOrder.set(key, details);
        }
        // ASP.NET Core serializes OrderWithBatchesDto with camelCase property names.
        return orders.map(order => ({
            orderId: order.OrderId,
            userId: order.UserId,
            storeId: order.StoreId,
            totalAmount: order.TotalAmount,
            status: order.Status,
            type: order.Type,
            note: order.Note,
            sentTime: order.SentTime,
            pickedUpTime: order.PickedUpTime,
            kitchenReceivedTime: order.KitchenReceivedTime,
            cookingTime: order.CookingTime,
            cookedTime: order.CookedTime,
            takenFromKitchenTime: order.TakenFromKitchenTime,
            arrivedTime: order.ArrivedTime,
            completedTime: order.CompletedTime,
            cancelledTime: order.CancelledTime,
            feedback: order.Feedback,
            productBatches: batchesByOrder.get(order.OrderId.toLowerCase()) ?? []
        }));
    }
}
