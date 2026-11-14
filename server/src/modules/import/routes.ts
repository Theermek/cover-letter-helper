/**
 * POST /import (TASK2 §1.3).
 *
 * The body is the export file itself, unchanged, so the extension can send
 * exactly what it would have written to disk -- and a file the user saved
 * months ago still imports.
 */

import { Router } from 'express';
import { importData } from './service.js';

export const importRouter = Router();

importRouter.post('/import', async (req, res) => {
  res.json(await importData(req.body));
});
