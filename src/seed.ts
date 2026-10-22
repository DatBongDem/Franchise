import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getPool, queryOne, execute } from './config/db';
import { Roles } from './constants/roles.enum';

export async function seedDatabase() {
    try {
        await getPool();
        console.log('[Seed] Checking seed data...');

        // 1. Check Store
        let store = await queryOne('SELECT TOP 1 * FROM Stores');
        if (!store) {
            const storeId = uuidv4();
            await execute(
                `INSERT INTO Stores (StoreId, StoreName, Address, Status)
                 VALUES (@storeId, @storeName, @address, @status)`,
                {
                    storeId,
                    storeName: 'Chi Nhánh Quận 1 - FranchiseStore',
                    address: '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
                    status: 1
                }
            );
            store = { StoreId: storeId };
            console.log('[Seed] Created default store.');
        }

        // 2. Check Admin
        const adminEmail = 'admin@franchise.com';
        const existingAdmin = await queryOne('SELECT * FROM Users WHERE Gmail = @email', { email: adminEmail });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('Admin@123', 10);
            await execute(
                `INSERT INTO Users (Id, Name, Gmail, Password, PhoneNumber, Address, Gender, DateOfBirth, Role, Status, IdStore)
                 VALUES (@id, @name, @email, @password, @phone, @address, @gender, @dob, @role, @status, @idStore)`,
                {
                    id: uuidv4(),
                    name: 'System Administrator',
                    email: adminEmail,
                    password: hashedPassword,
                    phone: '0901234567',
                    address: 'Trụ sở chính',
                    gender: 'Male',
                    dob: new Date('1990-01-01'),
                    role: Roles.ADMIN,
                    status: 'Active',
                    idStore: store.StoreId
                }
            );
            console.log(`[Seed] Created admin: ${adminEmail} / Admin@123`);
        }

        // 3. Check Store Staff
        const staffEmail = 'staff@franchise.com';
        const existingStaff = await queryOne('SELECT * FROM Users WHERE Gmail = @email', { email: staffEmail });
        if (!existingStaff) {
            const hashedPassword = await bcrypt.hash('Staff@123', 10);
            await execute(
                `INSERT INTO Users (Id, Name, Gmail, Password, PhoneNumber, Address, Gender, DateOfBirth, Role, Status, IdStore)
                 VALUES (@id, @name, @email, @password, @phone, @address, @gender, @dob, @role, @status, @idStore)`,
                {
                    id: uuidv4(),
                    name: 'Nhân Viên Cửa Hàng 1',
                    email: staffEmail,
                    password: hashedPassword,
                    phone: '0902345678',
                    address: 'Cửa hàng Quận 1',
                    gender: 'Female',
                    dob: new Date('1998-05-15'),
                    role: Roles.STORESTAFF,
                    status: 'Active',
                    idStore: store.StoreId
                }
            );
            console.log(`[Seed] Created store staff: ${staffEmail} / Staff@123`);
        }

        // 4. Check Kitchen Staff
        const kitchenEmail = 'kitchen@franchise.com';
        const existingKitchen = await queryOne('SELECT * FROM Users WHERE Gmail = @email', { email: kitchenEmail });
        if (!existingKitchen) {
            const hashedPassword = await bcrypt.hash('Kitchen@123', 10);
            await execute(
                `INSERT INTO Users (Id, Name, Gmail, Password, PhoneNumber, Address, Gender, DateOfBirth, Role, Status, IdStore)
                 VALUES (@id, @name, @email, @password, @phone, @address, @gender, @dob, @role, @status, @idStore)`,
                {
                    id: uuidv4(),
                    name: 'Nhân Viên Bếp Trung Tâm',
                    email: kitchenEmail,
                    password: hashedPassword,
                    phone: '0903456789',
                    address: 'Bếp trung tâm',
                    gender: 'Male',
                    dob: new Date('1995-10-20'),
                    role: Roles.KITCHENSTAFF,
                    status: 'Active',
                    idStore: store.StoreId
                }
            );
            console.log(`[Seed] Created kitchen staff: ${kitchenEmail} / Kitchen@123`);
        }

        // 5. Check Supply Coordinator
        const deliveryEmail = 'delivery@franchise.com';
        const existingDelivery = await queryOne('SELECT * FROM Users WHERE Gmail = @email', { email: deliveryEmail });
        if (!existingDelivery) {
            const hashedPassword = await bcrypt.hash('Delivery@123', 10);
            await execute(
                `INSERT INTO Users (Id, Name, Gmail, Password, PhoneNumber, Address, Gender, DateOfBirth, Role, Status, IdStore)
                 VALUES (@id, @name, @email, @password, @phone, @address, @gender, @dob, @role, @status, @idStore)`,
                {
                    id: uuidv4(),
                    name: 'Nhân Viên Điều Phối Vận Chuyển',
                    email: deliveryEmail,
                    password: hashedPassword,
                    phone: '0904567890',
                    address: 'Đội xe vận chuyển',
                    gender: 'Male',
                    dob: new Date('1996-03-25'),
                    role: Roles.SUPPLYCOORDINATOR,
                    status: 'Active',
                    idStore: store.StoreId
                }
            );
            console.log(`[Seed] Created delivery coordinator: ${deliveryEmail} / Delivery@123`);
        }

        // 6. Check Category & Product
        let category = await queryOne('SELECT TOP 1 * FROM Categories');
        if (!category) {
            const categoryId = uuidv4();
            await execute(
                `INSERT INTO Categories (CategoryId, Name) VALUES (@id, @name)`,
                { id: categoryId, name: 'Đồ Uống & Cà Phê' }
            );
            category = { CategoryId: categoryId };
            console.log('[Seed] Created default category.');
        }

        const product = await queryOne('SELECT TOP 1 * FROM Products');
        if (!product) {
            const productId = uuidv4();
            await execute(
                `INSERT INTO Products (ProductId, CategoryId, ProductName, Price, SellingPrice, Unit, NumberOfDaysToExpire, isDeleted)
                 VALUES (@productId, @categoryId, @productName, @price, @sellingPrice, @unit, @expiryDays, 0)`,
                {
                    productId,
                    categoryId: category.CategoryId,
                    productName: 'Trà Sữa Trân Châu Hoàng Kim',
                    price: 25000,
                    sellingPrice: 45000,
                    unit: 'Ly',
                    expiryDays: 3
                }
            );
            // Also create quantitative for store
            await execute(
                `INSERT INTO Quantitatives (StoreId, ProductId, Quantity) VALUES (@storeId, @productId, 0)`,
                { storeId: store.StoreId, productId }
            );
            console.log('[Seed] Created default product & quantitative.');
        }

        console.log('[Seed] Seed check completed.');
    } catch (err: any) {
        console.error('[Seed] Error during seeding:', err.message);
    }
}
