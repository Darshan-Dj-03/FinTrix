# Mess Bill System - Quick Start Guide

## Files Added

```
server/
├── models/
│   ├── MessBill.js                 # Bill storage schema
│   └── StudentConsumption.js        # Consumption tracking schema
├── services/
│   └── calculationService.js        # Core calculation engine
├── controllers/
│   └── messController.js            # API endpoints
├── routes/
│   └── billRoutes.js                # Route definitions
└── server.js                        # (UPDATED: added bill routes)

Documentation/
├── MESS_BILL_API.md                 # Complete API documentation
└── MESS_BILL_QUICK_START.md         # This file
```

## Architecture Summary

### Models
- **MessBill:** Stores calculated student bills with charge breakdown, fine, and payment status
- **StudentConsumption:** Tracks per-student monthly consumption counts (egg, chicken, paneer)

### Service Layer
- **calculationService.js:** Pure business logic for:
  - Base mess calculation
  - Gender-based KEB split
  - Labour and night watch charges
  - Unit item totals
  - Fine calculation with EBL exemption
  - 2-decimal place rounding

### Controllers
- **messController.js:** Three endpoints:
  - `POST /bill/generate/:month` — Caretaker generates bills for their hostel
  - `GET /bill/all/:month` — Caretaker/Admin view bills
  - `GET /bill/student/:studentId/:month` — Student/Caretaker/Admin view specific bill

## Calculation Flow

```
Input:
  Expense (hostel expenses for month)
  Students (active students with gender, isEBL, isActive)
  Consumption (per-student counts for egg, chicken, paneer)

Processing:
  1. Filter active students
  2. Segment by gender (boys/girls)
  3. Calculate per-unit charges (base, KEB, labour, night watch, bakery)
  4. For each student:
     - Apply gender-based KEB charge
     - Apply gender-based night watch charge (girls only)
     - Look up consumption records (default to 0)
     - Calculate unit item totals
     - Sum all charges
     - Calculate due date (20th of next month)
     - Calculate fine (with EBL exemption)

Output:
  Array of MessBill documents ready for DB insertion
```

## Key Business Rules

### Charge Allocation

| Charge | Formula | Notes |
|--------|---------|-------|
| Base Mess | (elp + cylinder + oil + kirana + milk) / total_students | Same for all |
| KEB Girls | keb_girls / total_girls | Female students only |
| KEB Boys | keb_boys / total_boys | Male students only |
| Labour | labour_total / total_students | Same for all |
| Night Watch | night_watch_total / total_girls | Females only, 0 for males |
| Bakery+Banana | (bakery_total + banana_total) / total_students | Same for all |
| Unit Items | price × consumption_count | Per student consumption |

### Fine Rules

```
if days_late <= 0:
  fine = 0
elif days_late <= 30:
  fine = days_late × 2
else:
  fine = 60 + ((days_late - 30) × 5)

Special: If isEBL = true, fine defaults to 0 (configurable)
```

### Access Control

| Role | Generate | View All | View Own |
|------|----------|----------|----------|
| Caretaker | ✓ (own hostel) | ✓ (own hostel) | N/A |
| Admin | ✗ | ✓ (all hostels) | N/A |
| Student | ✗ | ✗ | ✓ (own bill only) |

## Implementation Checklist

- [x] MessBill model with proper schema and unique index
- [x] StudentConsumption model with proper schema and unique index
- [x] Calculation service with all logic
- [x] MessController with 3 API endpoints
- [x] BillRoutes with proper middleware
- [x] Integration in server.js

## Database Preparation

Before using the system, ensure:

1. **Mongodb Indexes:** MongoDB will auto-create indexes when models are first used
   ```javascript
   // MessBill index
   db.messbills.createIndex({ studentId: 1, month: 1 }, { unique: true })
   
   // StudentConsumption index
   db.studentconsumptions.createIndex({ studentId: 1, month: 1 }, { unique: true })
   ```

2. **Sample Data Setup:**
   ```javascript
   // 1. Create hostels
   POST /hostel/create { name: "Girls Hostel", type: "girls", location: "..." }
   
   // 2. Create students (automatically creates User + Student)
   POST /student/add {
     name: "John Doe",
     studentId: "STU2024001",
     gender: "male",
     hostelId: "...",
     isEBL: false
   }
   
   // 3. Create expense record
   POST /expense/create {
     month: "Jan-2026",
     hostelId: "...",
     elp: 5000,
     cylinder: 2000,
     oil: 1500,
     kirana: 10000,
     milk: 3000,
     keb_total: 20000,
     working_days: 26,
     bakery_total: 2000,
     banana_total: 500,
     egg_price: 10,
     chicken_price: 100,
     paneer_price: 150
   }
   
   // 4. (Optional) Create consumption records
   POST /consumption { studentId: "...", month: "Jan-2026", egg_count: 4, chicken_count: 2, paneer_count: 0 }
   
   // 5. Generate bills
   POST /bill/generate/Jan-2026
   ```

## Testing Workflow

### Test 1: Basic Bill Generation
```bash
# 1. Login as caretaker
POST /auth/login { username: "caretaker1", password: "..." }
# → Get token

# 2. Generate bills for Jan-2026
POST /bill/generate/Jan-2026
Authorization: Bearer <token>
# → Should return 201 with array of bills

# 3. Fetch all bills
GET /bill/all/Jan-2026
Authorization: Bearer <token>
# → Should return all bills for hostel
```

### Test 2: Student Views Own Bill
```bash
# 1. Login as student
POST /auth/login { username: "stu2024001", password: "..." }
# → Get token and note user._id

# 2. Get own bill
GET /bill/student/<student_id>/Jan-2026
Authorization: Bearer <token>
# → Should return the bill

# 3. Try to view another student's bill
GET /bill/student/<other_student_id>/Jan-2026
Authorization: Bearer <token>
# → Should return 403 Forbidden
```

### Test 3: Duplicate Prevention
```bash
# Try to generate same month twice
POST /bill/generate/Jan-2026
# → First call succeeds
# → Second call returns 409 Conflict
```

### Test 4: Gender Split Verification
```bash
# Manually verify charges in response:
# - All female students should have keb_girls_per_student
# - All male students should have keb_boys_per_student
# - All female students should have night_watch_charge
# - All male students should have night_watch_charge = 0
```

### Test 5: Fine Calculation
```bash
# Check fine calculation in response:
# - If bill is fresh (within month): fine should be 0
# - If bill is 15 days late: fine should be 30
# - If bill is 45 days late: fine should be 60 + (15 × 5) = 135
# - If isEBL=true: fine should be 0 (unless eblExemptFine=false)
```

## Troubleshooting

### Issue: "No active students found to bill for this month"
**Solution:** Ensure students are assigned to the caretaker's hostel and have `isActive = true`

### Issue: "No expense record found"
**Solution:** Create expense record before generating bills via `POST /expense/create`

### Issue: "Bills already generated"
**Solution:** This is correct behavior to prevent duplicates. To regenerate, delete existing bills from DB first

### Issue: Consumption records not being used
**Solution:** StudentConsumption records are optional. If missing, system defaults to 0 counts

### Issue: Fine calculation seems incorrect
**Solution:** Check that:
1. due_date is correctly calculated as 20th of next month
2. EBL exemption is enabled by default
3. currentDate is today (not overridden in options)

## Service API Reference

```javascript
// calculationService.js exports

generateMessBills(expense, students, consumptionRecords, options = {})
  // Main calculation function
  // Returns: Array of bill objects ready to insert
  // Throws: Error if validation fails (e.g., no active students)

calculateDueDate(month)
  // Input: "Jan-2026"
  // Returns: Date object (20th of next month)

calculateFine(dueDate, currentDate, isEBL, eblExemptFine)
  // Input: due date, today's date, student's EBL status, exemption flag
  // Returns: Fine amount (number)

roundTwoDecimals(value)
  // Input: Any number
  // Returns: Rounded to 2 decimals
```

## Code Quality

All files:
- ✓ Pass Node.js syntax check (`node -c`)
- ✓ Follow existing project patterns and naming conventions
- ✓ Include comprehensive JSDoc comments
- ✓ Handle errors with descriptive messages
- ✓ Use Mongoose population for related documents
- ✓ Implement role-based access control
- ✓ Use 2-decimal rounding for monetary values

## Performance Considerations

- **Bill Generation:** Bulk insert via `insertMany` (atomic operation)
- **Queries:** Use indexed fields (month, hostelId, studentId)
- **Population:** Nested population for student→user→hostel relationship
- **Calculation:** All math done in-memory (no DB queries in loop)

## Security Features

- ✓ JWT authentication required for all endpoints
- ✓ Role-based access control (caretaker/admin/student)
- ✓ Students can only view own bills
- ✓ Duplicate bill prevention
- ✓ Input validation (month format, ObjectId format)
- ✓ No exposure of sensitive data in responses

## Next Steps

After implementation is complete:

1. **Test thoroughly** using the testing workflow above
2. **Set up Postman collection** with endpoints and sample data
3. **Create cron job** for automated bill generation on 5th of each month
4. **Add payment tracking** module for recording payments and receipts
5. **Build report generation** for hostel managers and administrators
6. **Implement notification system** for payment reminders

---

**Implementation Complete!** 🎉

The Mess Bill Calculation Engine is now fully integrated into the FinTrix backend. All models, services, controllers, and routes are in place and ready for testing.

