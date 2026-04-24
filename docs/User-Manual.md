# Fintrix User Manual

## Purpose
This document is the operational user manual for the Fintrix hostel management system. It is written role by role and module by module so that each team member can understand:

- what data must be entered manually
- what the system calculates automatically
- how one module feeds the next module
- how statuses change
- how reports are generated and approved

This manual reflects the current system behavior after the recent updates to signup, absence deduction, payments, EBL claims, university claims, reports, and advance settlement.

## Roles Covered
- Student
- Caretaker
- Admin
- Warden
- Dean

## System Overview
Fintrix is designed to complete the hostel monthly billing cycle in a controlled sequence:

1. Setup monthly financial and operational inputs.
2. Record student-wise consumption and absence data.
3. Generate student bills.
4. Capture payments and EBL claim stages.
5. Generate reports.
6. Move reports through approvals.

If the earlier modules are incomplete or incorrect, later modules will also be incorrect. The system is therefore dependency-driven.

---

## 1. Student Role Manual

### 1.1 Student Signup
Students use signup only when they do not already have an approved account.

#### Student enters
- Full name
- Email
- Gender
- Student ID option
- Student ID if already available
- Password
- Confirm password

#### Student does not enter
- EBL status
- Hostel assignment

These are assigned during review by the institution.

#### Student ID options
- If the student already has a valid ID, they select manual ID entry and enter the ID.
- If the student does not have an ID, the system generates a temporary student ID and provides a copy option.

#### What happens next
1. Student submits signup request.
2. Caretaker reviews the request.
3. Caretaker assigns hostel and EBL status.
4. Caretaker forwards the request to admin.
5. Admin approves or rejects the request.
6. Only approved students can sign in.

### 1.2 Sign In
Students sign in using:
- approved student ID
- password

If the account does not exist or is not approved, access is blocked.

### 1.3 Forgot Password
The student uses the forgot password flow when login access is lost.

#### Flow
1. Enter registered email.
2. Receive OTP by email.
3. Enter OTP.
4. Enter new password.
5. Confirm new password.
6. Reset succeeds and the user is taken back to the sign-in page.

### 1.4 Profile Password Change
Students can also change password from the profile section.

#### Flow
1. Request email OTP from profile.
2. Enter OTP.
3. Enter new password.
4. Confirm password.
5. Save.

This flow uses email OTP and not current-password-only validation.

---

## 2. Student Billing Manual

### 2.1 Where the Student Sees Billing Data
Students can view billing details in:
- Student dashboard
- Bills page
- Bill PDF

### 2.2 What the Student Bill Shows
Each bill now includes:
- Bill month
- Bill amount
- Fine
- Payment status
- Amount paid
- Base mess
- Utilities and labour
- Absent days
- Absence deduction
- Detailed charge breakdown

If the student is in EBL flow, the bill also shows:
- GOI amount
- Difference amount
- University claim if recorded
- Remaining balance

### 2.3 Absence Visibility
Absence is no longer hidden in calculation only. The student bill explicitly shows:
- how many days the student was absent
- how much amount was deducted due to absence

This allows the student and office to verify whether the absence system is working.

---

## 3. Absence Deduction Policy

The absence deduction logic is:

- 0 to 4 absent days: no deduction
- 5 to 9 absent days: Rs.10 deduction per absent day
- 10 or more absent days: full per-day mess bill deduction for each absent day

### Formula Rules

#### Case 1: Up to 4 absent days
- Deduction = Rs.0
- Full mess bill must still be paid

#### Case 2: 5 to 9 absent days
- Deduction = absent days x Rs.10

#### Case 3: 10 or more absent days
- Deduction = absent days x per-day mess bill

The generated bill stores:
- absent days
- billable days
- absence deduction

These values are used in the student bill and PDF.

---

## 4. Caretaker Monthly Operations Manual

Caretaker is the main operational role for the monthly hostel cycle.

The caretaker typically works in this sequence:

1. Expense
2. Hostel Expense
3. Consumption
4. Guest Charge and Charges
5. Bill Generation
6. Payments
7. EBL
8. Reports

---

## 5. Expense Module Manual

This module is critical because it provides the base data for student bill generation.

### 5.1 Values Entered Manually
Depending on the configured fields, caretaker enters monthly expense values such as:
- ELP
- Cylinder
- Oil
- Kirana
- Milk or mess bill total
- KEB boys
- KEB girls
- Labour total
- Night watch total
- Bakery total
- Banana total
- Egg price
- Chicken price
- Paneer price
- Mess bill per day where applicable

### 5.2 What the System Does With These Values
These values are not directly assigned to one student at entry time.

Later, during bill generation:
- mess totals are converted into base mess amount
- KEB is divided by gender group
- labour is divided across active students
- night watch is applied to girls where configured
- bakery and banana are distributed across active students
- food item rates are multiplied by student consumption

### 5.3 Dependency
Bill generation depends on correct expense data for that month.

If expense data is missing or wrong:
- student bills will be incomplete or wrong
- reports for that month will also be wrong

---

## 6. Hostel Expense Module Manual

Hostel Expense is used to record detailed hostel expense entries and descriptions.

### Values Entered Manually
- Expense title or category
- Amount
- Detailed description or notes
- Date or month linkage where applicable

### Important Update
The description field is now larger so detailed notes can be recorded properly.

### How It Flows Forward
This module supports:
- monthly hostel expense reporting
- expense tracking and explanation

It does not directly create student bills by itself, but it supports the financial audit trail and hostel reporting flow.

---

## 7. Consumption Module Manual

The caretaker records per-student monthly consumption data here.

### Values Entered Manually Per Student
- Egg count
- Chicken count
- Paneer count
- Milk amount
- Fine amount if manually needed
- Absent days

### How It Flows Forward
When bills are generated:
- egg count x egg price becomes egg total
- chicken count x chicken price becomes chicken total
- paneer count x paneer price becomes paneer total
- milk amount becomes milk total
- absent days become absence deduction according to policy

### Important Note
If absent days are not entered correctly here, the student bill will not reflect the correct deduction.

---

## 8. Guest Charge and Additional Charges Manual

These modules are used for non-standard charge additions.

### Values Entered Manually
- Charge title
- Amount
- Month
- Related hostel or student linkage where applicable

### How It Flows Forward
These charges appear later in:
- bill breakdown
- charge reports
- monthly financial reference outputs

---

## 9. Bill Generation Manual

Bill generation should only be done after:
- monthly expense is ready
- student consumption is ready
- charge inputs are complete

### 9.1 Inputs Read By the System
The system reads:
- monthly expense record
- active students in hostel
- student gender
- student consumption record
- absent days
- dynamic charges

### 9.2 Main Calculations
For each student, the system calculates:
- base mess
- KEB charge
- labour charge
- night watch charge
- bakery or banana charge
- food totals
- absence deduction
- final bill amount

### 9.3 Output
Generated bill stores:
- total amount
- charge breakdown
- absent days
- absence deduction
- due date
- announcement date
- payment status

This bill then becomes the source for:
- student viewing
- PDFs
- payment processing
- report calculations

---

## 10. Payments Manual

## 10.1 Student Input
Students can enter:
- payment mode
- payment date
- UTR number

### Important Update
Students are allowed to enter payment date directly.

## 10.2 Caretaker Review
Caretaker can:
- fetch student payment details
- edit payment date if needed
- review UTR and payment mode
- process the payment

### Fine Popup
When processing a payment, if a fine is applicable the system shows:
- delay days
- fine amount

This applies to:
- normal students
- EBL students when remaining-balance payment is being processed

### Duplicate Safety
The system prevents duplicate payment entries for the same bill even if the request is repeated.

---

## 11. EBL Student Submission Manual

EBL flow begins with the student.

### 11.1 Values Student Enters
- From month
- To month
- GOI sanctioned amount
- Scholarship UTR
- Notes

### 11.2 What the System Shows to the Student
- total mess bill for the selected period

This allows the student to compare:
- total bill for period
- total GOI sanctioned amount

### 11.3 What Happens Internally
The GOI sanctioned amount is treated as scholarship amount.
It is used to calculate:
- monthly GOI share
- monthly difference amount
- period difference total

---

## 12. Caretaker EBL Review Manual

After student submission, caretaker works in two separate EBL stages.

### Stage 1: Submitted EBL Scholarship Details
Caretaker reviews:
- student ID
- student name
- period from month and to month
- total mess bill for that period
- GOI amount
- UTR
- notes

### Caretaker Action
- Accept

### Effect of Accept
Once accepted:
- student can no longer edit the claim
- claim data is treated as approved scholarship submission

Review button was removed; caretaker directly accepts after verification.

---

## 13. EBL Calculation Logic

This is the most important part of the EBL workflow.

### 13.1 Stage A: GOI Scholarship
The student submits GOI sanctioned amount.

For each month:
- Difference Amount = Monthly Mess Bill - Monthly GOI Amount

For the full period:
- Difference Total = Total Mess Bill - Total GOI Amount

### Example
If Aug to Oct total mess bill is Rs.8568 and GOI sanctioned amount is Rs.4320:

- Difference Total = 8568 - 4320 = 4248

This means after scholarship, the student side balance is Rs.4248.

### Status at This Stage
If difference total is still above zero:
- Status = Partially Paid - Scholarship Received

If difference becomes zero:
- Status = Paid

### Important Rule
At this stage, total payable should not remain equal to the full original bill amount.
It should reduce to the scholarship-adjusted balance.

---

## 14. EBL Claim From University Manual

This is the second EBL reduction stage and is handled by caretaker.

### Values Entered Manually
- Student
- From month
- To month
- Amount claimed from university
- Period UTR
- Scholarship notes

### What the Screen Should Show
- Mess bill amount for selected period
- Difference amount for selected period
- University claim amount
- Remaining balance after university claim

### Important Rule
University claim must be subtracted from difference amount, not from the original mess bill again.

### Correct Formula
- Balance After University Claim = Difference Total - University Claim

### Example
If:
- Total mess bill = Rs.8568
- GOI amount = Rs.4320
- Difference total = Rs.4248
- University claim received = Rs.2000

Then:
- Remaining balance = 4248 - 2000 = Rs.2248

The student should pay only the remaining balance, not the original full bill.

### Status at This Stage
If remaining balance is still above zero:
- Status = Partially Paid - University Claim Received

If remaining balance is zero or below:
- Status = Paid

### Important UI Rule
Caretaker should not manually type student-paid balance in this screen.
That screen is for university claim entry, not direct student payment collection entry.

Student payment of the remaining balance should be handled later through payment flow.

---

## 15. EBL Status Progression

### Possible Stages
- EBL
- Partially Paid - Scholarship Received
- Partially Paid - University Claim Received
- Paid

### Meaning
- EBL: EBL-linked bill exists but scholarship settlement is not yet fully applied
- Partially Paid - Scholarship Received: GOI amount is applied but balance remains
- Partially Paid - University Claim Received: university claim is also applied but balance still remains
- Paid: all remaining balance is cleared

---

## 16. Student EBL Bill Display Manual

In student bills and dashboard, the system should show:

### Before university claim
- Bill amount
- GOI amount
- Difference amount
- Balance amount equal to the difference
- Status: Partially Paid - Scholarship Received

### After university claim is entered
- Bill amount
- GOI amount
- University claim
- Balance amount after university claim
- Status: Partially Paid - University Claim Received

### After balance becomes zero
- Status: Paid

---

## 17. EBL Reports Manual

The caretaker EBL report section has its own month-range selector.

This is important because report generation should not depend on the month range selected at the top EBL claim form.

### Available EBL reports
- Pre-Receipt
- Month-wise Calculation
- University Claim Report
- University Claim Month-wise Report

### Purpose of each report

#### Pre-Receipt
Used for scholarship pre-receipt style documentation.

#### Month-wise Calculation
Shows month-level scholarship calculations.

#### University Claim Report
Shows period-level reconciliation after university claim is entered.

#### University Claim Month-wise Report
Shows month-by-month university claim distribution and remaining balance details.

---

## 18. Advance Module Manual

The advance module now tracks both advance issue and settlement activity.

### Values Entered Manually When Creating Advance
- Student
- Advance amount taken
- Reference details
- Notes if required

### Values Entered Manually During Settlement
- Settlement amount
- Settlement date
- Notes

### System Behavior
- Settled amount increases after every settlement
- Remaining balance decreases after every settlement
- Multiple settlements are allowed until balance becomes zero
- Settlement history remains visible for audit purposes

---

## 19. Student Signup Review Manual

### Caretaker stage
Caretaker reviews submitted student request and assigns:
- hostel
- EBL status

Then caretaker forwards the request to admin.

### Admin stage
Admin approves or rejects the request.

### Result
- Approved student can log in
- Rejected student cannot access the system

---

## 20. Admin User Management Manual

The admin user management screen uses one shared form for:
- creating a user
- updating a user

There is no longer a separate update popup.

### Behavior
- Selecting edit loads the same form in update mode
- reset or cancel returns the form to create mode

---

## 21. Reports and Approval Manual

### Caretaker
- generates reports
- submits reports

### Warden
- reviews submitted reports
- approves warden stage

### Dean
- reviews final stage reports where applicable
- approves dean stage

### Important Rule
Reports should be generated only after:
- bill values are checked
- EBL balances are correct
- payment states are correct
- absence deduction values are correct

Because later approvals depend on the saved values present in the generated reports.

---

## 22. Quick Dependency Summary

### Billing dependency chain
Expense -> Consumption -> Charges -> Bill Generation -> Payment / EBL -> Reports -> Approval

### Signup dependency chain
Student Signup -> Caretaker Review -> Admin Approval -> Login Access

### EBL dependency chain
Student GOI Submission -> Caretaker Accept -> Difference Calculation -> University Claim Entry -> Remaining Balance Payment -> Report Generation

---

## 23. Operational Checks Before Closing a Month

Before the month is considered operationally complete, verify:

- expense data is entered
- consumption data is entered
- absent days are correct
- bill generation is complete
- student bills show absent days and absence deduction
- payment dates and UTR values are correct
- EBL GOI values are correct
- university claim values are correct
- remaining balances are correct
- required reports are generated
- approvals are completed where applicable

---

## 24. Notes

- Ledger system has been removed and should no longer be treated as part of the workflow.
- Student bill display is now the primary visibility layer for absence deduction and EBL balance verification.
- Payment fine warnings appear during payment processing rather than requiring manual external checking.
- EBL claim and university claim are two different stages and must be treated separately in calculations and reporting.
