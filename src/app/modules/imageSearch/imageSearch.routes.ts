import express from 'express';
import ImageSearchController from './imageSearch.controller';

const router = express.Router();

// Public visual search — works with the built-in smart matcher, auto-upgrades
// to AI when a vision provider key is present (see imageSearch.provider.ts).
router.get('/status', ImageSearchController.status);
router.post('/', ImageSearchController.search);

export const ImageSearchRoutes = router;
