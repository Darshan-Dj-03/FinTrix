Fintrix Backend - Implemented Changes Summary
============================================

Project Scope Completed
-----------------------
Completed the remaining backend phases for the hostel mess billing system:
- Phase 8 + Phase 14: Report and Approval System
- Phase 11: EBL Request and Approval System
- Phase 13: Dynamic Charges System
- Phase 15: Ledger System

All updates follow the existing architecture pattern:
- MVC structure
- Service-layer calculations
- Middleware-based auth + role checks
- Existing response format and error handling style


1) New Controllers Added
------------------------
Created the following controller files:
- server/controllers/reportController.js
- server/controllers/eblController.js
- server/controllers/chargeController.js
- server/controllers/ledgerController.js

reportController.js:
- Generate monthly report
- Submit report for approval
- Warden approval
- Dean/Admin approval
- Get report status
- Get full monthly report (with analytics-style aggregates)
- Enforced strict status flow:
  draft -> submitted -> warden_approved -> dean_approved
- Prevented skipping steps and duplicate approvals

eblController.js:
- Request EBL status (student/caretaker)
- Approve/reject EBL status (admin)
- Persisted EBL state in both User and Student records for compatibility

chargeController.js:
- Add dynamic monthly charge
- Get charges by month
- Update charge
- Delete charge
- Role-aware hostel restrictions for caretaker actions

ledgerController.js:
- Create monthly ledger
- Get ledger by month
- Aggregation-based calculations for:
  openingBalance, totalExpenses, totalBilled, totalCollected,
  closingBalance, outstanding
- Enforced one ledger per hostel per month


2) New Routes Added
-------------------
Created route files:
- server/routes/reportRoutes.js
- server/routes/eblRoutes.js
- server/routes/chargeRoutes.js
- server/routes/ledgerRoutes.js

Mounted in server/server.js:
- app.use("/report", reportRoutes)
- app.use("/ebl", eblRoutes)
- app.use("/charges", chargeRoutes)
- app.use("/ledger", ledgerRoutes)

Middleware usage:
- protect middleware applied
- checkRole middleware applied per endpoint role requirements
- express-validator + validateRequest used on params/body


3) Model Updates
----------------
Updated models to support missing phases and constraints:

server/models/Charge.js
- Normalized fields to phase requirement:
  hostelId, month, title, amount, addedBy
- Added unique compound index:
  { hostelId, month, title } (duplicate prevention)
- Added query index:
  { hostelId, month }

server/models/Report.js
- Added reporting fields:
  totalExpenses, totalBilled, totalCollected, outstanding
  hostelWiseBreakdown, studentWiseSummary
- Retained and enforced status enum flow fields
- Added status query index:
  { month, status, hostelId }

server/models/Ledger.js
- Aligned fields to required calculations:
  openingBalance, totalExpenses, totalBilled, totalCollected,
  closingBalance, outstanding
- Added unique constraint:
  { hostelId, month }
- Added query index:
  { month, hostelId, createdAt }

server/models/User.js
- Added EBL workflow fields:
  isEBL, eblApproved, eblRequestPending

server/models/Payment.js
- Aligned month format validation to Mon-YYYY for compatibility with existing billing flow

server/models/MessBill.js
- Added additional_charge field for dynamic charge distribution in each bill


4) Service and Billing Integration Updates
------------------------------------------
server/services/calculationService.js
- Extended generateMessBills(...) options to accept dynamic charges
- Calculated additional charge per student:
  sum(charges.amount) / totalActiveStudents
- Included additional charge in total bill calculation

server/controllers/messController.js
- Included monthly hostel charges while generating manual bills

server/jobs/billCron.js
- Included monthly hostel charges while generating cron-based bills
- Aligned cron-generated billing month format to Mon-YYYY

server/services/fineService.js
- Updated EBL fine behavior to 100% waiver
- EBL students now get fine = 0


5) Business Rules Enforced
--------------------------
Report Approval Workflow:
- No skipping workflow states
- No duplicate approvals
- Role restrictions enforced

EBL Rules:
- Student/caretaker can request EBL
- Admin approves/rejects EBL
- EBL students receive full fine waiver (100%)

Dynamic Charges:
- Monthly charge CRUD implemented
- Duplicate titles prevented per hostel-month
- Charges included in both manual and cron bill generation

Ledger Rules:
- One ledger per hostel-month
- Aggregation-based totals
- Derived metrics:
  closingBalance = openingBalance + totalCollected - totalExpenses
  outstanding = totalBilled - totalCollected


6) Files Touched
----------------
New files:
- server/controllers/reportController.js
- server/controllers/eblController.js
- server/controllers/chargeController.js
- server/controllers/ledgerController.js
- server/routes/reportRoutes.js
- server/routes/eblRoutes.js
- server/routes/chargeRoutes.js
- server/routes/ledgerRoutes.js

Updated files:
- server/server.js
- server/models/Charge.js
- server/models/Report.js
- server/models/Ledger.js
- server/models/User.js
- server/models/Payment.js
- server/models/MessBill.js
- server/services/calculationService.js
- server/controllers/messController.js
- server/jobs/billCron.js
- server/services/fineService.js

