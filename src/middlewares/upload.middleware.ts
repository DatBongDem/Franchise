import multer from 'multer';

// Memory storage for file buffers to upload to Cloudinary or base64
const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});
