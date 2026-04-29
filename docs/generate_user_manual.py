from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUT = Path("docs/User-Manual.docx")
ASSETS = Path("docs/user_manual_assets")


def set_font(run, size=12, bold=False, italic=False, color="000000", name="Times New Roman"):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)
    r_pr = run._element.get_or_add_rPr()
    r_fonts = r_pr.rFonts
    r_fonts.set(qn("w:ascii"), name)
    r_fonts.set(qn("w:hAnsi"), name)


def base_style(doc):
    sec = doc.sections[0]
    sec.top_margin = Inches(1)
    sec.bottom_margin = Inches(1)
    sec.left_margin = Inches(1.0)
    sec.right_margin = Inches(1.0)
    doc.styles["Normal"].font.name = "Times New Roman"
    doc.styles["Normal"].font.size = Pt(12)


def p(doc, text="", align=WD_ALIGN_PARAGRAPH.JUSTIFY, indent=True, after=8, before=0):
    para = doc.add_paragraph()
    para.alignment = align
    para.paragraph_format.space_after = Pt(after)
    para.paragraph_format.space_before = Pt(before)
    para.paragraph_format.line_spacing = 1.15
    if indent:
        para.paragraph_format.first_line_indent = Inches(0.3)
    if text:
        run = para.add_run(text)
        set_font(run)
    return para


def center(doc, text, size=16, bold=False, italic=False, after=8, before=0, color="000000"):
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.space_after = Pt(after)
    para.paragraph_format.space_before = Pt(before)
    run = para.add_run(text)
    set_font(run, size=size, bold=bold, italic=italic, color=color)
    return para


def heading(doc, text, level=1):
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(8)
    para.paragraph_format.space_after = Pt(6)
    run = para.add_run(text)
    if level == 1:
        set_font(run, size=18, bold=True)
    elif level == 2:
        set_font(run, size=15, bold=True)
    else:
        set_font(run, size=12, bold=True)
    return para


def bullet(doc, text):
    para = doc.add_paragraph(style="List Bullet")
    para.paragraph_format.space_after = Pt(3)
    run = para.add_run(text)
    set_font(run)


def formula(doc, label, expr, note=None):
    para = doc.add_paragraph()
    para.paragraph_format.left_indent = Inches(0.25)
    para.paragraph_format.space_after = Pt(4)
    r1 = para.add_run(f"{label}: ")
    set_font(r1, size=11.5, bold=True)
    r2 = para.add_run(expr)
    set_font(r2, size=11.5, name="Courier New")
    if note:
        r3 = para.add_run(f"  ({note})")
        set_font(r3, size=11, italic=True, color="444444")


def caption_image(doc, path, caption, width=6.2):
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.add_run().add_picture(str(path), width=Inches(width))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(8)
    run = cap.add_run(caption)
    set_font(run, size=11, italic=True, color="1F4E79")


def two_col_table(doc, rows):
    table = doc.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    for left, right in rows:
        cells = table.add_row().cells
        cells[0].text = ""
        cells[1].text = ""
        r1 = cells[0].paragraphs[0].add_run(left)
        r2 = cells[1].paragraphs[0].add_run(right)
        set_font(r1, size=11, bold=True)
        set_font(r2, size=11)
    doc.add_paragraph()


def cover(doc):
    center(doc, "FinTrix User Manual", size=24, bold=True, after=18, before=24)
    center(doc, "Descriptive Operations Guide with Workflow Diagrams and Calculation Reference", size=14, italic=True, after=18)
    center(doc, "For Students, Caretakers, Admins, Wardens and Deans", size=13, after=30)
    center(doc, "Version: Expanded Operational Handbook", size=12, after=8)
    center(doc, "Prepared from the current FinTrix implementation and live calculation reference", size=12, italic=True, after=18)
    two_col_table(
        doc,
        [
            ("System", "FinTrix Hostel Management System"),
            ("Document Type", "User Manual / Operations Handbook"),
            ("Focus", "Role-based usage, process flow, and complete calculation understanding"),
            ("Audience", "Students, caretakers, approvers, administrators, developers"),
        ],
    )
    p(
        doc,
        "This manual explains not only how each module is used, but also how data moves from one step to another and how the system computes the values displayed on pages, reports, bills, dashboards, and PDFs. It is intended to help operational users perform their tasks correctly and help advanced users or reviewers understand why a number appears in a given place.",
    )
    doc.add_page_break()


def intro(doc):
    heading(doc, "1. Purpose and How to Use This Manual", 1)
    paras = [
        "The current FinTrix user manual is designed as an operational handbook rather than a short reference sheet. The goal is to help users understand not only which buttons to press, but also the dependency order between modules, the role of each workflow, and the origin of system-generated values such as payable amounts, fines, summaries, and report totals.",
        "The manual is written for five user categories: students, caretakers, admins, wardens, and deans. Students mainly consume finalized information. Caretakers perform the most operational work. Admins, wardens, and deans review, supervise, or approve information created through the monthly cycle. Because the system is dependency driven, mistakes in one module can affect later modules. For that reason, this handbook repeatedly explains both the process and the calculations behind it.",
        "The last major section of the manual is a complete calculation handbook derived from the live `CALCULATIONS_REFERENCE.md` file. That section should be used whenever a displayed number looks unexpected, a report total seems wrong, or a user needs to verify how a bill, chart, or summary card was computed.",
    ]
    for text in paras:
        p(doc, text)
    caption_image(doc, ASSETS / "overview_flow.png", "Figure 1. Overall monthly hostel operations flow", width=6.5)

    heading(doc, "2. System Overview and Monthly Dependency Flow", 1)
    p(doc, "FinTrix completes hostel administration in a sequence. Monthly consumption and charges are entered first, hostel expenses are consolidated next, student bills are generated from these operational inputs, payments and EBL adjustments are then handled, and finally the system produces reports and approvals. Users should not treat these modules as isolated pages. They are connected.")
    for item in [
        "Consumption records provide student-level quantities and absence values.",
        "Static charges, guest charges, and hostel expense details provide the financial base for monthly billing.",
        "The system uses these records to auto-generate expense snapshots, mess bills, monthly expenditure reports, and report drafts.",
        "Payments, EBL handling, and approvals all depend on earlier values already being correct.",
    ]:
        bullet(doc, item)


def student_section(doc):
    doc.add_page_break()
    heading(doc, "3. Student Role Manual", 1)
    heading(doc, "3.1 Student Signup and Approval Journey", 2)
    p(doc, "Students use the signup flow only when they do not yet have an approved account. The system allows either manual student ID entry or temporary ID generation. The student does not decide hostel assignment or EBL status at signup time; these are assigned later by institutional reviewers.")
    two_col_table(
        doc,
        [
            ("Student enters", "Name, email, gender, student ID option, student ID if available, password, confirm password"),
            ("Student does not enter", "Hostel assignment, EBL status, approval state"),
            ("Temporary ID behavior", "If a student lacks an ID, the system can generate one temporarily for the request flow"),
        ],
    )
    caption_image(doc, ASSETS / "signup_flow.png", "Figure 2. Student signup and approval flow", width=6.4)
    p(doc, "After signup submission, the caretaker reviews the request, maps the student to a hostel, sets EBL-related flags if required, and forwards the request. Admin-level review then approves or rejects the request. Only approved students can use the regular sign-in flow.")

    heading(doc, "3.2 Sign In, Password Reset, and Profile Password Change", 2)
    p(doc, "Students sign in using the approved student ID and password. If the account is unapproved or invalid, access is blocked. If login access is lost, the student uses the forgot-password flow with email OTP verification. The same OTP-based logic is available from the profile area for users who are already logged in but want to update their password securely.")
    for item in [
        "Forgot password flow: enter email, receive OTP, verify OTP, set new password, confirm, return to sign-in.",
        "Profile password change flow: request OTP, verify, enter new password, confirm, save.",
        "These flows rely on email verification rather than only current-password validation.",
    ]:
        bullet(doc, item)

    heading(doc, "3.3 Student Billing Experience", 2)
    p(doc, "Students mainly interact with billing through the overview page, the bills page, and the bill PDF. The system explicitly shows values such as bill month, bill amount, fine, payment status, amount paid, absent days, absence deduction, utilities, labour, and detailed charge breakdown. If the student is in EBL flow, GOI amount, difference amount, university claim data, and remaining balance are also shown where relevant.")
    p(doc, "This visibility is important because students should be able to understand why they owe a certain amount. Earlier systems often displayed only a final number; FinTrix is designed to expose the underlying bill components more clearly.")

    heading(doc, "3.4 Student Payments and UTR Updates", 2)
    p(doc, "On the student payments page, the user can update a UTR number and associated payment date. This is especially relevant for UPI-linked payment evidence. If the student enters a UTR without an explicit payment mode, the backend interprets it as a UPI payment context. Saved payment rows then become visible in the student's payment history view.")

    heading(doc, "3.5 Student EBL View", 2)
    p(doc, "Students who fall under EBL handling see a different financial picture from regular students. They may see GOI-supported values, remaining balances, or claim-related progress. The displayed EBL status depends on user flags such as approved, submitted, rejected, or pending. This status gives the student a quick understanding of where their scholarship-linked process stands.")


def caretaker_section(doc):
    doc.add_page_break()
    heading(doc, "4. Caretaker Operations Manual", 1)
    p(doc, "Caretakers are the primary operational users in FinTrix. Their work determines whether the monthly cycle is correct. A caretaker normally works in this order: consumption, guest/static charges, hostel expense entry, auto-generated outputs, payments and EBL handling, then report review and submission.")

    heading(doc, "4.1 Consumption Module", 2)
    p(doc, "The consumption module captures per-student monthly quantities and operational adjustments. For each student, the caretaker may record egg count, chicken count, paneer count, milk amount, fine amount, and absent days. These values later become bill components and summary-card totals.")
    for item in [
        "Egg count contributes to `egg_total = egg_price * egg_count`.",
        "Chicken count contributes to `chicken_total = chicken_price * chicken_count`.",
        "Paneer count contributes to `paneer_total = paneer_price * paneer_count`.",
        "Milk amount contributes directly to `milk_total = milk_amount`.",
        "Absent days influence `billableDays` and absence deduction rules.",
        "Manual fine entered here later becomes part of live bill fine.",
    ]:
        bullet(doc, item)

    heading(doc, "4.2 Static Charges and Guest Charges", 2)
    p(doc, "Static charges and guest charges are used for non-standard additions that should still become part of the monthly financial picture. Charge title, amount, month, and hostel linkage must be entered carefully because these values later appear in bill breakdowns, finance summaries, and reports.")

    heading(doc, "4.3 Hostel Expense Module", 2)
    p(doc, "The hostel expense module records the detailed hostel-wide cost structure. It supports bill breakdown rows with store name, bill number, description, and bill amount. The system uses these details to build hostel-level expense totals and then distributes relevant components across active students based on hostel counts, gender groups, or consumption-specific headcounts.")
    p(doc, "Because the hostel expense module feeds later calculations, a caretaker should enter it only after the month's consumption, charges, and bill breakdown details are complete. This module is also where the system derives several key variables such as headcounts, KEB split, labour split, misc-per-student values, and protein prices.")

    heading(doc, "4.4 Auto-Generated Monthly Outputs", 2)
    p(doc, "Once hostel expense values are submitted, FinTrix can automatically generate multiple downstream records: the monthly expenditure report draft, expense snapshot, student bills, mess bill per student report, and main report. This automation is useful, but it also means the caretaker must treat hostel expense submission as a decisive operation in the monthly cycle.")

    heading(doc, "4.5 Bill Generation, Payments, and EBL", 2)
    p(doc, "Generated bills combine expense snapshot values, active student lists, student consumption, static charges, fine logic, and due-date behavior. The caretaker can then manage payments, verify UTR-backed payment evidence, and interact with EBL workflows where scholarship-linked cases require special handling.")
    caption_image(doc, ASSETS / "billing_flow.png", "Figure 3. Student bill calculation and live bill state flow", width=6.5)
    p(doc, "Payment recording currently applies the full outstanding amount in one transaction when a caretaker records payment. Duplicate payment creation is guarded through idempotency logic. EBL handling is separate because the bill does not simply move from pending to paid in one ordinary payment path.")


def approval_section(doc):
    doc.add_page_break()
    heading(doc, "5. Admin, Warden, and Dean Manual", 1)
    p(doc, "Administrative roles are less concerned with month-by-month data entry and more concerned with review, supervision, and approval. Their responsibilities include user management, hostel oversight, analytics review, report approval, and in some contexts institutional verification of generated records.")
    heading(doc, "5.1 Report Review and Approval", 2)
    p(doc, "Reports are generated from operational data and must move through controlled states such as draft, submitted, and approved. Approvers should treat the report pages as review surfaces that summarize what has already been computed rather than as places where calculations are typed manually.")
    caption_image(doc, ASSETS / "report_flow.png", "Figure 4. Report generation and approval flow", width=6.5)
    p(doc, "A warden may approve a submitted report when the state is valid. Dean or admin involvement depends on the workflow context. Invalid actions are blocked by the backend, which prevents state transitions that do not match the current report lifecycle.")

    heading(doc, "5.2 Analytics Review", 2)
    p(doc, "Administrative analytics aggregate expense, billed amount, collected payment amount, fines, and hostel-wise distribution. These totals are calculated from saved monthly data, not entered manually. Approvers should therefore read the analytics pages as summary views of underlying operational records.")

    heading(doc, "5.3 User and Hostel Management", 2)
    p(doc, "Admin-level users are responsible for user records, hostel configuration, and institutional access control. Because active/inactive state changes affect downstream calculations and live pages, deactivating a user or student should be done with care and only when the operational meaning is understood.")


def calculation_section(doc):
    doc.add_page_break()
    heading(doc, "6. Complete Calculation Handbook", 1)
    p(doc, "This chapter expands the live `CALCULATIONS_REFERENCE.md` into a descriptive user-facing form. Each subsection explains what the value means, where it is used, and the exact formula or rule that drives it. If a total on screen looks wrong, this chapter should be used as the first source of truth.")
    caption_image(doc, ASSETS / "calc_map.png", "Figure 5. Calculation dependency map from monthly entry to final display", width=6.5)

    heading(doc, "6.1 Global Rules", 2)
    p(doc, "Global rules apply to multiple modules and strongly affect what is visible or counted throughout the application.")
    formula(doc, "Active Student Rule", "Inactive students are excluded from live operations", "applies to lists, billing, analytics, advances, EBL, and scheduled jobs")
    formula(doc, "roundCurrency(value)", "round to 2 decimal places", "used for expense snapshots and report calculations")
    formula(doc, "roundUpCurrency(value)", "round up to next whole rupee", "used for student bill amounts and fine values")
    formula(doc, "Dynamic late fine", "daysLate * 2 for first 30 days", "before the higher-rate phase starts")
    formula(doc, "Dynamic late fine after 30 days", "(30 * 2) + ((daysLate - 30) * 5)", "applies once due date delay crosses 30 days")
    formula(doc, "Live bill fine", "manual_fine + late_fine", "fine stops growing after full payment")

    heading(doc, "6.2 Admin Analytics Formulas", 2)
    p(doc, "The admin analytics page turns saved expense and payment records into dashboard cards and graphs. These values are aggregates, so users should not expect them to match a single bill row; instead they summarize a month or a hostel.")
    formula(doc, "Expenses", "elp + cylinder + oil + kirana + milk + keb_total + labour_total + night_watch_total + bakery_total + banana_total")
    formula(doc, "Collected", "sum(Payment.amount where month matches and status = paid)")
    formula(doc, "Billed", "sum(MessBill.total_amount)", "active operational students only")
    formula(doc, "Outstanding", "sum((total_amount + fine) - amount_paid)", "active operational students only")
    formula(doc, "Total Bills", "count of active-student mess bills for the month")
    formula(doc, "Average Bill", "average(MessBill.total_amount)")
    formula(doc, "Total Fines", "sum(MessBill.fine)")
    formula(doc, "Collection Percentage", "(paidStudents / totalBills) * 100")
    formula(doc, "Hostel Split", "totalExpense, averageBill, totalFines, paidStudents, unpaidStudents per hostel")

    heading(doc, "6.3 Consumption Page Summary Formulas", 2)
    p(doc, "The caretaker's consumption page provides operational summaries even before bill generation happens. These summaries help confirm whether data entry is complete for the month.")
    formula(doc, "Egg Summary - Total Units", "sum(egg_count)")
    formula(doc, "Egg Summary - Students", "count(rows where egg_count > 0)")
    formula(doc, "Chicken Summary - Total Units", "sum(chicken_count)")
    formula(doc, "Chicken Summary - Students", "count(rows where chicken_count > 0)")
    formula(doc, "Paneer Summary - Total Units", "sum(paneer_count)")
    formula(doc, "Paneer Summary - Students", "count(rows where paneer_count > 0)")
    formula(doc, "Charges Summary - Milk", "sum(milk_amount)")
    formula(doc, "Charges Summary - Fine", "sum(fine_amount)")
    formula(doc, "Charges Summary - Absent Days", "sum(absent_days)")
    p(doc, "The `fine_amount` entered in the consumption sheet is not discarded. It becomes the manual fine portion of the later live bill.")

    heading(doc, "6.4 Hostel Expense Calculation Formulas", 2)
    p(doc, "The hostel expense module converts detailed bill rows and student counts into hostel-level calculation factors used later by bill generation.")
    formula(doc, "Stored total per expense field", "sum(bill_amount of all bill rows for that field)")
    formula(doc, "total_students", "count of active operational students in hostel")
    formula(doc, "total_girls", "count(gender = female)")
    formula(doc, "total_boys", "count(gender = male)")
    formula(doc, "egg_students_count", "count(consumption rows where egg_count > 0)")
    formula(doc, "chicken_students_count", "count(consumption rows where chicken_count > 0)")
    formula(doc, "paneer_students_count", "count(consumption rows where paneer_count > 0)")
    formula(doc, "keb_girls", "keb_total * 0.7")
    formula(doc, "keb_boys", "keb_total * 0.3")
    formula(doc, "keb_per_girl", "keb_girls / total_girls")
    formula(doc, "keb_per_boy", "keb_boys / total_boys")
    formula(doc, "labour_per_student", "labour_bill / total_students")
    formula(doc, "labour_night_watch_per_girl", "labour_per_student + (labour_night_watch / total_girls)")
    formula(doc, "misc_per_student", "(banana + bakery) / total_students")
    formula(doc, "egg_price_per_3", "egg_total / egg_students_count")
    formula(doc, "chicken_price_per_3", "chicken_total_misc / chicken_students_count")
    formula(doc, "paneer_price_per_3", "paneer_total / paneer_students_count")
    formula(doc, "egg_price_per_unit", "egg_price_per_3 / 3")
    formula(doc, "chicken_price_per_unit", "chicken_price_per_3 / 3")
    formula(doc, "paneer_price_per_unit", "paneer_price_per_3 / 3")

    heading(doc, "6.5 Monthly Expenditure Report Formulas", 2)
    p(doc, "The monthly expenditure report turns hostel expense figures plus manually entered balance values into the derived daily mess bill value that later drives bill generation.")
    formula(doc, "msc_total", "kirani + oil + milling + veg + milk + cylinder + elp")
    formula(doc, "other_misc", "chicken_total_misc + paneer_total + egg_total + banana + bakery")
    formula(doc, "guest_charge_total", "sum(GuestCharge.amount for the month)")
    formula(doc, "electricity_bill", "keb_total")
    formula(doc, "internet", "elp")
    formula(doc, "labour_payment", "labour_bill + labour_night_watch")
    formula(doc, "total_days", "total_students * daysInMonth")
    formula(doc, "total_closing_balance", "msc_total + closing_balance_last_month")
    formula(doc, "total_opening_balance", "total_closing_balance - opening_balance")
    formula(doc, "total_expenditure", "total_opening_balance - guest_charge_total")
    formula(doc, "mess_bill_per_day", "total_expenditure / total_days")

    heading(doc, "6.6 Expense Snapshot Formulas", 2)
    p(doc, "The expense snapshot consolidates month-level data from hostel expense, monthly expenditure report, charges, guest charges, and active-student consumption totals.")
    formula(doc, "mess_bill_total", "days_in_month * mess_bill_per_day")
    formula(doc, "milk_total", "sum(consumption milk amounts)")
    formula(doc, "banana_bakery_total", "banana_total + bakery_total")
    formula(doc, "dynamic_charge_total", "internal field for Static Charges Total")
    formula(doc, "student counts", "total_students, total_girls, total_boys from active students only")

    heading(doc, "6.7 Mess Bill and Student Bill Formulas", 2)
    p(doc, "The student bill is the most important calculation output in the system. It combines per-day mess values, hostel-shared expense components, student-specific consumption, static charges, manual fine, and live late fine.")
    formula(doc, "billableDays", "daysInMonth - absent_days")
    formula(doc, "base_mess", "mess_bill_per_day * billableDays", "used when per-day value exists")
    formula(doc, "base_mess fallback", "stored monthly mess total", "used when per-day value does not exist")
    formula(doc, "keb_charge for girls", "keb_girls / total_girls")
    formula(doc, "keb_charge for boys", "keb_boys / total_boys")
    formula(doc, "labour_charge", "labour_total / totalActiveStudents")
    formula(doc, "night_watch_charge for girls", "night_watch_total / totalGirls")
    formula(doc, "night_watch_charge for boys", "0")
    formula(doc, "bakery_charge", "banana_bakery_total / totalActiveStudents")
    formula(doc, "additional_charge", "sum(all static charge items for the month)")
    formula(doc, "egg_total", "egg_price * egg_count")
    formula(doc, "chicken_total", "chicken_price * chicken_count")
    formula(doc, "paneer_total", "paneer_price * paneer_count")
    formula(doc, "milk_total", "milk_amount")
    formula(doc, "total_amount", "base_mess + keb_charge + labour_charge + night_watch_charge + bakery_charge + additional_charge + egg_total + chicken_total + paneer_total + milk_total")
    formula(doc, "manual_fine", "fine from consumption sheet")
    formula(doc, "late_fine", "due-date-based dynamic fine")
    formula(doc, "fine", "manual_fine + late_fine")
    formula(doc, "total_payable", "total_amount + fine")
    formula(doc, "outstanding_amount", "total_payable - amount_paid")
    p(doc, "All bill amounts are rounded up to the next rupee. This means even if an intermediate sum is not a whole number, the stored or displayed bill-related amount is normalized upward.")

    heading(doc, "6.8 Absence Deduction Policy", 2)
    p(doc, "Absence deduction is one of the most visible student-sensitive rules, so users often need it explained clearly.")
    formula(doc, "Case 1", "0 to 4 absent days -> deduction = 0")
    formula(doc, "Case 2", "5 to 9 absent days -> deduction = absent_days * 10")
    formula(doc, "Case 3", "10 or more absent days -> deduction = absent_days * mess_bill_per_day")
    p(doc, "The generated bill stores absent days, billable days, and absence deduction explicitly so the student and office can verify that the policy was applied correctly.")

    heading(doc, "6.9 Payment Formulas and Rules", 2)
    p(doc, "When a caretaker records payment, the system first evaluates the live bill state and determines how much is still payable.")
    formula(doc, "outstanding before payment", "total_payable - amount_paid")
    formula(doc, "appliedAmount", "outstanding", "current implementation records the full outstanding amount in one payment")
    formula(doc, "new amount_paid", "old amount_paid + appliedAmount")
    formula(doc, "paid status rule", "payment_status = paid if amount_paid >= total_payable")
    formula(doc, "UPI rule", "Caretaker cannot record UPI unless the student has already updated a UTR")

    heading(doc, "6.10 Student Overview and Display Formulas", 2)
    formula(doc, "Current Payable", "bill.total_amount + bill.fine")
    formula(doc, "Current Fine", "bill.fine")
    formula(doc, "Utilities + Labour", "keb_charge + labour_charge")
    formula(doc, "Amount Paid", "bill.amount_paid")
    formula(doc, "Payments Made", "count(payment records returned to student)")
    formula(doc, "Collected Payments", "sum(payment.amount)")
    p(doc, "These student-facing values are display formulas. They do not create new financial meaning; they summarize saved and live bill data for readability.")

    heading(doc, "6.11 EBL Workflow Calculations", 2)
    p(doc, "EBL handling changes the standard bill lifecycle by dividing a bill into scholarship-supported and remaining-balance components.")
    caption_image(doc, ASSETS / "ebl_flow.png", "Figure 6. EBL workflow with claim and balance settlement", width=6.4)
    formula(doc, "GOI support", "distributed across monthly EBL details as goiAmount")
    formula(doc, "differenceAmount", "bill amount not covered by GOI support")
    formula(doc, "remainingBalance", "differenceAmount - universityClaimAmount - already settled components")
    p(doc, "After verification and claim updates, the remaining balance is settled through the payment flow. The bill then moves toward paid state only after the student-side or office-side balance has been cleared.")

    heading(doc, "6.12 Cross-Module Dependency Order", 2)
    p(doc, "The intended order is fixed and should be followed every month. Violating this order produces misleading outputs.")
    caption_image(doc, ASSETS / "overview_flow.png", "Figure 7. Cross-module dependency order", width=6.5)
    for item in [
        "Caretaker enters consumption.",
        "Caretaker enters guest charges.",
        "Caretaker enters static charges.",
        "Caretaker enters hostel expense bill breakdowns.",
        "System auto-generates monthly expenditure report draft, expense snapshot, student bills, mess bill per student report, and main report.",
    ]:
        bullet(doc, item)


def troubleshooting_section(doc):
    doc.add_page_break()
    heading(doc, "7. Troubleshooting and Common Mistakes", 1)
    p(doc, "Most user-facing issues in FinTrix are caused by incomplete dependency order rather than by random system behavior. This section translates the most likely operational mistakes into practical checks.")
    tips = [
        ("Bills look wrong for a month", "Check whether hostel expense, consumption, and static charge entries are complete for that month."),
        ("Student fine seems too high", "Verify manual fine in the consumption sheet and then check whether due-date-based late fine is still active."),
        ("Payment cannot be recorded as UPI", "Confirm that the student already saved a UTR number."),
        ("Analytics totals look low", "Check whether relevant students are inactive and therefore excluded by the active-student rule."),
        ("EBL bill not moving to normal paid state", "Verify period creation, verification, university claim update, and remaining balance settlement."),
        ("Report totals changed after edits", "This can happen if monthly expenditure report or expense snapshot was regenerated after balance updates."),
    ]
    two_col_table(doc, tips)
    caption_image(doc, ASSETS / "report_flow.png", "Figure 8. Report review path to use when status looks unexpected", width=6.2)


def appendix(doc):
    doc.add_page_break()
    heading(doc, "8. Source File Index and Maintenance Guidance", 1)
    p(doc, "The calculations in this manual are not speculative. They are based on the live reference and on the current service/controller structure in the repository. Users who audit or extend the system should begin with the files listed below.")
    rows = [
        ("Bills", "server/services/calculationService.js, server/services/billLifecycleService.js"),
        ("Hostel expense", "server/services/hostelExpenseCalculationService.js"),
        ("Monthly expenditure report", "server/services/monthlyExpenseReportService.js"),
        ("Expense snapshot", "server/controllers/expenseController.js"),
        ("Analytics", "server/controllers/analyticsController.js"),
        ("Consumption display", "client/src/pages/shared/ConsumptionManagementPage.jsx"),
        ("Hostel expense page", "client/src/pages/caretaker/CaretakerHostelExpensePage.jsx"),
        ("Mess bill page", "client/src/pages/caretaker/CaretakerMessBillPerStudentPage.jsx"),
        ("Reports page", "client/src/pages/caretaker/CaretakerReportsPage.jsx"),
        ("Student overview", "client/src/pages/student/StudentOverviewPage.jsx"),
    ]
    two_col_table(doc, rows)
    p(doc, "Maintenance rule: whenever a formula changes in code, this user manual should be updated in the same task. That keeps operational users, testers, and reviewers aligned with the actual behavior of the system.")


def main():
    doc = Document()
    base_style(doc)
    cover(doc)
    intro(doc)
    student_section(doc)
    caretaker_section(doc)
    approval_section(doc)
    calculation_section(doc)
    troubleshooting_section(doc)
    appendix(doc)
    doc.save(OUT)


if __name__ == "__main__":
    main()
