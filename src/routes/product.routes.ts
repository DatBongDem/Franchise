import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.post('/', ProductController.create);
router.put('/:id', ProductController.update);
router.get('/:id', ProductController.getById);
router.get('/category/:categoryId', ProductController.getByCategory);
router.get('/', ProductController.getAll);
router.delete('/:id', ProductController.delete);
router.patch('/:id/image', upload.single('file'), ProductController.uploadImage);

export default router;
