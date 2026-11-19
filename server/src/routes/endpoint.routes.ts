import { Router } from 'express';
import * as endpointController from '../controllers/endpoint.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.use(auth);

router.post('/', endpointController.createEndpoint);
router.get('/', endpointController.listEndpoints);
router.get('/:id', endpointController.getEndpoint);
router.patch('/:id', endpointController.updateEndpoint);
router.delete('/:id', endpointController.deleteEndpoint);
router.get('/:id/secret', endpointController.getEndpointSecret);
router.post('/:id/rotate-secret', endpointController.rotateEndpointSecret);
router.post('/:id/test', endpointController.testEndpoint);

export default router;
