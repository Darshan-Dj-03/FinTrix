# Mess Bill API Documentation

## Overview

The Mess Bill Engine is the core calculation system that generates student-wise monthly bills from hostel expenses, active student records, and per-student consumption data. It handles all billing logic including gender-based splits, fine calculations, and role-based access control.

---

## Architecture

### Models

#### MessBill
Stores a student's monthly mess bill with complete charge breakdown.

**Key Fields:**
- `studentId` (ref: Student) – The student being billed
- `userId` (ref: User) – User account for the student
- `hostelId` (ref: Hostel) – Which hostel the bill is for
- `month` (String) – "Mon-YYYY" format (e.g., "Jan-2026")
- `base_mess`, `keb_charge`, `labour_charge`, `night_watch_charge`, `bakery_charge` – Charge breakdown
- `egg_count`, `egg_total`, `chicken_count`, `chicken_total`, `paneer_count`, `paneer_total` – Unit items
- `total_amount` – Final bill total
- `fine` – Late payment fine
- `due_date` – When payment is due (20th of following month)
- `payment_status` – "pending" or "paid"

**Unique Constraint:** One bill per student per month (compound index on `studentId` + `month`)

#### StudentConsumption
Tracks monthly per-student consumption counts for unit-based food items.

**Key Fields:**
- `studentId` (ref: Student)
- `month` (String) – "Mon-YYYY" format
- `egg_count`, `chicken_count`, `paneer_count` – Consumption counts

**Unique Constraint:** One consumption record per student per month

### Service Layer

**File:** `services/calculationService.js`

Exports:
- `generateMessBills(expense, students, consumptionRecords, options)` – Core calculation engine
- `calculateDueDate(month)` – Returns due date (20th of next month)
- `calculateFine(dueDate, currentDate, isEBL, eblExemptFine)` – Calculates late payment fine
- `roundTwoDecimals(value)` – Utility for monetary rounding

---

## Calculation Logic

### 1. Base Mess Charge
```
base_total = elp + cylinder + oil + kirana + milk
base_per_student = base_total / total_active_students
```

### 2. KEB (Electricity) Charge
Split by gender using pre-calculated totals from Expense:
```
girls_charge_per_student = keb_girls / total_girls
boys_charge_per_student = keb_boys / total_boys
```

### 3. Labour Charge
```
labour_per_student = labour_total / total_active_students
```

### 4. Night Watch Charge (Girls Only)
```
night_watch_per_girl = night_watch_total / total_girls
Apply only for female students; 0 for males
```

### 5. Bakery + Banana Charge
```
combined_total = bakery_total + banana_total
per_student = combined_total / total_active_students
```

### 6. Unit Items
```
egg_total = egg_price × egg_count (from StudentConsumption)
chicken_total = chicken_price × chicken_count
paneer_total = paneer_price × paneer_count
```

### 7. Final Total
```
total = base_mess + keb_charge + labour_charge 
      + (night_watch_charge if female, else 0)
      + bakery_charge + egg_total + chicken_total + paneer_total
```

### 8. Fine Calculation
Rules:
```
days_late = current_date - due_date

if days_late <= 0:
  fine = 0

elif days_late <= 30:
  fine = days_late × 2

else:
  fine = (30 × 2) + ((days_late - 30) × 5)
```

**EBL Exception:** If `isEBL = true` and `eblExemptFine = true` (default), fine is set to 0.

---

## API Endpoints

### 1. Generate Bills
**POST** `/bill/generate/:month`

**Access:** Caretaker only (must be assigned to a hostel)

**Params:**
- `month` (string) – "Mon-YYYY" format, e.g., "Jan-2026"

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Bills for Jan-2026 generated successfully for 25 students.",
  "month": "Jan-2026",
  "count": 25,
  "bills": [
    {
      "_id": "...",
      "studentId": {
        "_id": "...",
        "studentId": "STU2024001",
        "gender": "female",
        "isEBL": false,
        "isActive": true,
        "userId": { "name": "...", "username": "..." }
      },
      "userId": { "name": "...", "username": "..." },
      "hostelId": { "name": "Girls Hostel", "type": "girls", "location": "..." },
      "month": "Jan-2026",
      "base_mess": 450.50,
      "keb_charge": 250.00,
      "labour_charge": 180.75,
      "night_watch_charge": 100.00,
      "bakery_charge": 75.25,
      "egg_count": 4,
      "egg_total": 40.00,
      "chicken_count": 2,
      "chicken_total": 200.00,
      "paneer_count": 0,
      "paneer_total": 0.00,
      "total_amount": 1296.50,
      "fine": 0.00,
      "due_date": "2026-02-20T00:00:00.000Z",
      "payment_status": "pending",
      "createdAt": "...",
      "updatedAt": "..."
    }
    // ... more bills
  ]
}
```

**Error Responses:**

| Status | Error Condition |
|--------|-----------------|
| 400 | Caretaker not assigned to a hostel |
| 400 | Invalid month format |
| 400 | No active students found |
| 404 | No expense record for hostel + month |
| 409 | Bills already generated for this hostel + month |
| 500 | Server error |

**Flow:**
1. Validates caretaker's hostelId
2. Fetches Expense record for hostel + month
3. Checks for existing bills (prevents duplicates)
4. Fetches all active students assigned to the hostel
5. Fetches StudentConsumption records for the same month
6. Calls calculation service
7. Inserts all bills into DB
8. Returns populated results

---

### 2. Get All Bills by Month
**GET** `/bill/all/:month`

**Access:** Caretaker (own hostel only), Admin (all hostels)

**Params:**
- `month` (string) – "Mon-YYYY" format

**Response (200 OK):**
```json
{
  "success": true,
  "month": "Jan-2026",
  "count": 50,
  "bills": [
    // ... bill objects (same structure as above)
  ]
}
```

**Behavior:**
- **Caretaker:** Returns bills for their assigned hostel only
- **Admin:** Returns bills for all hostels

---

### 3. Get Student's Bill
**GET** `/bill/student/:studentId/:month`

**Access:** Protected (role-based)
- **Student:** Can view only their own bill
- **Caretaker:** Can view any bill
- **Admin:** Can view any bill

**Params:**
- `studentId` (string) – Student document _id
- `month` (string) – "Mon-YYYY" format

**Response (200 OK):**
```json
{
  "success": true,
  "bill": {
    // ... bill object
  }
}
```

**Error Responses:**

| Status | Error Condition |
|--------|-----------------|
| 400 | Invalid month format |
| 400 | Invalid studentId format |
| 403 | Student attempting to view another student's bill |
| 404 | Bill not found |
| 500 | Server error |

---

## Usage Examples

### Example 1: Generate Bills for a Hostel

**Request:**
```bash
POST /bill/generate/Jan-2026
Authorization: Bearer <caretaker_token>
Content-Type: application/json
```

**Prerequisites:**
1. Caretaker account assigned to a hostel
2. Expense record exists for Jan-2026 in that hostel
3. At least one active student in the hostel
4. (Optional) StudentConsumption records for the month

### Example 2: Student Viewing Their Own Bill

**Request:**
```bash
GET /bill/student/6507d1c8f9a2b3c4d5e6f7a1/Jan-2026
Authorization: Bearer <student_token>
Content-Type: application/json
```

The endpoint verifies that the student (`6507d1c8f9a2b3c4d5e6f7a1`) belongs to the authenticated user before returning the bill.

### Example 3: Admin Viewing All Bills for a Month

**Request:**
```bash
GET /bill/all/Jan-2026
Authorization: Bearer <admin_token>
Content-Type: application/json
```

Returns bills from all hostels for that month.

---

## Implementation Details

### Validation

1. **Month Format:** All endpoints validate month as "Mon-YYYY" (Jan, Feb, ..., Dec followed by 4-digit year)
2. **Student Count:** Generation fails if no active students exist (prevents invalid bills)
3. **Duplicate Prevention:** Generation rejects if bills already exist for hostel + month
4. **Missing Consumption:** Defaults to 0 if no StudentConsumption record exists for a student

### Population

All read endpoints populate related documents:
- `studentId` → Student details + User details
- `userId` → User name and username
- `hostelId` → Hostel name, type, and location

### Rounding

All monetary values are rounded to 2 decimal places using `Math.round(value * 100) / 100` to prevent floating-point drift.

### Fine Calculation

- **Current Date Reference:** Fine calculation uses the current date by default, but can be overridden via `options.currentDate` in the service for testing
- **EBL Exemption:** Enabled by default; set `options.eblExemptFine = false` to apply fine even for EBL students
- **Due Date:** Always calculated as the 20th of the month following the billing month

---

## Database Indexes

### MessBill
- **Unique Index:** `{ studentId: 1, month: 1 }` – Enforces one bill per student per month

### StudentConsumption
- **Unique Index:** `{ studentId: 1, month: 1 }` – Enforces one consumption record per student per month

---

## Error Handling

All endpoints follow a consistent error response format:
```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

HTTP status codes follow REST conventions:
- **400:** Bad Request (validation failure)
- **403:** Forbidden (authorization failure)
- **404:** Not Found (resource doesn't exist)
- **409:** Conflict (duplicate generation attempt)
- **500:** Internal Server Error

---

## Testing Checklist

1. **Bill Generation**
   - ✓ Generate bills successfully
   - ✓ Prevent duplicate generation
   - ✓ Handle missing expense record
   - ✓ Handle no active students
   - ✓ Calculate charges correctly for both genders
   - ✓ Apply unit item consumption correctly
   - ✓ Calculate fine based on days late
   - ✓ Exempt EBL students from fine

2. **Caretaker Access**
   - ✓ Only see own hostel's bills
   - ✓ Generate bills only for own hostel

3. **Student Access**
   - ✓ Only see own bill
   - ✓ Cannot see other students' bills

4. **Admin Access**
   - ✓ See all bills
   - ✓ See all hostels' bills

5. **Edge Cases**
   - ✓ All girls hostel (no boys, so boys_keb = 0)
   - ✓ All boys hostel (no girls, so girls_keb = 0, night_watch = 0)
   - ✓ No consumption records (defaults to 0)
   - ✓ Consumption but no expense (should not generate)

---

## Notes

- The calculation service is decoupled from controllers for testability
- All calculations happen synchronously in the service layer
- The database insert is atomic (all or none via `insertMany`)
- Due dates are always calculated as the 20th of the following month
- Fine calculations use UTC timestamps for consistency

---

## Future Enhancements

1. **Payment Recording:** Add endpoint to mark bills as paid with transaction details
2. **Report Generation:** Create summary reports by hostel, gender, or student status
3. **Reminders:** Automated reminder notifications for pending payments
4. **Adjustments:** Allow manual bill adjustments with audit trail
5. **Batch Updates:** Consume StudentConsumption data in bulk from external sources
6. **Forecasting:** Project future bills based on historical patterns

