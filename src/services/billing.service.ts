import { v4 as uuidv4 } from 'uuid';
import { getPool, query, queryOne, execute, sql } from '../config/db';
import { StatusEnum } from '../constants/status.enum';

export class RevenueAccessError extends Error {}
export class RevenueUserNotFoundError extends Error {}
export class RevenueInputError extends Error {}
export class BillingHistoryAccessError extends Error {}
export class BillingHistoryUserNotFoundError extends Error {}

export interface CreateBillItemRequest {
    ProductId: string;
    Quantity: number;
}

export class BillingService {
    static async createBill(userId: string, storeId: string, items: CreateBillItemRequest[], note?: string): Promise<string> {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const billId = uuidv4();
            const now = new Date();

            // 1. Insert empty bill first
            const billReq = new sql.Request(transaction);
            billReq.input('billId', billId);
            billReq.input('storeId', storeId);
            billReq.input('userId', userId);
            billReq.input('now', now);
            billReq.input('note', note || null);
            await billReq.query(
                `INSERT INTO Bills (BillId, StoreId, UserId, TotalAmount, CreatedTime, Note)
                 VALUES (@billId, @storeId, @userId, 0, @now, @note)`
            );

            let totalBillAmount = 0;

            // 2. Iterate each product requested with FIFO inventory deduction
            for (const item of items) {
                let needQty = item.Quantity;

                // Find product selling price
                const prodReq = new sql.Request(transaction);
                prodReq.input('prodId', item.ProductId);
                const prodResult = await prodReq.query('SELECT SellingPrice, Price, ProductName FROM Products WHERE ProductId = @prodId');
                const product = prodResult.recordset[0];
                if (!product) {
                    throw new Error(`Product with ID ${item.ProductId} not found.`);
                }

                // Query available batches for this product in completed orders at this store (FIFO: Order by Manufacture ASC, BatchId ASC)
                const batchReq = new sql.Request(transaction);
                batchReq.input('prodId', item.ProductId);
                batchReq.input('storeId', storeId);
                batchReq.input('completedStatus', StatusEnum.Completed);
                batchReq.input('now', now);

                const batchResult = await batchReq.query(
                    `SELECT pb.*
                     FROM ProductBatches pb
                     JOIN Orders o ON pb.OrderId = o.OrderId
                     WHERE pb.ProductId = @prodId
                       AND o.StoreId = @storeId
                       AND o.Status = @completedStatus
                       AND pb.RemainingQuantity > 0
                       AND (pb.Expiry IS NULL OR pb.Expiry > @now)
                     ORDER BY pb.Manufacture ASC, pb.BatchId ASC`
                );

                const batches = batchResult.recordset;

                for (const batch of batches) {
                    if (needQty <= 0) break;

                    const takeQty = Math.min(batch.RemainingQuantity, needQty);
                    const remainingQty = batch.RemainingQuantity - takeQty;
                    needQty -= takeQty;

                    const unitPrice = product.SellingPrice || product.Price || 0;
                    const totalPrice = takeQty * unitPrice;
                    totalBillAmount += totalPrice;

                    // Insert BillDetail
                    const detailReq = new sql.Request(transaction);
                    detailReq.input('detailId', uuidv4());
                    detailReq.input('billId', billId);
                    detailReq.input('productId', item.ProductId);
                    detailReq.input('batchId', batch.BatchId);
                    detailReq.input('quantity', takeQty);
                    detailReq.input('unitPrice', unitPrice);
                    detailReq.input('totalPrice', totalPrice);

                    await detailReq.query(
                        `INSERT INTO BillDetails (BillDetailId, BillId, ProductId, BatchId, Quantity, UnitPrice, TotalPrice)
                         VALUES (@detailId, @billId, @productId, @batchId, @quantity, @unitPrice, @totalPrice)`
                    );

                    // Update ProductBatch remaining quantity
                    const updateBatchReq = new sql.Request(transaction);
                    updateBatchReq.input('batchId', batch.BatchId);
                    updateBatchReq.input('remQty', remainingQty);
                    await updateBatchReq.query(
                        `UPDATE ProductBatches SET RemainingQuantity = @remQty WHERE BatchId = @batchId`
                    );
                }

                if (needQty > 0) {
                    throw new Error(`Insufficient stock for Product ID = ${item.ProductId} (${product.ProductName}). Missing: ${needQty}`);
                }
            }

            // 3. Update Bill total amount
            const updateBillReq = new sql.Request(transaction);
            updateBillReq.input('billId', billId);
            updateBillReq.input('total', totalBillAmount);
            await updateBillReq.query(
                `UPDATE Bills SET TotalAmount = @total WHERE BillId = @billId`
            );

            await transaction.commit();
            return billId;
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    static async getBillPrint(billId: string): Promise<any | null> {
        const bill = await queryOne(
            `SELECT b.*, s.StoreName, s.Address AS StoreAddress, u.Name AS StaffName
             FROM Bills b
             JOIN Stores s ON b.StoreId = s.StoreId
             JOIN Users u ON b.UserId = u.Id
             WHERE b.BillId = @billId`,
            { billId }
        );
        if (!bill) return null;

        const details = await query(
            `SELECT bd.*, p.ProductName, p.Unit
             FROM BillDetails bd
             JOIN Products p ON bd.ProductId = p.ProductId
             WHERE bd.BillId = @billId`,
            { billId }
        );

        return {
            ...bill,
            Details: details
        };
    }

    static async getBillingHistoryAtStore(
        userId: string,
        storeId: string,
        pageNumber: number = 1,
        pageSize: number = 10,
        fromDate?: Date,
        toDate?: Date
    ): Promise<{ listBills: any[]; totalRecords: number }> {
        const user = await queryOne('SELECT Id, Role, IdStore FROM Users WHERE Id = @userId', { userId });
        if (!user) throw new BillingHistoryUserNotFoundError('User not found');
        if (user.Role !== 'MANAGER' || user.IdStore?.toLowerCase() !== storeId.toLowerCase()) {
            throw new BillingHistoryAccessError('User does not have permission!!!');
        }
        let predicate = 'StoreId = @storeId';
        const filters: Record<string, any> = { storeId };
        if (fromDate) { predicate += ' AND CreatedTime >= @fromDate'; filters.fromDate = fromDate; }
        if (toDate) { predicate += ' AND CreatedTime <= @toDate'; filters.toDate = toDate; }
        const total = await queryOne(`SELECT COUNT(*) AS count FROM Bills WHERE ${predicate}`, filters);
        const offset = (pageNumber - 1) * pageSize;
        const bills = pageSize === 0 ? [] : await query(
            `SELECT BillId, CreatedTime, TotalAmount FROM Bills WHERE ${predicate}
             ORDER BY CreatedTime DESC
             OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
            { ...filters, offset, pageSize }
        );
        if (bills.length === 0) return { listBills: [], totalRecords: total?.count ?? 0 };
        const details = await query(
            `SELECT bd.BillId, bd.BillDetailId, pb.ProductId, p.ProductName, bd.Quantity, bd.UnitPrice, bd.TotalPrice
             FROM BillDetails bd
             JOIN ProductBatches pb ON bd.BatchId = pb.BatchId
             JOIN Products p ON pb.ProductId = p.ProductId
             WHERE bd.BillId IN (SELECT BillId FROM OPENJSON(@billIds) WITH (BillId uniqueidentifier '$'))`,
            { billIds: JSON.stringify(bills.map(bill => bill.BillId)) }
        );
        const detailsByBill = new Map<string, any[]>();
        for (const detail of details) {
            const key = detail.BillId.toLowerCase();
            const items = detailsByBill.get(key) ?? [];
            items.push({
                billDetailId: detail.BillDetailId, productId: detail.ProductId, productName: detail.ProductName,
                quantity: detail.Quantity, unitPrice: detail.UnitPrice, totalPrice: detail.TotalPrice
            });
            detailsByBill.set(key, items);
        }
        return {
            listBills: bills.map(bill => ({
                billId: bill.BillId, createdTime: bill.CreatedTime, totalAmount: bill.TotalAmount,
                details: detailsByBill.get(bill.BillId.toLowerCase()) ?? []
            })),
            totalRecords: total?.count ?? 0
        };
    }

    static async getBillingHistoryByStaff(
        userId: string,
        pageNumber: number = 1,
        pageSize: number = 10
    ): Promise<{ listBills: any[]; totalRecords: number }> {
        const offset = (pageNumber - 1) * pageSize;
        const total = await queryOne(
            `SELECT COUNT(*) AS count FROM Bills WHERE UserId = @userId`,
            { userId }
        );

        const bills = await query(
            `SELECT b.*, s.StoreName
             FROM Bills b
             JOIN Stores s ON b.StoreId = s.StoreId
             WHERE b.UserId = @userId
             ORDER BY b.CreatedTime DESC
             OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
            { userId, offset, pageSize }
        );

        for (const b of bills) {
            b.Details = await query(
                `SELECT bd.*, p.ProductName
                 FROM BillDetails bd
                 JOIN Products p ON bd.ProductId = p.ProductId
                 WHERE bd.BillId = @billId`,
                { billId: b.BillId }
            );
        }

        return { listBills: bills, totalRecords: total?.count || 0 };
    }

    static async getStoreRevenue(userId: string, storeId: string, date?: Date, endDate?: Date): Promise<any> {
        const user = await queryOne('SELECT Id, Role, IdStore FROM Users WHERE Id = @userId', { userId });
        if (!user) throw new RevenueUserNotFoundError('User not found');
        if (user.Role !== 'MANAGER' || user.IdStore?.toLowerCase() !== storeId.toLowerCase()) {
            throw new RevenueAccessError('User does not have permission');
        }
        if (!date) throw new RevenueInputError('Date is required');
        if (endDate && endDate < date) throw new RevenueInputError('EndDate must be greater than or equal to Date');

        const fromDate = new Date(date);
        fromDate.setUTCHours(0, 0, 0, 0);
        const toDate = new Date(endDate ?? date);
        toDate.setUTCHours(0, 0, 0, 0);
        toDate.setUTCDate(toDate.getUTCDate() + 1);
        // Keep money arithmetic in SQL decimal, including the sums of grouped values.
        const productSales = await query(
            `WITH ProductRevenue AS (
                SELECT b.StoreId, pb.ProductId, p.ProductName, MIN(b.CreatedTime) AS SaleDate,
                       SUM(bd.Quantity) AS TotalQuantitySold,
                       CAST(SUM(bd.Quantity * bd.UnitPrice) AS decimal(28,2)) AS TotalRevenue,
                       CAST(SUM(bd.Quantity * p.Price) AS decimal(28,2)) AS TotalCost,
                       CAST(SUM(bd.Quantity * bd.UnitPrice) AS decimal(28,2))
                         - CAST(SUM(bd.Quantity * p.Price) AS decimal(28,2)) AS Profit
                FROM Bills b
                JOIN BillDetails bd ON b.BillId = bd.BillId
                JOIN ProductBatches pb ON bd.BatchId = pb.BatchId
                JOIN Products p ON pb.ProductId = p.ProductId
                WHERE b.StoreId = @storeId AND b.CreatedTime >= @fromDate AND b.CreatedTime < @toDate
                GROUP BY b.StoreId, pb.ProductId, p.ProductName
             )
             SELECT *, SUM(TotalRevenue) OVER () AS SummaryTotalRevenue,
                       SUM(TotalCost) OVER () AS SummaryTotalCost,
                       SUM(Profit) OVER () AS SummaryTotalProfit
             FROM ProductRevenue`,
            { storeId, fromDate, toDate }
        );

        return {
            summary: {
                saleDate: fromDate,
                totalRevenue: productSales[0]?.SummaryTotalRevenue ?? 0,
                totalCost: productSales[0]?.SummaryTotalCost ?? 0,
                totalProfit: productSales[0]?.SummaryTotalProfit ?? 0
            },
            items: productSales.map(item => ({
                storeId: item.StoreId, saleDate: item.SaleDate, productId: item.ProductId,
                productName: item.ProductName, totalQuantitySold: item.TotalQuantitySold,
                totalRevenue: item.TotalRevenue, totalCost: item.TotalCost, profit: item.Profit
            }))
        };
    }
}
