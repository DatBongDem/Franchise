import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';

export interface Category {
    CategoryId: string;
    Name: string;
}

export class CategoryService {
    static async getAll(): Promise<Category[]> {
        return await query('SELECT CategoryId, Name FROM Categories');
    }

    static async getById(id: string): Promise<Category | null> {
        return await queryOne('SELECT CategoryId, Name FROM Categories WHERE CategoryId = @id', { id });
    }

    static async create(categoryName: string): Promise<boolean> {
        const categoryId = uuidv4();
        await execute('INSERT INTO Categories (CategoryId, Name) VALUES (@id, @name)', {
            id: categoryId,
            name: categoryName
        });
        return true;
    }

    static async update(id: string, newCategoryName: string): Promise<boolean> {
        const cat = await this.getById(id);
        if (!cat) return false;

        await execute('UPDATE Categories SET Name = @name WHERE CategoryId = @id', {
            id,
            name: newCategoryName
        });
        return true;
    }

    static async delete(id: string): Promise<boolean> {
        const result = await execute('DELETE FROM Categories WHERE CategoryId = @id', { id });
        return (result.rowsAffected[0] || 0) > 0;
    }
}
