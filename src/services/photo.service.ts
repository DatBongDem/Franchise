import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env';

if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
    cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret
    });
}

export class PhotoService {
    static async uploadPhoto(file: Express.Multer.File): Promise<string> {
        // If Cloudinary is configured, upload to Cloudinary
        if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'franchise_store',
                        transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result?.secure_url || '');
                    }
                );
                uploadStream.end(file.buffer);
            });
        }

        // Fallback: Return a data URL or placeholder if Cloudinary is not configured yet
        const base64 = file.buffer.toString('base64');
        return `data:${file.mimetype};base64,${base64}`;
    }

    static async deletePhoto(publicId: string): Promise<boolean> {
        if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
            try {
                await cloudinary.uploader.destroy(publicId);
                return true;
            } catch {
                return false;
            }
        }
        return true;
    }
}
