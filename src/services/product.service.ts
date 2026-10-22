import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';
import { PhotoService } from './photo.service';

export interface ProductDto {
    ProductId: string;
    CategoryId: string;
    ProductName: string;
    Price: number;
    SellingPrice: number;
    Unit?: string | null;
    NumberOfDaysToExpire: number;
    Image?: string | null;
    isDeleted: boolean;
    CategoryName?: string | null;
}

export class ProductService {
    static async create(dto: {
        CategoryId: string;
        ProductName: string;
        Price: number;
        SellingPrice: number;
        Unit?: string;
        NumberOfDaysToExpire?: number;
    }): Promise<boolean> {
        // Check if category exists
        const category = await queryOne('SELECT CategoryId FROM Categories WHERE CategoryId = @catId', {
            catId: dto.CategoryId
        });
        if (!category) return false;

        const productId = uuidv4();
        await execute(
            `INSERT INTO Products (ProductId, CategoryId, ProductName, Price, SellingPrice, Unit, NumberOfDaysToExpire, Image, isDeleted)
             VALUES (@productId, @categoryId, @productName, @price, @sellingPrice, @unit, @expiry, NULL, 0)`,
            {
                productId,
                categoryId: dto.CategoryId,
                productName: dto.ProductName,
                price: dto.Price,
                sellingPrice: dto.SellingPrice,
                unit: dto.Unit || null,
                expiry: dto.NumberOfDaysToExpire || 0
            }
        );

        // Auto-create quantitatives for all stores
        const stores = await query('SELECT StoreId FROM Stores WHERE Status = 1');
        for (const s of stores) {
            await execute(
                `IF NOT EXISTS (SELECT * FROM Quantitatives WHERE StoreId = @storeId AND ProductId = @productId)
                 INSERT INTO Quantitatives (StoreId, ProductId, Quantity) VALUES (@storeId, @productId, 0)`,
                { storeId: s.StoreId, productId }
            );
        }

        return true;
    }

    static async update(id: string, dto: any): Promise<boolean> {
        const product = await this.getById(id);
        if (!product) return false;

        await execute(
            `UPDATE Products
             SET ProductName = @productName,
                 Price = @price,
                 SellingPrice = @sellingPrice,
                 Unit = @unit,
                 NumberOfDaysToExpire = @expiry
             WHERE ProductId = @id`,
            {
                id,
                productName: dto.ProductName ?? dto.productName ?? product.ProductName,
                price: dto.Price ?? dto.price ?? product.Price,
                sellingPrice: dto.SellingPrice ?? dto.sellingPrice ?? product.SellingPrice,
                unit: dto.Unit ?? dto.unit ?? product.Unit,
                expiry: dto.NumberOfDaysToExpire ?? dto.numberOfDaysToExpire ?? product.NumberOfDaysToExpire
            }
        );
        return true;
    }

    static async getById(id: string): Promise<ProductDto | null> {
        return await queryOne(
            `SELECT p.*, c.Name AS CategoryName
             FROM Products p
             LEFT JOIN Categories c ON p.CategoryId = c.CategoryId
             WHERE p.ProductId = @id AND p.isDeleted = 0`,
            { id }
        );
    }

    static async getByCategoryId(categoryId: string): Promise<ProductDto[]> {
        return await query(
            `SELECT p.*, c.Name AS CategoryName
             FROM Products p
             LEFT JOIN Categories c ON p.CategoryId = c.CategoryId
             WHERE p.CategoryId = @categoryId AND p.isDeleted = 0`,
            { categoryId }
        );
    }

    static async getAll(): Promise<ProductDto[]> {
        return await query(
            `SELECT p.*, c.Name AS CategoryName
             FROM Products p
             LEFT JOIN Categories c ON p.CategoryId = c.CategoryId
             WHERE p.isDeleted = 0`
        );
    }

    static async delete(id: string): Promise<boolean> {
        const result = await execute('UPDATE Products SET isDeleted = 1 WHERE ProductId = @id', { id });
        return (result.rowsAffected[0] || 0) > 0;
    }

    static async updateImage(productId: string, file: Express.Multer.File): Promise<string | null> {
        const product = await this.getById(productId);
        if (!product) return null;

        const imageUrl = await PhotoService.uploadPhoto(file);
        await execute('UPDATE Products SET Image = @image WHERE ProductId = @id', {
            id: productId,
            image: imageUrl
        });
        return imageUrl;
    }
}
