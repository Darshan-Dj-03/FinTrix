const nodemailer = require('nodemailer');

// Create transporter (configure with your email provider)
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send bill notification email to student
 */
const sendBillEmail = async (studentEmail, studentName, billData) => {
  try {
    const {
      month,
      totalAmount,
      dueDate,
      baseMess,
      kebCharge,
      labourCharge,
      nightWatchCharge,
      bakeryCharge,
      eggTotal,
      chickenTotal,
      paneerTotal,
      fine,
    } = billData;

    const dueDateFormatted = new Date(dueDate).toLocaleDateString();

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 15px; border-radius: 5px; }
            .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
            .breakdown { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .breakdown-label { font-weight: bold; }
            .breakdown-value { text-align: right; }
            .total { font-size: 18px; font-weight: bold; color: #4CAF50; margin-top: 15px; padding: 15px; background-color: #f0f0f0; border-radius: 5px; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Monthly Bill Statement</h1>
            </div>
            
            <p>Dear ${studentName},</p>
            <p>Your hostel bill for <strong>${month}</strong> has been generated. Please find the details below:</p>
            
            <div class="section">
              <h3>Charge Breakdown</h3>
              <div class="breakdown">
                <span class="breakdown-label">Base Mess</span>
                <span class="breakdown-value">₹${baseMess.toFixed(2)}</span>
              </div>
              <div class="breakdown">
                <span class="breakdown-label">Electricity (KEB)</span>
                <span class="breakdown-value">₹${kebCharge.toFixed(2)}</span>
              </div>
              <div class="breakdown">
                <span class="breakdown-label">Labour</span>
                <span class="breakdown-value">₹${labourCharge.toFixed(2)}</span>
              </div>
              ${nightWatchCharge > 0 ? `
              <div class="breakdown">
                <span class="breakdown-label">Night Watch</span>
                <span class="breakdown-value">₹${nightWatchCharge.toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="breakdown">
                <span class="breakdown-label">Bakery & Banana</span>
                <span class="breakdown-value">₹${bakeryCharge.toFixed(2)}</span>
              </div>
              ${eggTotal > 0 ? `
              <div class="breakdown">
                <span class="breakdown-label">Eggs</span>
                <span class="breakdown-value">₹${eggTotal.toFixed(2)}</span>
              </div>
              ` : ''}
              ${chickenTotal > 0 ? `
              <div class="breakdown">
                <span class="breakdown-label">Chicken</span>
                <span class="breakdown-value">₹${chickenTotal.toFixed(2)}</span>
              </div>
              ` : ''}
              ${paneerTotal > 0 ? `
              <div class="breakdown">
                <span class="breakdown-label">Paneer</span>
                <span class="breakdown-value">₹${paneerTotal.toFixed(2)}</span>
              </div>
              ` : ''}
              ${fine > 0 ? `
              <div class="breakdown">
                <span class="breakdown-label">Late Payment Fine</span>
                <span class="breakdown-value">₹${fine.toFixed(2)}</span>
              </div>
              ` : ''}
            </div>

            <div class="total">
              <div style="display: flex; justify-content: space-between;">
                <span>Total Amount Due:</span>
                <span>₹${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div class="section">
              <p><strong>Due Date:</strong> ${dueDateFormatted}</p>
              <p>Please ensure timely payment to avoid additional fines. If you have any queries, please contact your hostel caretaker.</p>
            </div>

            <div class="footer">
              <p>This is an automated email. Please do not reply. For assistance, contact: support@fintrix.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: studentEmail,
      subject: `Hostel Bill Notification - ${month}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Bill sent to ${studentEmail}:`, info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Error sending bill email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send payment confirmation email
 */
const sendPaymentConfirmation = async (studentEmail, studentName, paymentData) => {
  try {
    const { month, amount, paidAt } = paymentData;
    const paidDate = new Date(paidAt).toLocaleDateString();

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 15px; border-radius: 5px; }
            .success { color: #4CAF50; font-weight: bold; font-size: 18px; margin: 15px 0; }
            .details { margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Received</h1>
            </div>
            
            <p>Dear ${studentName},</p>
            <div class="success">✓ Your payment has been successfully received</div>
            
            <div class="details">
              <p><strong>Bill Month:</strong> ${month}</p>
              <p><strong>Amount Paid:</strong> ₹${amount.toFixed(2)}</p>
              <p><strong>Payment Date:</strong> ${paidDate}</p>
            </div>

            <p>Thank you for your timely payment. Your bill for ${month} has been marked as paid.</p>
            
            <p>For any further queries, please contact your hostel caretaker.</p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: studentEmail,
      subject: `Payment Confirmation - ${month}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Payment confirmation sent to ${studentEmail}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Error sending payment confirmation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send payment reminder email
 */
const sendPaymentReminder = async (studentEmail, studentName, reminderData) => {
  try {
    const { month, totalAmount, daysOverdue, dueDate } = reminderData;

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff9800; color: white; padding: 15px; border-radius: 5px; }
            .warning { color: #d32f2f; font-weight: bold; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Reminder</h1>
            </div>
            
            <p>Dear ${studentName},</p>
            <div class="warning">⚠️ Your bill payment for ${month} is overdue</div>
            
            <p><strong>Bill Details:</strong></p>
            <ul>
              <li>Month: ${month}</li>
              <li>Amount Due: ₹${totalAmount.toFixed(2)}</li>
              <li>Days Overdue: ${daysOverdue}</li>
              <li>Original Due Date: ${new Date(dueDate).toLocaleDateString()}</li>
            </ul>

            <p>Please pay immediately to avoid additional fines. Late payment charges are applicable.</p>
            <p>Contact your hostel caretaker for payment instructions.</p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: studentEmail,
      subject: `Payment Reminder - ${month} (Overdue)`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Reminder sent to ${studentEmail}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Error sending reminder:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendBillEmail,
  sendPaymentConfirmation,
  sendPaymentReminder,
};
