import { v4 as uuidv4 } from 'uuid';
import { getPool, query, queryOne, execute, sql } from '../config/db';
import { StatusEnum } from '../constants/status.enum';

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
        storeId: string,
        pageNumber: number = 1,
        pageSize: number = 10,
        fromDate?: string,
        toDate?: string
    ): Promise<{ listBills: any[]; totalRecords: number }> {
        const offset = (pageNumber - 1) * pageSize;
        const total = await queryOne(
            `SELECT COUNT(*) AS count FROM Bills WHERE StoreId = @storeId`,
            { storeId }
        );

        const bills = await query(
            `SELECT b.*, u.Name AS StaffName
             FROM Bills b
             JOIN Users u ON b.UserId = u.Id
             WHERE b.StoreId = @storeId
             ORDER BY b.CreatedTime DESC
             OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
            { storeId, offset, pageSize }
        );

        // Fetch details for bills
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

    static async getStoreRevenue(storeId: string, dateStr: string, endDateStr?: string): Promise<any> {
        const fromDate = new Date(dateStr);
        const toDate = endDateStr ? new Date(endDateStr) : new Date(dateStr);
        toDate.setDate(toDate.getDate() + 1); // Inclusive

        const summary = await queryOne(
            `SELECT COUNT(*) AS TotalBills, ISNULL(SUM(TotalAmount), 0) AS TotalRevenue
             FROM Bills
             WHERE StoreId = @storeId AND CreatedTime >= @fromDate AND CreatedTime < @toDate`,
            { storeId, fromDate, toDate }
        );

        const productSales = await query(
            `SELECT p.ProductId, p.ProductName, SUM(bd.Quantity) AS TotalQuantitySold, SUM(bd.TotalPrice) AS TotalRevenue
             FROM BillDetails bd
             JOIN Bills b ON bd.BillId = b.BillId
             JOIN Products p ON bd.ProductId = p.ProductId
             WHERE b.StoreId = @storeId AND b.CreatedTime >= @fromDate AND b.CreatedTime < @toDate
             GROUP BY p.ProductId, p.ProductName
             ORDER BY TotalRevenue DESC`,
            { storeId, fromDate, toDate }
        );

        return {
            storeId,
            fromDate,
            toDate,
            totalBills: summary?.TotalBills || 0,
            totalRevenue: summary?.TotalRevenue || 0,
            averageBillValue: summary?.TotalBills ? summary.TotalRevenue / summary.TotalBills : 0,
            products: productSales
        };
    }
}
