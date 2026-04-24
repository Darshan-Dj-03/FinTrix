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
const Payment = require("../models/Payment");
const Charge = require("../models/Charge");
const GuestCharge = require("../models/GuestCharge");
const Report = require("../models/Report");
const MonthlyExpenseReport = require("../models/MonthlyExpenseReport");
const StudentConsumption = require("../models/StudentConsumption");
const AuditLog = require("../models/AuditLog");
const EblPeriod = require("../models/EblPeriod");
const EblReport = require("../models/EblCategoryReport");
const { calculateDynamicFine, roundUpCurrency } = require("../services/billLifecycleService");
const { generateMessBills } = require("../services/calculationService");

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
  test("records idempotent payments without creating duplicates", async () => {
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
    const payments = await Payment.find({ billId: bill._id });
    const auditLogs = await AuditLog.find({ entityType: "Payment" });
    const expectedFine = calculateDynamicFine(new Date("2026-01-20T00:00:00.000Z"));
    const expectedAmountPaid = roundUpCurrency(1000 + expectedFine);

    expect(updatedBill.payment_status).toBe("paid");
    expect(updatedBill.amount_paid).toBe(expectedAmountPaid);
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
    const updatedBill = await MessBill.findById(bill._id);
    const expectedFine = calculateDynamicFine(new Date("2026-04-20T00:00:00.000Z"));
    const expectedAmountPaid = roundUpCurrency(2200 + expectedFine);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(200);
    expect(String(secondResponse.body.data._id)).toBe(String(firstResponse.body.data._id));
    expect(payments).toHaveLength(1);
    expect(updatedBill.amount_paid).toBe(expectedAmountPaid);
  });

  test("applies the revised absence deduction policy to mess bills", async () => {
    const month = "Jan-2026";
    const expense = {
      month,
      hostelId: "hostel-1",
      mess_bill_per_day: 100,
      mess_bill_total: 3100,
      egg_price: 0,
      chicken_price: 0,
      paneer_price: 0,
      labour_total: 0,
      night_watch_total: 0,
      bakery_total: 0,
      banana_total: 0,
      banana_bakery_total: 0,
      keb_girls: 0,
      keb_boys: 0,
    };
    const students = [
      { _id: "student-1", userId: { _id: "user-1" }, gender: "male", isActive: true, isEBL: false },
      { _id: "student-2", userId: { _id: "user-2" }, gender: "male", isActive: true, isEBL: false },
      { _id: "student-3", userId: { _id: "user-3" }, gender: "male", isActive: true, isEBL: false },
    ];
    const consumptionRecords = [
      { studentId: "student-1", absent_days: 4 },
      { studentId: "student-2", absent_days: 5 },
      { studentId: "student-3", absent_days: 10 },
    ];

    const bills = generateMessBills(expense, students, consumptionRecords);

    expect(bills[0].base_mess).toBe(3100);
    expect(bills[0].billable_days).toBe(31);

    expect(bills[1].base_mess).toBe(3050);
    expect(bills[1].billable_days).toBe(31);

    expect(bills[2].base_mess).toBe(2100);
    expect(bills[2].billable_days).toBe(21);
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
    expect(deanApproved.status).toBe(400);
    expect(deanApproved.body.message).toMatch(/Dean approval is not required/i);

    const report = await Report.findOne({ hostelId: hostel._id, month: "Feb-2026" });
    const reportAuditLogs = await AuditLog.find({ entityType: "Report" });

    expect(report.snapshot.generatedAt).toBeTruthy();
    expect(report.status).toBe("warden_approved");
    expect(reportAuditLogs.length).toBeGreaterThanOrEqual(3);
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
    const expectedLateFine = calculateDynamicFine(new Date("2026-04-15T00:00:00.000Z"));
    const expectedManualFine = 54 - expectedLateFine;

    expect(response.status).toBe(200);
    expect(response.body.data.fine).toBe(54);
    expect(response.body.data.manual_fine).toBe(expectedManualFine);
    expect(response.body.data.late_fine).toBe(expectedLateFine);
    expect(response.body.data.total_payable).toBe(2254);
  });

  test("lets students save payment date and lets caretakers update it when needed", async () => {
    const { hostel, caretaker, studentUser, student } = await createBaseData();

    const bill = await MessBill.create({
      studentId: student._id,
      userId: studentUser._id,
      hostelId: hostel._id,
      month: "Apr-2026",
      base_mess: 1200,
      total_amount: 1200,
      due_date: new Date("2026-04-20T00:00:00.000Z"),
      payment_status: "pending",
      amount_paid: 0,
    });

    const studentUpdateResponse = await request(app)
      .put(`/bill/payment-info/${bill._id}`)
      .set("Authorization", `Bearer ${signToken(studentUser)}`)
      .send({
        utrNumber: "UTR-DATE-001",
        paymentMadeDate: "2026-04-18",
      });

    expect(studentUpdateResponse.status).toBe(200);
    expect(studentUpdateResponse.body.data.student_utr_number).toBe("UTR-DATE-001");
    expect(new Date(studentUpdateResponse.body.data.student_payment_made_date).toISOString()).toBe("2026-04-18T00:00:00.000Z");

    const caretakerUpdateResponse = await request(app)
      .put(`/bill/payment-info/${bill._id}`)
      .set("Authorization", `Bearer ${signToken(caretaker)}`)
      .send({
        utrNumber: "UTR-DATE-002",
        paymentMadeDate: "2026-04-19",
      });

    expect(caretakerUpdateResponse.status).toBe(200);
    expect(caretakerUpdateResponse.body.data.student_utr_number).toBe("UTR-DATE-002");
    expect(new Date(caretakerUpdateResponse.body.data.student_payment_made_date).toISOString()).toBe("2026-04-19T00:00:00.000Z");
  });

  test("creates EBL periods and moves report-based approvals through submit and warden approval while blocking normal payment handling", async () => {
    const { hostel, caretaker, warden, studentUser, student } = await createBaseData();

    student.isEBL = true;
    student.eblCategory = "SC";
    await student.save();

    const [augBill, sepBill] = await MessBill.create([
      {
        studentId: student._id,
        userId: studentUser._id,
        hostelId: hostel._id,
        month: "Aug-2024",
        base_mess: 2929,
        total_amount: 2929,
        due_date: new Date("2024-08-20T00:00:00.000Z"),
        payment_status: "ebl",
        fine: 0,
        amount_paid: 0,
        is_ebl_student: true,
        ebl_category: "SC",
      },
      {
        studentId: student._id,
        userId: studentUser._id,
        hostelId: hostel._id,
        month: "Sep-2024",
        base_mess: 1100,
        total_amount: 1100,
        due_date: new Date("2024-09-20T00:00:00.000Z"),
        payment_status: "ebl",
        fine: 0,
        amount_paid: 0,
        is_ebl_student: true,
        ebl_category: "SC",
      },
    ]);

    const paymentBlockedBeforeClaimResponse = await request(app)
      .post("/payment")
      .set("Authorization", `Bearer ${signToken(caretaker)}`)
      .send({ billId: augBill._id.toString(), paymentMethod: "cash" });
    expect(paymentBlockedBeforeClaimResponse.status).toBe(400);
    expect(paymentBlockedBeforeClaimResponse.body.message).toMatch(/claim details must be submitted first/i);

    const createResponse = await request(app)
      .post("/ebl/periods")
      .set("Authorization", `Bearer ${signToken(studentUser)}`)
      .send({
        studentId: student._id.toString(),
        fromMonth: "Aug-2024",
        toMonth: "Sep-2024",
        monthlyGoiAmount: 1440,
        periodUtr: "EBL-UTR-0001",
        scholarshipNotes: "GOI shared by student",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.monthlyDetails).toHaveLength(2);
    expect(createResponse.body.data.monthlyDetails[0].goiAmount).toBe(720);
    expect(createResponse.body.data.monthlyDetails[0].claimedAmount).toBe(0);
    expect(createResponse.body.data.monthlyDetails[0].differenceAmount).toBe(2209);
    expect(createResponse.body.data.monthlyDetails[1].goiAmount).toBe(720);
    expect(createResponse.body.data.monthlyDetails[1].claimedAmount).toBe(0);
    expect(createResponse.body.data.monthlyDetails[1].differenceAmount).toBe(380);
    expect(createResponse.body.data.totals.totalMessBill).toBe(4029);
    expect(createResponse.body.data.totals.totalScholarship).toBe(1440);
    expect(createResponse.body.data.totals.totalClaimedAmount).toBe(0);
    expect(createResponse.body.data.totals.totalDifference).toBe(2589);
    expect(createResponse.body.data.totals.totalRemainingBalance).toBe(2589);
    expect(createResponse.body.data.totals.totalClaimAmount).toBe(2589);
    expect(createResponse.body.data.periodUtr).toBe("EBL-UTR-0001");

    const periodId = createResponse.body.data._id;
    const refreshedAugBill = await MessBill.findById(augBill._id);
    expect(refreshedAugBill.payment_status).toBe("partial_scholarship_received");
    expect(refreshedAugBill.ebl_claimed_amount).toBe(0);
    expect(refreshedAugBill.ebl_difference_amount).toBe(2209);
    expect(refreshedAugBill.ebl_remaining_balance).toBe(2209);

    const verifyResponse = await request(app)
      .put(`/ebl/periods/${periodId}/verify`)
      .set("Authorization", `Bearer ${signToken(caretaker)}`);
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.data.status).toBe("verified");

    const studentEditBlockedResponse = await request(app)
      .put(`/ebl/periods/${periodId}`)
      .set("Authorization", `Bearer ${signToken(studentUser)}`)
      .send({
        monthlyGoiAmount: 1500,
      });
    expect(studentEditBlockedResponse.status).toBe(400);
    expect(studentEditBlockedResponse.body.message).toMatch(/can no longer be edited/i);

    const updateResponse = await request(app)
      .put(`/ebl/periods/${periodId}`)
      .set("Authorization", `Bearer ${signToken(caretaker)}`)
      .send({
        universityClaimAmount: 2000,
        periodUtr: "UNI-CLAIM-0001",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.totals.totalClaimedAmount).toBe(2000);
    expect(updateResponse.body.data.totals.totalDifference).toBe(2589);
    expect(updateResponse.body.data.totals.totalRemainingBalance).toBe(589);

    const updatedAugDetail = updateResponse.body.data.monthlyDetails.find((item) => item.month === "Aug-2024");
    const updatedSepDetail = updateResponse.body.data.monthlyDetails.find((item) => item.month === "Sep-2024");

    const eblPaymentResponse = await request(app)
      .post("/payment")
      .set("Authorization", `Bearer ${signToken(caretaker)}`)
      .send({
        billId: augBill._id.toString(),
        paymentMethod: "cash",
        paymentMadeDate: "2024-09-05",
      });

    expect(eblPaymentResponse.status).toBe(201);

    const settledAugBill = await MessBill.findById(augBill._id);
    expect(settledAugBill.payment_status).toBe("paid");
    expect(settledAugBill.ebl_student_paid_amount).toBe(roundUpCurrency(updatedAugDetail.remainingBalance));
    expect(settledAugBill.ebl_remaining_balance).toBe(0);

    const secondEblPaymentResponse = await request(app)
      .post("/payment")
      .set("Authorization", `Bearer ${signToken(caretaker)}`)
      .send({
        billId: sepBill._id.toString(),
        paymentMethod: "cash",
        paymentMadeDate: "2024-09-05",
      });

    expect(secondEblPaymentResponse.status).toBe(201);

    const settledSepBill = await MessBill.findById(sepBill._id);
    expect(settledSepBill.payment_status).toBe("paid");
    expect(settledSepBill.ebl_student_paid_amount).toBe(roundUpCurrency(updatedSepDetail.remainingBalance));
    expect(settledSepBill.ebl_remaining_balance).toBe(0);

    const reportGenerateResponse = await request(app)
      .post("/ebl/reports")
      .set("Authorization", `Bearer ${signToken(caretaker)}`)
      .send({
        reportType: "pre_receipt",
        fromMonth: "Aug-2024",
        toMonth: "Sep-2024",
      });
    expect(reportGenerateResponse.status).toBe(201);
    expect(reportGenerateResponse.body.data.status).toBe("draft");

    const reportId = reportGenerateResponse.body.data._id;

    const submitResponse = await request(app)
      .put(`/ebl/reports/${reportId}/submit`)
      .set("Authorization", `Bearer ${signToken(caretaker)}`);
    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.data.status).toBe("submitted");

    const approveResponse = await request(app)
      .put(`/ebl/reports/${reportId}/approve`)
      .set("Authorization", `Bearer ${signToken(warden)}`);
    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("warden_approved");

    const studentStatusResponse = await request(app)
      .get("/ebl/student")
      .set("Authorization", `Bearer ${signToken(studentUser)}`);
    expect(studentStatusResponse.status).toBe(200);
    expect(studentStatusResponse.body.data.periods).toHaveLength(1);

    const paymentBlockedResponse = await request(app)
      .post("/payment")
      .set("Authorization", `Bearer ${signToken(caretaker)}`)
      .send({ billId: augBill._id.toString(), paymentMethod: "cash" });
    expect(paymentBlockedResponse.status).toBe(200);
    expect(paymentBlockedResponse.body.message).toMatch(/already fully paid/i);

    const savedPeriod = await EblPeriod.findById(periodId);
    const savedReport = await EblReport.findById(reportId);
    const eblAuditLogs = await AuditLog.find({
      entityType: "EblPeriod",
      action: { $in: ["EBL_PERIOD_CREATED", "EBL_PERIOD_VERIFIED"] },
    });

    expect(savedPeriod.status).toBe("verified");
    expect(savedPeriod.verifiedBy).toBeTruthy();
    expect(savedPeriod.verifiedAt).toBeTruthy();
    expect(savedPeriod.universityClaimAmount).toBe(2000);
    expect(savedReport.status).toBe("warden_approved");
    expect(String(savedPeriod.monthlyDetails[0].billId)).toBe(String(augBill._id));
    expect(String(savedPeriod.monthlyDetails[1].billId)).toBe(String(sepBill._id));
    expect(eblAuditLogs).toHaveLength(2);
  });
});
