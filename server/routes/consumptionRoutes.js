const express = require('express');
const { body, param } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');
const {
  addConsumption,
  updateConsumption,
  getConsumption,
  deleteConsumption,
  getConsumptionByMonth,
} = require('../controllers/consumptionController');

const router = express.Router();

/**
 * POST /consumption/add
 * Add new consumption record (Caretaker only)
 */
router.post(
  '/add',
  protect,
  checkRole('caretaker'),
  [
    body('studentId').isMongoId().withMessage('Invalid student ID'),
    body('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format'),
    body('eggCount').optional().isInt({ min: 0 }).withMessage('Egg count must be non-negative'),
    body('chickenCount').optional().isInt({ min: 0 }).withMessage('Chicken count must be non-negative'),
    body('paneerCount').optional().isInt({ min: 0 }).withMessage('Paneer count must be non-negative'),
  ],
  addConsumption
);

/**
 * PUT /consumption/update/:id
 * Update consumption record (Caretaker only)
 */
router.put(
  '/update/:id',
  protect,
  checkRole('caretaker'),
  [
    param('id').isMongoId().withMessage('Invalid consumption ID'),
    body('eggCount').optional().isInt({ min: 0 }).withMessage('Egg count must be non-negative'),
    body('chickenCount').optional().isInt({ min: 0 }).withMessage('Chicken count must be non-negative'),
    body('paneerCount').optional().isInt({ min: 0 }).withMessage('Paneer count must be non-negative'),
  ],
  updateConsumption
);

/**
 * GET /consumption/:studentId/:month
 * Get consumption record (Student own/Caretaker hostel/Admin all)
 */
router.get(
  '/:studentId/:month',
  protect,
  [
    param('studentId').isMongoId().withMessage('Invalid student ID'),
    param('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format'),
  ],
  getConsumption
);

/**
 * DELETE /consumption/:id
 * Delete consumption record (Caretaker only)
 */
router.delete(
  '/:id',
  protect,
  checkRole('caretaker'),
  [param('id').isMongoId().withMessage('Invalid consumption ID')],
  deleteConsumption
);

/**
 * GET /consumption/month/:month
 * Get all consumption records for month (Admin only)
 */
router.get(
  '/month/:month',
  protect,
  checkRole('admin'),
  [param('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format')],
  getConsumptionByMonth
);

module.exports = router;
