import { Request, Response } from 'express';
import { CategoryService } from '../services/category.service';

export class CategoryController {
    static async create(req: Request, res: Response): Promise<void> {
        try {
            const { categoryName, CategoryName } = req.body;
            const name = categoryName || CategoryName;

            if (!name) {
                res.status(400).json({ status: -1, message: 'CategoryName is required' });
                return;
            }

            const success = await CategoryService.create(name);
            if (success) {
                res.json({
                    status: 0,
                    message: 'Create Category Successfully!!!'
                });
            } else {
                res.status(400).json({
                    status: -1,
                    message: 'Create Category Failed!!!'
                });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const { newCategoryName, NewCategoryName, categoryName, CategoryName } = req.body;
            const name = newCategoryName || NewCategoryName || categoryName || CategoryName;

            if (!name) {
                res.status(400).json({ status: -1, message: 'NewCategoryName is required' });
                return;
            }

            const success = await CategoryService.update(req.params.id, name);
            if (success) {
                res.json({
                    status: 0,
                    message: 'Update Category Successfully!!!'
                });
            } else {
                res.status(400).json({
                    status: -1,
                    message: 'Category does not exist!!!'
                });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const category = await CategoryService.getById(req.params.id);
            if (category) {
                res.json({
                    status: 0,
                    category: {
                        categoryId: (category as any).CategoryId,
                        categoryName: (category as any).Name
                    },
                    message: 'Get Category Successfully!!!'
                });
            } else {
                res.status(404).json({
                    status: -1,
                    message: 'Category does not exist!!!'
                });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const categories = await CategoryService.getAll();
            // Map to camelCase fields that frontend expects
            const mapped = categories.map((c: any) => ({
                categoryId: c.CategoryId,
                categoryName: c.Name
            }));
            res.json({
                status: 0,
                category: mapped,
                message: mapped.length > 0 ? 'Get Category Successfully!!!' : 'No categories found'
            });
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const success = await CategoryService.delete(req.params.id);
            if (success) {
                res.json({
                    status: 0,
                    message: 'Delete Category Successfully!!!'
                });
            } else {
                res.status(400).json({
                    status: -1,
                    message: 'Category does not exist!!!'
                });
            }
        } catch (error) {
            res.status(500).json({ message: 'An internal error occurred.' });
        }
    }
}
