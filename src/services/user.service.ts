import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../config/db';
import { PhotoService } from './photo.service';

export interface UserDto {
    Id: string;
    Gmail: string;
    Name: string;
    Gender: string;
    DateOfBirth: string | Date;
    Address: string;
    PhoneNumber: string;
    Role: string;
    IdStore?: string | null;
    Avatar?: string | null;
    Status: string;
}

export class UserService {
    static async getAllUsers(): Promise<UserDto[]> {
        const rows = await query('SELECT Id, Gmail, Name, Gender, DateOfBirth, Address, PhoneNumber, Role, IdStore, Avatar, Status FROM Users');
        return rows;
    }

    static async getUserById(id: string): Promise<UserDto | null> {
        return await queryOne(
            'SELECT Id, Gmail, Name, Gender, DateOfBirth, Address, PhoneNumber, Role, IdStore, Avatar, Status FROM Users WHERE Id = @id',
            { id }
        );
    }

    static async createUser(dto: any): Promise<UserDto> {
        const id = uuidv4();
        const hashedPassword = await bcrypt.hash(dto.Password || dto.password, 10);
        const status = dto.Status || dto.status || 'Active';

        await execute(
            `INSERT INTO Users (Id, Name, Gmail, Password, PhoneNumber, Address, Gender, DateOfBirth, Role, Status, IdStore)
             VALUES (@id, @name, @gmail, @password, @phoneNumber, @address, @gender, @dateOfBirth, @role, @status, @idStore)`,
            {
                id,
                name: dto.Name || dto.name,
                gmail: dto.Gmail || dto.gmail,
                password: hashedPassword,
                phoneNumber: dto.PhoneNumber || dto.phoneNumber,
                address: dto.Address || dto.address,
                gender: dto.Gender || dto.gender,
                dateOfBirth: dto.DateOfBirth || dto.dateOfBirth ? new Date(dto.DateOfBirth || dto.dateOfBirth) : new Date(),
                role: dto.Role || dto.role,
                status,
                idStore: dto.IdStore || dto.idStore || null
            }
        );

        return (await this.getUserById(id))!;
    }

    static async updateUser(id: string, dto: any): Promise<boolean> {
        const user = await this.getUserById(id);
        if (!user) return false;

        await execute(
            `UPDATE Users
             SET Name = @name,
                 Gmail = @gmail,
                 PhoneNumber = @phoneNumber,
                 Address = @address,
                 Gender = @gender,
                 DateOfBirth = @dateOfBirth,
                 Role = @role,
                 IdStore = @idStore
             WHERE Id = @id`,
            {
                id,
                name: dto.Name ?? dto.name ?? user.Name,
                gmail: dto.Gmail ?? dto.gmail ?? user.Gmail,
                phoneNumber: dto.PhoneNumber ?? dto.phoneNumber ?? user.PhoneNumber,
                address: dto.Address ?? dto.address ?? user.Address,
                gender: dto.Gender ?? dto.gender ?? user.Gender,
                dateOfBirth: dto.DateOfBirth || dto.dateOfBirth ? new Date(dto.DateOfBirth || dto.dateOfBirth) : user.DateOfBirth,
                role: dto.Role ?? dto.role ?? user.Role,
                idStore: dto.IdStore ?? dto.idStore ?? user.IdStore
            }
        );

        return true;
    }

    static async deleteUser(id: string): Promise<boolean> {
        const result = await execute('DELETE FROM Users WHERE Id = @id', { id });
        return (result.rowsAffected[0] || 0) > 0;
    }

    static async toggleUserStatus(id: string): Promise<string | null> {
        const user = await this.getUserById(id);
        if (!user) return null;

        const newStatus = user.Status === 'Active' ? 'Blocked' : 'Active';
        await execute('UPDATE Users SET Status = @status WHERE Id = @id', { id, status: newStatus });
        return newStatus;
    }

    static async updateAvatar(userId: string, file: Express.Multer.File): Promise<string | null> {
        const user = await this.getUserById(userId);
        if (!user) return null;

        const photoUrl = await PhotoService.uploadPhoto(file);
        await execute('UPDATE Users SET Avatar = @avatar WHERE Id = @id', { id: userId, avatar: photoUrl });
        return photoUrl;
    }
}
