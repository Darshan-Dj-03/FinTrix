const cron = require('node-cron');
const MessBill = require('../models/MessBill');
const Expense = require('../models/Expense');
const Student = require('../models/Student');
const StudentConsumption = require('../models/StudentConsumption');
const Hostel = require('../models/Hostel');
const Charge = require('../models/Charge');
const { generateMessBills } = require('../services/calculationService');

/**
 * Schedule automatic bill generation
 * Runs on 1st of every month at 00:00
 */
const scheduleBillGeneration = () => {
  // Cron expression: 0 0 1 * * (1st of month at midnight)
  cron.schedule('0 0 1 * *', async () => {
    console.log('[CRON] Starting automated bill generation...');
    
    try {
      // Get current date info
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonthIndex = now.getMonth();
      const previousMonthIndex = currentMonthIndex === 0 ? 11 : currentMonthIndex - 1;
      const previousYear = currentMonthIndex === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const billingMonth = `${monthNames[previousMonthIndex]}-${previousYear}`;

      console.log(`[CRON] Generating bills for: ${billingMonth}`);

      // Get all hostels
      const hostels = await Hostel.find();

      for (const hostel of hostels) {
        try {
          // Check if expense exists for this hostel and month
          const expense = await Expense.findOne({
            hostelId: hostel._id,
            month: billingMonth,
          });

          if (!expense) {
            console.log(`[CRON] No expense record for hostel ${hostel.name} in ${billingMonth}`);
            continue;
          }

          // Check if bills already exist for this month
          const existingBills = await MessBill.findOne({
            hostelId: hostel._id,
            month: billingMonth,
          });

          if (existingBills) {
            console.log(`[CRON] Bills already exist for hostel ${hostel.name} in ${billingMonth}`);
            continue;
          }

          // Get all active students for this hostel
          const students = await Student.find({
            isActive: true,
          }).populate('userId');

          const hostelStudents = students.filter(
            s => s.userId.hostelId.toString() === hostel._id.toString()
          );

          if (hostelStudents.length === 0) {
            console.log(`[CRON] No active students for hostel ${hostel.name}`);
            continue;
          }

          // Get consumption records
          const consumptions = await StudentConsumption.find({
            studentId: { $in: hostelStudents.map(s => s._id) },
            month: billingMonth,
          });

          const charges = await Charge.find({
            hostelId: hostel._id,
            month: billingMonth,
          });

          // Generate bills
          const billPayloads = generateMessBills(expense, hostelStudents, consumptions, { charges });

          // Insert bills
          await MessBill.insertMany(billPayloads);

          console.log(
            `[CRON] Successfully generated ${billPayloads.length} bills for hostel ${hostel.name}`
          );
        } catch (hostelError) {
          console.error(`[CRON] Error processing hostel ${hostel.name}:`, hostelError.message);
        }
      }

      console.log('[CRON] Bill generation completed successfully');
    } catch (error) {
      console.error('[CRON] Error in bill generation:', error.message);
    }
  });

  console.log('[CRON] Bill generation job scheduled (1st of each month at 00:00)');
};

module.exports = {
  scheduleBillGeneration,
};
