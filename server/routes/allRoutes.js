/**
 * COMPLETE ROUTES INTEGRATION GUIDE
 * 
 * This file documents all routes to be mounted in server.js
 * For the working application, add these routes to server.js:
 */

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');
const consumptionRoutes = require('./consumptionRoutes');

/**
 * ==================== ROUTES TO MOUNT IN server.js ====================
 */

/*
// PHASE 1: Consumption CRUD
app.use('/consumption', consumptionRoutes);

// PHASE 6: PDF Routes
const { generateBillPDF, generatePaymentSlipPDF } = require('./controllers/pdfController');
app.get('/bill/pdf/:studentId/:month', protect, generateBillPDF);
app.get('/payment/slip/:studentId/:month', protect, generatePaymentSlipPDF);

// PHASE 7: Analytics Routes
const {
  getSummaryAnalytics,
  getHostelAnalytics,
  getConsumptionAnalytics,
  getStudentAnalytics,
} = require('./controllers/analyticsController');

app.get('/analytics/summary/:month', protect, checkRole('admin', 'caretaker'), getSummaryAnalytics);
app.get('/analytics/hostel/:month', protect, checkRole('admin'), getHostelAnalytics);
app.get('/analytics/consumption/:month', protect, checkRole('admin', 'caretaker'), getConsumptionAnalytics);
app.get('/analytics/students/:month', protect, checkRole('admin', 'caretaker'), getStudentAnalytics);

// PHASE 8: Approval Workflow Routes
const {
  generateReport,
  submitReport,
  wardenApprove,
  deanApprove,
  getReport,
} = require('./controllers/reportController');

app.post('/report/generate/:month', protect, checkRole('caretaker'), generateReport);
app.put('/report/submit/:month', protect, checkRole('caretaker'), submitReport);
app.put('/report/warden-approve/:month', protect, checkRole('warden'), wardenApprove);
app.put('/report/dean-approve/:month', protect, checkRole('dean'), deanApprove);
app.get('/report/:month', protect, getReport);

// PHASE 9: Payment Routes
const {
  recordPayment,
  getPaymentStatus,
  getPendingPayments,
} = require('./controllers/paymentController');

app.post('/payment/pay', protect, checkRole('caretaker'), recordPayment);
app.get('/payment/status/:studentId/:month', protect, getPaymentStatus);
app.get('/payment/pending/:month', protect, checkRole('caretaker', 'admin'), getPendingPayments);

// PHASE 11: EBL Approval Routes
const {
  requestEBL,
  approveEBL,
} = require('./controllers/eblController');

app.put('/student/request-ebl/:studentId', protect, checkRole('caretaker'), requestEBL);
app.put('/student/approve-ebl/:studentId', protect, checkRole('warden'), approveEBL);

// PHASE 13: Charge Routes
const {
  addCharge,
  getCharges,
  updateCharge,
  deleteCharge,
} = require('./controllers/chargeController');

app.post('/charges/add', protect, checkRole('admin', 'caretaker'), addCharge);
app.get('/charges/:month', protect, getCharges);
app.put('/charges/:chargeId', protect, checkRole('admin', 'caretaker'), updateCharge);
app.delete('/charges/:chargeId', protect, checkRole('admin', 'caretaker'), deleteCharge);

// PHASE 14: Monthly Report Routes
const { getFullReport } = require('./controllers/reportController');
app.get('/report/full/:month', protect, checkRole('admin', 'caretaker'), getFullReport);

// PHASE 15: Ledger Routes
const { getLedger, createLedger } = require('./controllers/ledgerController');
app.get('/ledger/:month', protect, checkRole('admin', 'caretaker'), getLedger);
app.post('/ledger/create/:month', protect, checkRole('admin'), createLedger);
*/

/**
 * ==================== ENVIRONMENT VARIABLES NEEDED ====================
 */
/*
// Add to .env file:
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
NODE_CRON_ENABLED=true
*/

/**
 * ==================== PACKAGE.JSON DEPENDENCIES ====================
 */
/*
npm install:
- express-validator
- node-cron
- nodemailer
- pdfkit
- mongoose
*/

/**
 * ==================== INITIALIZATION IN server.js ====================
 */
/*
// Add this to server.js:
const { scheduleBillGeneration } = require('./jobs/billCron');
const { globalErrorHandler } = require('./middleware/validationMiddleware');

// ... after all routes ...

// Schedule cron job
if (process.env.NODE_CRON_ENABLED !== 'false') {
  scheduleBillGeneration();
}

// Global error handler (must be last)
app.use(globalErrorHandler);
*/

module.exports = {
  // This file is a reference guide
  message: 'See comments above for routes to mount in server.js',
};
