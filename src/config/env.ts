import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '5000', 10),
    db: {
        server: process.env.DB_SERVER || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
        instanceName: process.env.DB_INSTANCE || undefined,
        user: process.env.DB_USER || 'franchise_user',
        password: process.env.DB_PASSWORD || 'Password123!',
        database: process.env.DB_NAME || 'FranchiseDB',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'franchise_store_secret_jwt_key_2026_very_long_string_123456',
        issuer: process.env.JWT_ISSUER || 'FranchiseStoreAPI',
        audience: process.env.JWT_AUDIENCE || 'FranchiseStoreClients',
        expiresIn: '1h'
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || ''
    }
};
