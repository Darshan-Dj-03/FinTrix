# FinTrix Calculations Reference

This file is the live calculation reference for the FinTrix application.

Use it when:
- a value looks wrong in the UI
- you want to know where a number comes from
- you want to update a formula safely
- you forget which page uses which calculation

This document is organized by user role and page.

## Global Rules

### Active Student Rule

Inactive students must not participate in live operations.

That means deactivated student accounts are excluded from:
- student lists used in live pages
- consumption sheets
- hostel expense headcounts
- bill generation
- bill listings
- analytics
- advances
- EBL live actions
- scheduled bill generation

Main source files:
- `server/controllers/studentController.js`
- `server/controllers/consumptionController.js`
- `server/controllers/messController.js`
- `server/controllers/analyticsController.js`
- `server/controllers/advanceController.js`
- `server/controllers/eblController.js`
- `server/jobs/billCron.js`

### Currency Rounding Rule

Two types of rounding are used:

- `roundCurrency(value)`:
  - rounds to 2 decimal places
  - used for expense snapshots and report calculations
- `roundUpCurrency(value)`:
  - rounds up to the next whole rupee
  - example: `657.01 -> 658`
  - used for student bill amounts and fine values

Main source files:
- `server/services/hostelExpenseCalculationService.js`
- `server/services/monthlyExpenseReportService.js`
- `server/services/billLifecycleService.js`
- `server/services/calculationService.js`

### Fine Rule

Dynamic late fine:
- first 30 days after due date: `daysLate * 2`
- after 30 days: `(30 * 2) + ((daysLate - 30) * 5)`

Live bill fine:
- `manual fine from consumption sheet + dynamic late fine`
- once a bill is fully paid, fine is frozen and no longer grows

Source file:
- `server/services/billLifecycleService.js`

---

## Admin

### Admin Analytics Page

Frontend page:
- `client/src/pages/admin/AdminAnalyticsPage.jsx`

Backend source:
- `server/controllers/analyticsController.js`

#### Monthly Finance Bars

These four bars come from `GET /analytics/finance/:month`.

##### Expenses

Calculated from the saved expense snapshot:

`elp + cylinder + oil + kirana + milk + keb_total + labour_total + night_watch_total + bakery_total + banana_total`

Source:
- `getFinanceAnalytics()`
- `Expense.aggregate(...)`

##### Collected

Calculated from payments:

`sum(Payment.amount where month matches and status = "paid")`

Source:
- `getFinanceAnalytics()`
- `Payment.aggregate(...)`

##### Billed

Calculated from mess bills:

`sum(MessBill.total_amount)`

Only operational active students are included.

Source:
- `getFinanceAnalytics()`
- `MessBill.aggregate(...)`

##### Outstanding

Calculated from mess bills:

`sum((total_amount + fine) - amount_paid)`

Only operational active students are included.

Source:
- `getFinanceAnalytics()`
- `MessBill.aggregate(...)`

#### Summary Text Above The Bars

This comes from `GET /analytics/summary/:month`.

##### Total Bills

`count of active-student mess bills for that month`

##### Average Bill

`average(MessBill.total_amount)`

##### Total Fines

`sum(MessBill.fine)`

##### Collection Status

- `totalPaid = sum(total_amount where payment_status = "paid")`
- `totalPending = sum(total_amount where payment_status in ["pending", "partial"])`
- `paidStudents = count(payment_status = "paid")`
- `unpaidStudents = count(payment_status in ["pending", "partial"])`
- `collectionPercentage = (paidStudents / totalBills) * 100`

#### Hostel Billed Split

This comes from `GET /analytics/hostel/:month`.

Per hostel:
- `totalStudents = count of active-student bills`
- `totalExpense = sum(total_amount)`
- `averageBill = average(total_amount)`
- `totalFines = sum(fine)`
- `paidStudents = count(payment_status = "paid")`
- `unpaidStudents = count(payment_status in ["pending", "partial"])`

The pie chart currently uses:
- `dataKey = totalExpense`
- `nameKey = hostelName`

#### Student Analytics Endpoint

Used by analytics student views:
- `GET /analytics/students/:month`

Per student row:
- `billAmount = MessBill.total_amount`
- `fine = MessBill.fine`
- `totalDue = billAmount + fine`

---

## Caretaker

### Consumption Page

Frontend page:
- `client/src/pages/shared/ConsumptionManagementPage.jsx`

Backend source:
- `server/controllers/consumptionController.js`

#### Students In Sheet

`count of active operational students returned by /student/all`

For caretaker mode, the list is also restricted to the caretaker's hostel.

#### Egg Summary

- `Total units = sum(egg_count)`
- `Students = count(rows where egg_count > 0)`

#### Chicken Summary

- `Total units = sum(chicken_count)`
- `Students = count(rows where chicken_count > 0)`

#### Paneer Summary

- `Total units = sum(paneer_count)`
- `Students = count(rows where paneer_count > 0)`

#### Charges Summary

- `Milk amount = sum(milk_amount)`
- `Fine amount = sum(fine_amount)`
- `Absent days = sum(absent_days)`

Important note:
- `fine_amount` here is the manual fine entered in the consumption sheet
- it later contributes to each student's live bill fine

### Hostel Expense Page

Frontend page:
- `client/src/pages/caretaker/CaretakerHostelExpensePage.jsx`

Core formula source:
- `server/services/hostelExpenseCalculationService.js`

#### Bill Breakdown System

For every configured hostel expense field, the stored total is:

`sum(bill_amount of all bill rows for that field)`

Each bill row has:
- `store_name`
- `bill_number`
- `description`
- `bill_amount`

If an old saved record existed before bill breakdown support, it is imported as:
- store name: `Legacy Entry`
- bill number: `-`
- description: `Imported existing total`

That fallback only exists so older data still loads.

#### Headcounts

- `total_students = count of active operational students in hostel`
- `total_girls = count(gender = female)`
- `total_boys = count(gender = male)`

#### Protein Student Counts

From active students' consumption rows for the selected month:

- `egg_students_count = count(records where egg_count > 0)`
- `chicken_students_count = count(records where chicken_count > 0)`
- `paneer_students_count = count(records where paneer_count > 0)`

#### KEB Split

- `keb_girls = keb_total * 0.7`
- `keb_boys = keb_total * 0.3`
- `keb_per_girl = keb_girls / total_girls`
- `keb_per_boy = keb_boys / total_boys`

#### Labour Split

- `labour_per_student = labour_bill / total_students`

#### Night Watch Per Girl

- `labour_night_watch_per_girl = labour_per_student + (labour_night_watch / total_girls)`

#### Misc Per Student

- `misc_per_student = (banana + bakery) / total_students`

#### Protein Prices

- `egg_price_per_3 = egg_total / egg_students_count`
- `chicken_price_per_3 = chicken_total_misc / chicken_students_count`
- `paneer_price_per_3 = paneer_total / paneer_students_count`

Per unit:

- `egg_price_per_unit = egg_price_per_3 / 3`
- `chicken_price_per_unit = chicken_price_per_3 / 3`
- `paneer_price_per_unit = paneer_price_per_3 / 3`

### Monthly Expenditure Report Block

Page:
- `client/src/pages/caretaker/CaretakerHostelExpensePage.jsx`

Service:
- `server/services/monthlyExpenseReportService.js`

#### MSC Breakdown

`msc_total` is:

`kirani + oil + milling + veg + milk + cylinder + elp`

#### Other Misc Breakdown

`other_misc` is:

`chicken_total_misc + paneer_total + egg_total + banana + bakery`

#### Guest Charges

`guest_charge_total = sum(GuestCharge.amount for the month)`

#### Utility Fields

- `electricity_bill = keb_total`
- `internet = elp`
- `labour_payment = labour_bill + labour_night_watch`
- `total_days = total_students * daysInMonth`

#### Final Monthly Expenditure Report Formulas

Inputs:
- `opening_balance`
- `closing_balance_last_month` (manual closing balance input)

Derived values:

- `total_closing_balance = msc_total + closing_balance_last_month`
- `total_opening_balance = total_closing_balance - opening_balance`
- `total_expenditure = total_opening_balance - guest_charge_total`
- `mess_bill_per_day = total_expenditure / total_days`

### Expense Snapshot Page / Report

Backend source:
- `server/controllers/expenseController.js`

This snapshot is generated from:
- hostel expense sheet
- monthly expenditure report
- static charges
- guest charges
- active-student consumption totals

Important values:

- `mess_bill_total = days_in_month * mess_bill_per_day`
- `milk_total = sum(consumption milk amounts)`
- `banana_bakery_total = banana_total + bakery_total`
- `dynamic_charge_total`:
  - this is still the internal field name
  - user-facing meaning is `Static Charges Total`
- `total_students`, `total_girls`, `total_boys` come from active students only

### Mess Bill / Student Page

Frontend page:
- `client/src/pages/caretaker/CaretakerMessBillPerStudentPage.jsx`

Client helpers:
- `client/src/features/bills/messBillBreakdown.js`

Backend source:
- `server/services/calculationService.js`
- `server/services/billLifecycleService.js`
- `server/controllers/messController.js`

#### Base Student Bill Calculation

For each active student:

##### Base Mess

If `mess_bill_per_day` exists:

`base_mess = mess_bill_per_day * billableDays`

Where:
- `billableDays = daysInMonth - absent_days`

If no per-day value exists:

`base_mess = stored monthly mess total`

##### Electricity

- girls: `keb_girls / total_girls`
- boys: `keb_boys / total_boys`

##### Labour

`labour_charge = labour_total / totalActiveStudents`

##### Night Watch

Girls only:

`night_watch_charge = night_watch_total / totalGirls`

Boys:

`night_watch_charge = 0`

##### Bakery / Banana

`bakery_charge = banana_bakery_total / totalActiveStudents`

##### Static Charges

`additional_charge = sum(all static charge items for the month)`

Stored internally as:
- `dynamic_charge_items`
- `additional_charge`

User-facing meaning:
- `Static Charges`

##### Protein and Milk

- `egg_total = egg_price * egg_count`
- `chicken_total = chicken_price * chicken_count`
- `paneer_total = paneer_price * paneer_count`
- `milk_total = milk_amount`

##### Bill Total Before Fine

`total_amount = base_mess + keb_charge + labour_charge + night_watch_charge + bakery_charge + additional_charge + egg_total + chicken_total + paneer_total + milk_total`

All bill amounts are rounded up to the next rupee.

#### Live Fine and Payable

From `applyLiveBillState(...)`:

- `manual_fine = fine from consumption sheet`
- `late_fine = due-date-based dynamic fine`
- `fine = manual_fine + late_fine`
- `total_payable = total_amount + fine`
- `outstanding_amount = total_payable - amount_paid`

#### Mess Bill / Student Summary Cards

On the page:

- `Total Billed = sum(live total_amount across visible student bills)`
- `Total Fine = sum(live fine across visible student bills)`
- `Student Bills = count(visible student bill rows)`

### Payments Page

Backend source:
- `server/controllers/paymentController.js`

#### Payment Recording

When caretaker records a payment:

- payable is read from `applyLiveBillState(bill).total_payable`
- outstanding is:
  - `total_payable - amount_paid`

Current implementation records the full outstanding amount in one payment:

- `appliedAmount = outstanding`

Then:

- `new amount_paid = old amount_paid + appliedAmount`
- `payment_status = paid if amount_paid >= total_payable`

UPI rule:
- caretaker cannot record UPI unless the student has already updated a UTR

#### Payment History

Visible live values:
- payment list uses `Payment.amount`
- counts and totals are sums of saved payment rows

### Reports Page

Frontend page:
- `client/src/pages/caretaker/CaretakerReportsPage.jsx`

This page mostly displays already-generated values, not new formulas.

Important displayed details:

- `Total Monthly Expenditure Report`
  - shows `total_expenditure`
  - shows `mess_bill_per_day`
- `Expense Snapshot Report`
  - shows `mess_bill_total`
  - shows `dynamic_charge_total` internally, but user-facing meaning is `Static`
- `Mess Bill Per Student Report`
  - shows `billCount` or bill breakdown pagination total

---

## Student

### Student Overview Page

Frontend page:
- `client/src/pages/student/StudentOverviewPage.jsx`

#### Current Payable

Displayed as:

`bill.total_amount + bill.fine`

This should match the live bill payable returned by the backend.

#### Current Fine

Displayed as:

`bill.fine`

This includes:
- manual fine from consumption sheet
- dynamic late fine

#### Utilities + Labour

Displayed as:

`keb_charge + labour_charge`

#### Amount Paid

Displayed as:

`bill.amount_paid`

#### Payments Made

Displayed as:

`count(payment records returned to the student)`

#### Collected Payments

Displayed as:

`sum(payment.amount)`

#### EBL Status

Displayed from current user flags:
- `approved` if `eblApproved` and `isEBL`
- `submitted` if `eblRequestPending`
- `rejected` if `eblRejected`
- otherwise `pending`

### Student Payments Page

Purpose:
- allows student to update UTR
- shows saved payment rows

Important rule:
- if student enters a UTR and no payment mode is provided, backend resolves it as `upi`

### Student Bill PDF

Backend source:
- `server/controllers/pdfDocumentController.js`

The simplified bill view shows line items without:
- subtotal rows like `Food Total`
- `Details` column

The values still come from the same saved/live bill fields described above.

---

## Cross-Module Flow

### Monthly Calculation Dependency Order

Current intended flow:

1. Caretaker enters consumption
2. Caretaker enters guest charges
3. Caretaker enters static charges
4. Caretaker enters hostel expense bill breakdowns
5. System auto-generates:
   - monthly expenditure report draft
   - expense snapshot
   - student bills
   - mess bill per student report
   - main report

Key controller:
- `server/controllers/hostelExpenseController.js`

### Bill Generation Inputs

Student bills depend on:
- expense snapshot
- active operational students
- student consumption
- static charges
- billing settings such as due date and announcement date

Main source:
- `server/services/calculationService.js`

---

## File Index

Use these first when checking formulas:

- Bills:
  - `server/services/calculationService.js`
  - `server/services/billLifecycleService.js`
- Hostel expense:
  - `server/services/hostelExpenseCalculationService.js`
- Monthly expenditure report:
  - `server/services/monthlyExpenseReportService.js`
- Expense snapshot:
  - `server/controllers/expenseController.js`
- Analytics:
  - `server/controllers/analyticsController.js`
- Page display logic:
  - `client/src/pages/admin/AdminAnalyticsPage.jsx`
  - `client/src/pages/shared/ConsumptionManagementPage.jsx`
  - `client/src/pages/caretaker/CaretakerHostelExpensePage.jsx`
  - `client/src/pages/caretaker/CaretakerMessBillPerStudentPage.jsx`
  - `client/src/pages/caretaker/CaretakerReportsPage.jsx`
  - `client/src/pages/student/StudentOverviewPage.jsx`

---

## Maintenance Note

Whenever a formula changes in code, update this file in the same task.

Recommended rule:
- if a calculation changes in a service/controller
- update this reference before closing the work
