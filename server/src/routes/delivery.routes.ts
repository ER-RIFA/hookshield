import { Router } from 'express';
import * as deliveryController from '../controllers/delivery.controller';
import { auth } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();
router.use(auth);

const replayLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  message: { success: false, error: 'Too many replay requests, please try again later.' },
});

router.get('/stats', deliveryController.getDashboardStats);
router.get('/', deliveryController.listDeliveries);
router.post('/replay-all-failed', replayLimiter, deliveryController.replayAllFailed);
router.get('/:id', deliveryController.getDelivery);
router.post('/:id/replay', replayLimiter, deliveryController.replayDelivery);

export default router;
