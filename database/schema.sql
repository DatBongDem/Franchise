-- Database Schema for Franchise System (SQL Server)
USE FranchiseDB;
GO

-- 1. Stores
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Stores')
BEGIN
    CREATE TABLE Stores (
        StoreId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        StoreName NVARCHAR(255) NOT NULL,
        Address NVARCHAR(500) NULL,
        Status BIT NOT NULL DEFAULT 1
    );
END
GO

-- 2. Users
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Name NVARCHAR(255) NOT NULL,
        Gmail NVARCHAR(255) NOT NULL,
        Password NVARCHAR(255) NOT NULL,
        PhoneNumber NVARCHAR(50) NOT NULL,
        Address NVARCHAR(500) NOT NULL,
        Gender NVARCHAR(50) NOT NULL,
        DateOfBirth DATETIME2 NOT NULL,
        Role NVARCHAR(50) NOT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Active',
        Avatar NVARCHAR(MAX) NULL,
        IdStore UNIQUEIDENTIFIER NULL
    );
END
GO

-- 3. ManagerStores
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ManagerStores')
BEGIN
    CREATE TABLE ManagerStores (
        UserId UNIQUEIDENTIFIER NOT NULL,
        StoreId UNIQUEIDENTIFIER NOT NULL,
        AssignedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        PRIMARY KEY (UserId, StoreId),
        CONSTRAINT FK_ManagerStores_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_ManagerStores_Stores FOREIGN KEY (StoreId) REFERENCES Stores(StoreId) ON DELETE CASCADE
    );
END
GO

-- 4. Categories
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Categories')
BEGIN
    CREATE TABLE Categories (
        CategoryId UNIQUEIDENTIFIER PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL
    );
END
GO

-- 5. Products
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Products')
BEGIN
    CREATE TABLE Products (
        ProductId UNIQUEIDENTIFIER PRIMARY KEY,
        CategoryId UNIQUEIDENTIFIER NOT NULL,
        ProductName NVARCHAR(255) NOT NULL,
        Price DECIMAL(18,2) NOT NULL,
        SellingPrice DECIMAL(18,2) NOT NULL,
        Unit NVARCHAR(100) NULL,
        NumberOfDaysToExpire INT NOT NULL DEFAULT 0,
        Image NVARCHAR(MAX) NULL,
        isDeleted BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId) REFERENCES Categories(CategoryId) ON DELETE CASCADE
    );
END
GO

-- 6. Orders
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Orders')
BEGIN
    CREATE TABLE Orders (
        OrderId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NULL,
        StoreId UNIQUEIDENTIFIER NOT NULL,
        TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        Status NVARCHAR(100) NOT NULL,
        Type NVARCHAR(100) NOT NULL,
        Note NVARCHAR(MAX) NULL,
        Feedback NVARCHAR(MAX) NULL,
        CancellationReason NVARCHAR(MAX) NULL,
        SentTime DATETIME2 NULL,
        PickedUpTime DATETIME2 NULL,
        CookingTime DATETIME2 NULL,
        CookedTime DATETIME2 NULL,
        KitchenReceivedTime DATETIME2 NULL,
        TakenFromKitchenTime DATETIME2 NULL,
        ArrivedTime DATETIME2 NULL,
        CompletedTime DATETIME2 NULL,
        CancelledTime DATETIME2 NULL,
        CONSTRAINT FK_Orders_Stores FOREIGN KEY (StoreId) REFERENCES Stores(StoreId) ON DELETE CASCADE,
        CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
END
GO

-- 7. ProductBatches
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProductBatches')
BEGIN
    CREATE TABLE ProductBatches (
        BatchId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ProductId UNIQUEIDENTIFIER NOT NULL,
        OrderId UNIQUEIDENTIFIER NOT NULL,
        QualityOrder INT NOT NULL,
        RemainingQuantity INT NOT NULL,
        Price DECIMAL(18,2) NOT NULL DEFAULT 0,
        Status NVARCHAR(100) NOT NULL DEFAULT 'Normal',
        Manufacture DATETIME2 NULL,
        Expiry DATETIME2 NULL,
        CONSTRAINT FK_ProductBatches_Products FOREIGN KEY (ProductId) REFERENCES Products(ProductId),
        CONSTRAINT FK_ProductBatches_Orders FOREIGN KEY (OrderId) REFERENCES Orders(OrderId)
    );
END
GO

-- 8. Ingredients
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Ingredients')
BEGIN
    CREATE TABLE Ingredients (
        IngredientId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        IngredientName NVARCHAR(255) NOT NULL,
        Unit NVARCHAR(100) NOT NULL,
        Status NVARCHAR(100) NOT NULL DEFAULT 'Active'
    );
END
GO

-- 9. Recipes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Recipes')
BEGIN
    CREATE TABLE Recipes (
        RecipeID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ProductID UNIQUEIDENTIFIER NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        CONSTRAINT FK_Recipes_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductId)
    );
END
GO

-- 10. RecipeIngredients
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RecipeIngredients')
BEGIN
    CREATE TABLE RecipeIngredients (
        RecipeId UNIQUEIDENTIFIER NOT NULL,
        IngredientId UNIQUEIDENTIFIER NOT NULL,
        Quantity DECIMAL(18,2) NOT NULL,
        PRIMARY KEY (RecipeId, IngredientId),
        CONSTRAINT FK_RecipeIngredients_Recipes FOREIGN KEY (RecipeId) REFERENCES Recipes(RecipeID) ON DELETE CASCADE,
        CONSTRAINT FK_RecipeIngredients_Ingredients FOREIGN KEY (IngredientId) REFERENCES Ingredients(IngredientId) ON DELETE CASCADE
    );
END
GO

-- 11. Bills
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Bills')
BEGIN
    CREATE TABLE Bills (
        BillId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        StoreId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        CreatedTime DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        Note NVARCHAR(MAX) NULL,
        CONSTRAINT FK_Bills_Stores FOREIGN KEY (StoreId) REFERENCES Stores(StoreId),
        CONSTRAINT FK_Bills_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
END
GO

-- 12. BillDetails
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BillDetails')
BEGIN
    CREATE TABLE BillDetails (
        BillDetailId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        BillId UNIQUEIDENTIFIER NOT NULL,
        ProductId UNIQUEIDENTIFIER NOT NULL,
        BatchId UNIQUEIDENTIFIER NOT NULL,
        Quantity INT NOT NULL,
        UnitPrice DECIMAL(18,2) NOT NULL,
        TotalPrice DECIMAL(18,2) NOT NULL,
        CONSTRAINT FK_BillDetails_Bills FOREIGN KEY (BillId) REFERENCES Bills(BillId) ON DELETE CASCADE,
        CONSTRAINT FK_BillDetails_Products FOREIGN KEY (ProductId) REFERENCES Products(ProductId),
        CONSTRAINT FK_BillDetails_ProductBatches FOREIGN KEY (BatchId) REFERENCES ProductBatches(BatchId)
    );
END
GO

-- 13. Quantitatives
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Quantitatives')
BEGIN
    CREATE TABLE Quantitatives (
        StoreId UNIQUEIDENTIFIER NOT NULL,
        ProductId UNIQUEIDENTIFIER NOT NULL,
        Quantity INT NOT NULL DEFAULT 0,
        PRIMARY KEY (StoreId, ProductId),
        CONSTRAINT FK_Quantitatives_Stores FOREIGN KEY (StoreId) REFERENCES Stores(StoreId) ON DELETE CASCADE,
        CONSTRAINT FK_Quantitatives_Products FOREIGN KEY (ProductId) REFERENCES Products(ProductId) ON DELETE CASCADE
    );
END
GO

-- 14. IngredientQuantitatives
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IngredientQuantitatives')
BEGIN
    CREATE TABLE IngredientQuantitatives (
        StoreId UNIQUEIDENTIFIER NOT NULL,
        IngredientId UNIQUEIDENTIFIER NOT NULL,
        Quantity DECIMAL(18,2) NOT NULL DEFAULT 0,
        PRIMARY KEY (StoreId, IngredientId),
        CONSTRAINT FK_IngredientQuantitatives_Stores FOREIGN KEY (StoreId) REFERENCES Stores(StoreId) ON DELETE CASCADE,
        CONSTRAINT FK_IngredientQuantitatives_Ingredients FOREIGN KEY (IngredientId) REFERENCES Ingredients(IngredientId) ON DELETE CASCADE
    );
END
GO

-- 15. CookingIngredientHistories
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CookingIngredientHistories')
BEGIN
    CREATE TABLE CookingIngredientHistories (
        CookingIngredientHistoryId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        BatchId UNIQUEIDENTIFIER NULL,
        ProductBatchBatchId UNIQUEIDENTIFIER NULL,
        IngredientId UNIQUEIDENTIFIER NOT NULL,
        QuantityUsed DECIMAL(18,2) NOT NULL,
        Unit NVARCHAR(100) NOT NULL,
        CreatedTime DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_CookingIngredientHistories_Ingredients FOREIGN KEY (IngredientId) REFERENCES Ingredients(IngredientId) ON DELETE CASCADE
    );
END
GO

-- 16. CookingHistories
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CookingHistories')
BEGIN
    CREATE TABLE CookingHistories (
        CookingHistoryId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        OrderId UNIQUEIDENTIFIER NOT NULL,
        ProductId UNIQUEIDENTIFIER NOT NULL,
        BatchId UNIQUEIDENTIFIER NOT NULL,
        CookedByUserId UNIQUEIDENTIFIER NOT NULL,
        Quantity INT NOT NULL,
        CookedTime DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_CookingHistories_Orders FOREIGN KEY (OrderId) REFERENCES Orders(OrderId),
        CONSTRAINT FK_CookingHistories_Products FOREIGN KEY (ProductId) REFERENCES Products(ProductId),
        CONSTRAINT FK_CookingHistories_ProductBatches FOREIGN KEY (BatchId) REFERENCES ProductBatches(BatchId),
        CONSTRAINT FK_CookingHistories_Users FOREIGN KEY (CookedByUserId) REFERENCES Users(Id)
    );
END
GO
