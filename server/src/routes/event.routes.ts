import { Router } from 'express';
import * as eventController from '../controllers/event.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.use(auth);

router.post('/', eventController.createEvent);
router.get('/', eventController.listEvents);
router.get('/:id', eventController.getEvent);

export default router;
