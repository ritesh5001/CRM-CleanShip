import { Router, type NextFunction, type Request, type Response } from 'express';
import * as ctrl from '../controllers/callController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logCallSchema } from '../validators/callValidators.js';
import { isEnabled, validateSignature } from '../services/twilioService.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// Rejects webhook requests that aren't genuinely from Twilio. These endpoints are
// public (Twilio can't carry our JWT) so the signature is the only auth.
async function twilioWebhook(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!(await isEnabled())) return next(ApiError.serviceUnavailable('Calling is not configured'));
    if (!(await validateSignature(req))) return next(ApiError.forbidden('Invalid Twilio signature'));
    next();
  } catch (err) {
    next(err);
  }
}

// Public Twilio webhooks (signature-verified, no JWT).
router.post('/voice', twilioWebhook, ctrl.handleVoice);
router.post('/recording', twilioWebhook, ctrl.handleRecording);
router.post('/status', twilioWebhook, ctrl.handleStatus);

// Everything below requires an authenticated user.
router.use(authenticate);

router.get('/config', ctrl.getCallConfig);
router.get('/token', ctrl.getVoiceToken);
router.get('/', ctrl.listCalls);
router.post('/', validate(logCallSchema), ctrl.logCall);

export default router;
