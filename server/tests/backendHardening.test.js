const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../app");
const Hostel = require("../models/Hostel");
const User = require("../models/User");
const Student = require("../models/Student");
const Expense = require("../models/Expense");
const HostelExpense = require("../models/HostelExpense");
const MessBill = require("../models/MessBill");
const MessBillReport = require("../models/MessBillReport");
const Ledger = require("../models/Ledger");
const Payment = require("../models/Payment");
const Charge = require("../models/Charge");
const GuestCharge = require("../models/GuestCharge");
const Report = require("../models/Report");
const MonthlyExpenseReport = require("../models/MonthlyExpenseReport");
const StudentConsumption = require("../models/StudentConsumption");
const AuditLog = require("../models/AuditLog");

const signToken = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET);

const createUser = async (payload) =>
  User.create({
    name: payload.name,
    username: payload.username,
    password: payload.password || "Password@123",
    role: payload.role,
    hostelId: payload.hostelId || null,
    isFirstLogin: false,
  });

const createBaseData = async () => {
  const hostel = await Hostel.create({
    name: `Hostel-${Date.now()}`,
    type: "boys",
    location: "Campus",
  });

  const admin = await createUser({
    name: "Admin User",
    username: `admin-${Date.now()}`,
    role: "admin",
  });
  const caretaker = await createUser({
    name: "Caretaker User",
    username: `caretaker-${Date.now()}`,
    role: "caretaker",
    hostelId: hostel._id,
  });
  const warden = await createUser({
    name: "Warden User",
    username: `warden-${Date.now()}`,
    role: "warden",
    hostelId: hostel._id,
  });
  const studentUser = await createUser({
    name: "Student User",
    username: `student-${Date.now()}`,
    role: "student",
    hostelId: hostel._id,
  });
  const student = await Student.create({
    userId: studentUser._id,
    studentId: `STU${Date.now()}`,
    gender: "male",
    isActive: true,
  });

  return { hostel, admin, caretaker, warden, studentUser, student };
};

describe("Final backend hardening", () => {
  test("records idempotent payments and syncs the ledger", async () => {
    const { hostel, caretaker, studentUser, student } = await createBaseData();

    const bill = await MessBill.create({
      studentId: student._id,
      userId: studentUser._id,
      hostelId: hostel._id,
      month: "Jan-2026",
      base_mess: 700,
      keb_charge: 100,
      labour_charge: 100,
      night_watch_charge: 0,
      bakery_charge: 100,
      additional_charge: 0,
      egg_count: 0,
      egg_total: 0,
      chicken_count: 0,
      chicken_total: 0,
      paneer_count: 0,
      paneer_total: 0,
      total_amount: 1000,
      fine: 0,
      due_date: new Date("2026-01-20T00:00:00.000Z"),
      student_utr_number: "UTR0001",
      payment_status: "pending",
      amount_paid: 0,
    });

    await Ledger.create({
      month: "Jan-2026",
      hostelId: hostel._id,
      openingBalance: 0,
      totalExpenses: 500,
      totalBilled: 1000,
      totalCollected: 0,
      closingBalance: -500,
      outstanding: 1000,
      preparedBy: caretaker._id,
    });

    const token = signToken(caretaker);

    const firstResponse = await request(app)
      .post("/payment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Idempotency-Key", "payment-key-1")
      .send({ billId: bill._id.toString(), paymentMethod: "upi" });

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body.data.paymentMethod).toBe("upi");

    const secondResponse = await request(app)
      .post("/payment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Idempotency-Key", "payment-key-1")
      .send({ billId: bill._id.toString(), paymentMethod: "upi" });

    expect(secondResponse.status).toBe(200);
    expect(String(secondResponse.body.data._id)).toBe(String(firstResponse.body.data._id));

    const updatedBill = await MessBill.findById(bill._id);
    const updatedLedger = await Ledger.findOne({ hostelId: hostel._id, month: "Jan-2026" });
    const payments = await Payment.find({ billId: bill._id });
    const auditLogs = await AuditLog.find({ entityType: "Payment" });

    expect(updatedBill.payment_status).toBe("paid");
    expect(updatedBill.amount_paid).toBe(1345);
    expect(updatedLedger.totalCollected).toBe(1345);
    expect(updatedLedger.outstanding).toBe(0);
    expect(payments).toHaveLength(1);
    expect(auditLogs).toHaveLength(1);
  });

  test("blocks duplicate payments for the same bill even with a different idempotency key and UTR", async () => {
    const { hostel, caretaker, studentUser, student } = await createBaseData();

    const bill = await MessBill.create({
      studentId: student._id,
      userId: studentUser._id,
      hostelId: hostel._id,
      month: "Apr-2026",
      base_mess: 1800,
      keb_charge: 200,
      labour_charge: 100,
      night_watch_charge: 0,
      bakery_charge: 100,
      additional_charge: 0,
      egg_count: 0,
      egg_total: 0,
      chicken_count: 0,
      chicken_total: 0,
      paneer_count: 0,
      paneer_total: 0,
      total_amount: 2200,
      fine: 0,
      due_date: new Date("2026-04-20T00:00:00.000Z"),
      student_utr_number: "UTR1001",
      payment_status: "pending",
      amount_paid: 0,
    });

    await Ledger.create({
      month: "Apr-2026",
      hostelId: hostel._id,
      openingBalance: 0,
      totalExpenses: 0,
      totalBilled: 2200,
      totalCollected: 0,
      closingBalance: 0,
      outstanding: 2200,
      preparedBy: caretaker._id,
    });

    const token = signToken(caretaker);

    const firstResponse = await request(app)
      .post("/payment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Idempotency-Key", "payment-key-a")
      .send({ billId: bill._id.toString(), paymentMethod: "upi" });

    const secondResponse = await request(app)
      .post("/payment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Idempotency-Key", "payment-key-b")
      .send({ billId: bill._id.toString(), paymentMethod: "upi" });

    const payments = await Payment.find({ billId: bill._id });
    const updatedLedger = await Ledger.findOne({ hostelId: hostel._id, month: "Apr-2026" });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(200);
    expect(String(secondResponse.body.data._id)).toBe(String(firstResponse.body.data._id));
    expect(payments).toHaveLength(1);
    expect(updatedLedger.totalCollected).toBe(2200);
  });

  test("generates, submits, and approves report snapshots", async () => {
    const { hostel, admin, caretaker, warden, studentUser, student } = await createBaseData();

    await Expense.create({
      month: "Feb-2026",
      hostelId: hostel._id,
      elp: 100,
      cylinder: 100,
      oil: 100,
      kirana: 100,
      milk: 100,
      keb_total: 50,
      keb_girls: 0,
      keb_boys: 50,
      total_worker_days: 60,
      labour_total: 100,
      night_watch_total: 0,
      bakery_total: 50,
      banana_total: 50,
      egg_price: 0,
      chicken_price: 0,
      paneer_price: 0,
      createdBy: caretaker._id,
    });

    await MessBill.create({
      studentId: student._id,
      userId: studentUser._id,
      hostelId: hostel._id,
      month: "Feb-2026",
      base_mess: 500,
      keb_charge: 50,
      labour_charge: 50,
      night_watch_charge: 0,
      bakery_charge: 50,
      additional_charge: 0,
      egg_count: 0,
      egg_total: 0,
      chicken_count: 0,
      chicken_total: 0,
      paneer_count: 0,
      paneer_total: 0,
      total_amount: 650,
      fine: 0,
      due_date: new Date("2026-02-20T00:00:00.000Z"),
      payment_status: "pending",
      amount_paid: 0,
    });

    const caretakerToken = signToken(caretaker);
    const wardenToken = signToken(warden);
    const adminToken = signToken(admin);

    const generated = await request(app)
      .post("/report/generate/Feb-2026")
      .set("Authorization", `Bearer ${caretakerToken}`);
    expect(generated.status).toBe(201);
    expect(generated.body.data.snapshot.totals.totalBilled).toBe(650);

    const submitted = await request(app)
      .put("/report/submit/Feb-2026")
      .set("Authorization", `Bearer ${caretakerToken}`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe("submitted");

    const wardenApproved = await request(app)
      .put("/report/warden-approve/Feb-2026")
      .set("Authorization", `Bearer ${wardenToken}`)
      .send({ hostelId: hostel._id.toString(), notes: "Looks correct" });
    expect(wardenApproved.status).toBe(200);
    expect(wardenApproved.body.data.status).toBe("warden_approved");

    const deanApproved = await request(app)
      .put("/report/dean-approve/Feb-2026")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ hostelId: hostel._id.toString(), notes: "Approved" });
    expect(deanApproved.status).toBe(200);
    expect(deanApproved.body.data.status).toBe("dean_approved");

    const report = await Report.findOne({ hostelId: hostel._id, month: "Feb-2026" });
    const reportAuditLogs = await AuditLog.find({ entityType: "Report" });

    expect(report.snapshot.generatedAt).toBeTruthy();
    expect(reportAuditLogs.length).toBeGreaterThanOrEqual(4);
  });

  test("auto-generates draft reports and resyncs downstream artifacts when manual balances are updated", async () => {
    const { hostel, caretaker, student } = await createBaseData();
    const caretakerToken = signToken(caretaker);

    await Promise.all([
      StudentConsumption.create({
        studentId: student._id,
        month: "Apr-2026",
        egg_count: 3,
        chicken_count: 0,
        paneer_count: 0,
        milk_amount: 45,
      }),
      Charge.create({
        title: "Festival Charge",
        amount: 125,
        month: "Apr-2026",
        hostelId: hostel._id,
        addedBy: caretaker._id,
      }),
      GuestCharge.create({
        hostelId: hostel._id,
        month: "Apr-2026",
        event_name: "Visitors Lunch",
        event_start_date: new Date("2026-04-10T00:00:00.000Z"),
        event_end_date: new Date("2026-04-10T00:00:00.000Z"),
        guest_count: 6,
        amount: 300,
        addedBy: caretaker._id,
      }),
    ]);

    const createExpenseResponse = await request(app)
      .post("/hostel-expense/create")
      .set("Authorization", `Bearer ${caretakerToken}`)
      .send({
        month: "Apr-2026",
        elp: 300,
        chicken: 0,
        cylinder: 250,
        keb_total: 500,
        oil: 450,
        kirani: 1200,
        milk: 350,
        labour_bill: 400,
        labour_night_watch: 100,
        hostel_fund: 0,
        milling: 150,
        veg: 600,
        banana: 80,
        bakery: 120,
        egg_total: 90,
        chicken_total_misc: 0,
        paneer_total: 0,
        egg_students_count: 1,
        chicken_students_count: 0,
        paneer_students_count: 0,
      });

    expect(createExpenseResponse.status).toBe(201);

    const [
      savedHostelExpense,
      autoMonthlyReport,
      autoExpenseSnapshot,
      autoMessBillReport,
      autoMainReport,
      initialBills,
    ] = await Promise.all([
      HostelExpense.findOne({ hostelId: hostel._id, month: "Apr-2026" }),
      MonthlyExpenseReport.findOne({ hostelId: hostel._id, month: "Apr-2026" }),
      Expense.findOne({ hostelId: hostel._id, month: "Apr-2026" }),
      MessBillReport.findOne({ hostelId: hostel._id, month: "Apr-2026" }),
      Report.findOne({ hostelId: hostel._id, month: "Apr-2026" }),
      MessBill.find({ hostelId: hostel._id, month: "Apr-2026" }),
    ]);

    expect(savedHostelExpense).toBeTruthy();
    expect(autoMonthlyReport).toBeTruthy();
    expect(autoExpenseSnapshot).toBeTruthy();
    expect(autoMessBillReport).toBeTruthy();
    expect(autoMainReport).toBeTruthy();
    expect(autoMonthlyReport.status).toBe("draft");
    expect(autoMessBillReport.status).toBe("draft");
    expect(autoMainReport.status).toBe("draft");
    expect(initialBills).toHaveLength(1);

    const initialBillTotal = initialBills[0].total_amount;
    const initialMessBillPerDay = autoExpenseSnapshot.mess_bill_per_day;

    const updateReportResponse = await request(app)
      .post("/monthly-expense-report/generate/Apr-2026")
      .set("Authorization", `Bearer ${caretakerToken}`)
      .send({
        opening_balance: 50,
        closing_balance_last_month: 100,
      });

    expect(updateReportResponse.status).toBe(200);
    expect(updateReportResponse.body.data.opening_balance).toBe(50);
    expect(updateReportResponse.body.data.closing_balance_last_month).toBe(100);

    const [updatedMonthlyReport, updatedExpenseSnapshot, updatedBills, updatedMainReport] = await Promise.all([
      MonthlyExpenseReport.findOne({ hostelId: hostel._id, month: "Apr-2026" }),
      Expense.findOne({ hostelId: hostel._id, month: "Apr-2026" }),
      MessBill.find({ hostelId: hostel._id, month: "Apr-2026" }),
      Report.findOne({ hostelId: hostel._id, month: "Apr-2026" }),
    ]);

    expect(updatedMonthlyReport.mess_bill_per_day).toBeGreaterThan(initialMessBillPerDay);
    expect(updatedExpenseSnapshot.mess_bill_per_day).toBe(updatedMonthlyReport.mess_bill_per_day);
    expect(updatedBills).toHaveLength(1);
    expect(updatedBills[0].total_amount).toBeGreaterThan(initialBillTotal);
    expect(updatedMainReport.totalBilled).toBe(updatedBills[0].total_amount);
    expect(updatedMainReport.status).toBe("draft");
  });

  test("updates due dates for paid and unpaid bills uniformly without adding new fine to paid bills", async () => {
    const { hostel, caretaker, studentUser, student } = await createBaseData();
    const secondStudentUser = await createUser({
      name: "Student User 2",
      username: `student-two-${Date.now()}`,
      role: "student",
      hostelId: hostel._id,
    });
    const secondStudent = await Student.create({
      userId: secondStudentUser._id,
      studentId: `STU${Date.now() + 1}`,
      gender: "male",
      isActive: true,
    });

    const paidBill = await MessBill.create({
      studentId: student._id,
      userId: studentUser._id,
      hostelId: hostel._id,
      month: "Apr-2026",
      base_mess: 1000,
      keb_charge: 100,
      labour_charge: 100,
      night_watch_charge: 0,
      bakery_charge: 0,
      additional_charge: 0,
      egg_count: 0,
      egg_total: 0,
      chicken_count: 0,
      chicken_total: 0,
      paneer_count: 0,
      paneer_total: 0,
      total_amount: 1200,
      fine: 0,
      due_date: new Date("2026-04-20T00:00:00.000Z"),
      payment_status: "paid",
      amount_paid: 1200,
    });

    const pendingBill = await MessBill.create({
      studentId: secondStudent._id,
      userId: secondStudentUser._id,
      hostelId: hostel._id,
      month: "Apr-2026",
      base_mess: 1000,
      keb_charge: 100,
      labour_charge: 100,
      night_watch_charge: 0,
      bakery_charge: 0,
      additional_charge: 0,
      egg_count: 0,
      egg_total: 0,
      chicken_count: 0,
      chicken_total: 0,
      paneer_count: 0,
      paneer_total: 0,
      total_amount: 1200,
      fine: 0,
      due_date: new Date("2026-04-20T00:00:00.000Z"),
      payment_status: "pending",
      amount_paid: 0,
    });

    const caretakerToken = signToken(caretaker);

    const updateConfigResponse = await request(app)
      .put("/bill/config/Apr-2026")
      .set("Authorization", `Bearer ${caretakerToken}`)
      .send({
        dueDate: "2026-05-15T00:00:00.000Z",
        announcementDate: "2026-04-01T00:00:00.000Z",
      });

    expect(updateConfigResponse.status).toBe(200);

    const [updatedPaidBill, updatedPendingBill] = await Promise.all([
      MessBill.findById(paidBill._id),
      MessBill.findById(pendingBill._id),
    ]);

    expect(updatedPaidBill.due_date.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(updatedPendingBill.due_date.toISOString()).toBe("2026-05-15T00:00:00.000Z");

    const paidBillResponse = await request(app)
      .get(`/bill/student/${student._id}/Apr-2026`)
      .set("Authorization", `Bearer ${caretakerToken}`);

    expect(paidBillResponse.status).toBe(200);
    expect(paidBillResponse.body.data.payment_status).toBe("paid");
    expect(paidBillResponse.body.data.fine).toBe(0);
  });

  test("preserves manual consumption fine alongside live late fine on student bills", async () => {
    const { hostel, studentUser, student } = await createBaseData();

    await MessBill.create({
      studentId: student._id,
      userId: studentUser._id,
      hostelId: hostel._id,
      month: "Apr-2026",
      base_mess: 2200,
      keb_charge: 0,
      labour_charge: 0,
      night_watch_charge: 0,
      bakery_charge: 0,
      additional_charge: 0,
      egg_count: 0,
      egg_total: 0,
      chicken_count: 0,
      chicken_total: 0,
      paneer_count: 0,
      paneer_total: 0,
      milk_amount: 0,
      milk_total: 0,
      total_amount: 2200,
      fine: 54,
      due_date: new Date("2026-04-15T00:00:00.000Z"),
      payment_status: "pending",
      amount_paid: 0,
    });

    const response = await request(app)
      .get(`/bill/student/${student._id}/Apr-2026`)
      .set("Authorization", `Bearer ${signToken(studentUser)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.fine).toBe(54);
    expect(response.body.data.manual_fine).toBe(50);
    expect(response.body.data.late_fine).toBe(4);
    expect(response.body.data.total_payable).toBe(2254);
  });

  test("creates ledger from expenses, charges, and payments", async () => {
    const { hostel, admin, caretaker, studentUser, student } = await createBaseData();

    await Ledger.create({
      month: "Feb-2026",
      hostelId: hostel._id,
      openingBalance: 0,
      totalExpenses: 500,
      totalBilled: 500,
      totalCollected: 400,
      closingBalance: -100,
      outstanding: 100,
      preparedBy: admin._id,
    });

    await Expense.create({
      month: "Mar-2026",
      hostelId: hostel._id,
      elp: 100,
      cylinder: 100,
      oil: 100,
      kirana: 100,
      milk: 100,
      keb_total: 100,
      keb_girls: 0,
      keb_boys: 100,
      total_worker_days: 60,
      labour_total: 200,
      night_watch_total: 0,
      bakery_total: 50,
      banana_total: 50,
      egg_price: 0,
      chicken_price: 0,
      paneer_price: 0,
      createdBy: caretaker._id,
    });

    await Charge.create({
      title: "Gas Adjustment",
      amount: 50,
      month: "Mar-2026",
      hostelId: hostel._id,
      addedBy: caretaker._id,
    });

    const bill = await MessBill.create({
      studentId: student._id,
      userId: studentUser._id,
      hostelId: hostel._id,
      month: "Mar-2026",
      base_mess: 600,
      keb_charge: 100,
      labour_charge: 100,
      night_watch_charge: 0,
      bakery_charge: 50,
      additional_charge: 50,
      egg_count: 0,
      egg_total: 0,
      chicken_count: 0,
      chicken_total: 0,
      paneer_count: 0,
      paneer_total: 0,
      total_amount: 900,
      fine: 0,
      due_date: new Date("2026-03-20T00:00:00.000Z"),
      payment_status: "paid",
      amount_paid: 900,
    });

    await Payment.create({
      studentId: student._id,
      billId: bill._id,
      hostelId: hostel._id,
      month: "Mar-2026",
      amount: 900,
      paymentMethod: "upi",
      utrNumber: "UTR0002",
      status: "paid",
      verifiedBy: caretaker._id,
    });

    const response = await request(app)
      .post("/ledger/create/Mar-2026")
      .set("Authorization", `Bearer ${signToken(admin)}`)
      .send({ hostelId: hostel._id.toString() });

    expect(response.status).toBe(201);
    expect(response.body.data.openingBalance).toBe(-100);
    expect(response.body.data.totalBilled).toBe(900);
    expect(response.body.data.totalCollected).toBe(900);
    expect(response.body.data.outstanding).toBe(0);
  });

  test("handles EBL request and approval with audit logging", async () => {
    const { admin, caretaker, student } = await createBaseData();

    const requestResponse = await request(app)
      .put(`/ebl/request/${student._id}`)
      .set("Authorization", `Bearer ${signToken(caretaker)}`);

    expect(requestResponse.status).toBe(200);
    expect(requestResponse.body.data.eblRequestPending).toBe(true);

    const approveResponse = await request(app)
      .put(`/ebl/approve/${student._id}`)
      .set("Authorization", `Bearer ${signToken(admin)}`)
      .send({ approve: true });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.eblApproved).toBe(true);

    const updatedStudent = await Student.findById(student._id).populate("userId");
    const studentAuditLogs = await AuditLog.find({
      entityType: "Student",
      action: { $in: ["EBL_REQUESTED", "EBL_APPROVED"] },
    });

    expect(updatedStudent.isEBL).toBe(true);
    expect(updatedStudent.userId.eblApproved).toBe(true);
    expect(studentAuditLogs).toHaveLength(2);
  });
});
