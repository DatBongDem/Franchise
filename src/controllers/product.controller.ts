import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';

export class ProductController {
    static async create(req: Request, res: Response): Promise<void> {
        try {
            const {
                categoryId, CategoryId,
                productName, ProductName,
                price, Price,
                sellingPrice, SellingPrice,
                unit, Unit,
                numberOfDaysToExpire, NumberOfDaysToExpire
            } = req.body;

            const catId = categoryId || CategoryId;
            const name = productName || ProductName;

            if (!catId || !name) {
                res.status(400).json({ status: -1, message: 'CategoryId and ProductName are required.' });
                return;
            }

            const success = await ProductService.create({
                CategoryId: catId,
                ProductName: name,
                Price: parseFloat(price ?? Price ?? 0),
                SellingPrice: parseFloat(sellingPrice ?? SellingPrice ?? 0),
                Unit: unit || Unit,
                NumberOfDaysToExpire: parseInt(numberOfDaysToExpire ?? NumberOfDaysToExpire ?? 0, 10)
            });

            if (success) {
                res.json({ status: 0, message: 'Create Product Successfully!!!' });
            } else {
                res.status(400).json({ status: -1, message: 'Category is invalid!!!' });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const success = await ProductService.update(req.params.id, req.body);
            if (success) {
                res.json({ status: 0, message: 'Update Product Successfully!!!' });
            } else {
                res.status(400).json({ status: -1, message: 'Product is invalid!!!' });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const product = await ProductService.getById(req.params.id);
            if (product) {
                res.json({ status: 0, product, message: 'Get Product Successfully!!!' });
            } else {
                res.status(400).json({ status: -1, message: 'Product does not exist!!!' });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getByCategory(req: Request, res: Response): Promise<void> {
        try {
            const products = await ProductService.getByCategoryId(req.params.categoryId);
            if (products && products.length > 0) {
                res.json({ status: 0, products, message: 'Get Products By Category Successfully!!!' });
            } else {
                res.status(400).json({ status: -1, message: 'Does not any product in category!!!' });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const products = await ProductService.getAll();
            if (products && products.length > 0) {
                res.json({ status: 0, products, message: 'Get All Product Successfully!!!' });
            } else {
                res.status(400).json({ status: -1, message: 'Does not any product!!!' });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const success = await ProductService.delete(req.params.id);
            if (success) {
                res.json({ status: 0, message: 'Delete Product Successfully!!!' });
            } else {
                res.status(400).json({ status: -1, message: 'Product does not exist!!!' });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async uploadImage(req: Request, res: Response): Promise<void> {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file uploaded.' });
                return;
            }

            const imageUrl = await ProductService.updateImage(req.params.id, req.file);
            if (imageUrl) {
                res.json({ status: 0, message: 'Upload Image Successfully!!!', imageUrl });
            } else {
                res.status(400).json({ status: -1, message: 'Product does not exist or upload failed!!!' });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }
}
