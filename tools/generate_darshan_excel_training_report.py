import sys
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from generate_member_training_reports import build_report  # noqa: E402


member_data = {
    "member_name": "Darshan Jagnaure",
    "filename": "Training_Report_Darshan_Jagnaure_Excel_Based_v2.docx",
    "report_title": "Microsoft Excel for Hostel Administrative Records and Billing Support",
    "introduction": [
        "This training report is prepared for Darshan Jagnaure and is based entirely on the manual work carried out using Microsoft Excel during the training period. The report does not describe any software project implementation. Instead, it focuses on spreadsheet-based administrative work such as bill preparation, statement formatting, monthly register maintenance, reimbursement support sheets, data validation, reconciliation, and document-ready summary preparation.",
        "During the training period, Microsoft Excel was used as a practical working tool for organizing hostel-related administrative records in a structured manner. The work included preparing student-wise bill sheets, maintaining charge and consumption entries in tabular format, arranging reimbursement-related statements, checking totals, verifying differences, correcting formula errors, and preparing clean print-ready registers. These activities gave practical exposure to how manual office work supports institutional record keeping before or alongside digital systems.",
        "The training was valuable because it demonstrated that spreadsheet work is not limited to simple data entry. Accurate Excel work requires row and column planning, formula discipline, cross-checking of totals, filtering, sorting, validation, and careful formatting for official use. Through repeated manual exercises, better understanding was developed regarding how institutions manage recurring registers, monthly statements, and supporting financial records using spreadsheets.",
        "The present report therefore explains the training activities carried out in Excel, the methodology followed while organizing data, the work completed in different spreadsheet areas, the practical challenges faced during manual register preparation, and the learning outcomes gained from this experience. The report is entirely training-oriented and remains separate from any software project report.",
    ],
    "objective_intro": "The main objectives of this training were related to spreadsheet-based record preparation, calculation support, and administrative documentation. The major objectives were:",
    "objectives": [
        "To understand how Microsoft Excel can be used for maintaining hostel administrative records in a structured format.",
        "To learn how student-wise monthly bill sheets can be prepared manually using rows, columns, formulas, and summary fields.",
        "To gain practical experience in preparing reimbursement and claim-related statements through spreadsheet methods.",
        "To improve skills in sorting, filtering, validation, reconciliation, and correction of spreadsheet-based records.",
        "To learn how official-looking reports and print-ready statements can be formatted properly in Excel.",
        "To develop discipline in checking totals, differences, and repetitive monthly data before final submission or printing.",
    ],
    "domain_overview": [
        "Microsoft Excel is one of the most widely used tools for institutional record keeping, financial assistance, bill preparation, and summary management. In administrative environments, Excel is often used to prepare structured sheets where data must be entered carefully, formulas must work correctly, and printed outputs must remain readable and accurate.",
        "In the context of hostel-related office work, spreadsheets are especially useful for preparing student-wise bill statements, monthly cost summaries, claim sheets, reimbursement calculations, attendance-linked entries, and other recurring registers. The training period provided practical insight into how such spreadsheet-based tasks are performed in a disciplined way.",
    ],
    "tech_blocks": [
        {
            "title": "Spreadsheet Structure and Layout Planning",
            "paragraphs": [
                "The first important training area was understanding how a sheet should be structured before entering data. Good spreadsheet work begins with proper column planning, heading design, grouping of related values, and leaving enough clarity for later calculation and review. This part of the training improved awareness of how a register should be built systematically rather than randomly."
            ],
        },
        {
            "title": "Excel Formulas and Validation",
            "paragraphs": [
                "Another important training area was the use of formulas and validation logic in spreadsheets. Totals, differences, balances, subtotals, and repeated monthly values had to be calculated correctly. This improved understanding of how formula-based spreadsheets reduce manual calculation effort while still requiring careful checking."
            ],
        },
        {
            "title": "Formatting for Official Records",
            "paragraphs": [
                "The training also focused on preparing clean, readable, and print-friendly sheets. This included table borders, heading emphasis, merged title rows, alignment, page layout preparation, and sheet organization for printing or submission. Such formatting practice made the spreadsheet work more professional and more suitable for official use."
            ],
        },
    ],
    "modules": [
        {
            "name": "Student-wise Bill Register Preparation in Excel",
            "frontend": ["Monthly student bill sheet", "Student-wise food and charge register", "Summary worksheet"],
            "backend": ["Excel formulas", "Lookup and total rows", "Cross-check sheets"],
            "focus": "Manual preparation of monthly student-wise bill registers and total calculations",
            "overview": [
                "A major part of the training involved preparing student-wise bill registers in Microsoft Excel. This work required entering hostel resident details, monthly values, item-wise charges, common establishment-related fields, and final total columns in a clear tabular format. The training demonstrated how a monthly register can be prepared manually while maintaining consistency across many rows of student entries.",
                "Particular emphasis was given to sheet planning and repeated value handling. Columns had to be arranged properly so that item names, totals, fine values, and summary details could be read easily. Since the register covered multiple students, accuracy in carrying formulas downward and checking row-wise totals became a very important part of the manual work.",
                "This activity was especially useful because it showed how spreadsheet-based billing support demands both numerical accuracy and layout discipline. It was not enough to calculate values alone; the final register also needed to remain neat, readable, and suitable for later review or printing.",
            ],
            "tasks": [
                "Prepared student-wise rows with separate columns for recurring bill components and additional item amounts.",
                "Used totals and difference calculations to obtain final payable amounts for each student.",
                "Checked repeated formulas across multiple rows to avoid copy errors and missing values.",
                "Aligned headings, totals, and print layout so that the final sheet could be used as an official register.",
                "Reviewed student count, monthly totals, and fine-related entries before finalizing the sheet.",
            ],
            "outcomes": [
                "This training area improved confidence in creating monthly registers manually in a structured spreadsheet format.",
                "It also strengthened care in row-wise calculation checking, total verification, and preparation of print-ready official-looking records.",
            ],
            "files": [
                {"layer": "Worksheet Type", "files": "Monthly bill register, student-wise summary sheet, grand total sheet", "relevance": "Used to practice structured preparation of recurring registers"},
                {"layer": "Excel Features", "files": "SUM formulas, repeated row formulas, alignment, borders, merged title rows", "relevance": "Used to maintain accuracy and readability"},
                {"layer": "Output Use", "files": "Print-ready register and month-end bill statement", "relevance": "Used to support administrative review and documentation"},
            ],
        },
        {
            "name": "Reimbursement and Claim Statement Preparation in Excel",
            "frontend": ["Claim statement sheet", "Difference calculation sheet", "Pre-receipt support sheet"],
            "backend": ["Formula columns", "Difference and balance calculations", "Structured summary rows"],
            "focus": "Preparation of claim-oriented and reimbursement-oriented Excel statements",
            "overview": [
                "Another important area of manual training involved preparing reimbursement and claim-related statements in Excel. These sheets required careful handling of period data, student details, bill amount columns, sanctioned amount fields, difference amount calculations, and remaining balance values. The work was useful because it introduced a more summary-oriented spreadsheet pattern than the regular bill register.",
                "Claim sheets required greater care in balancing one value against another. Instead of only preparing a total column, the work required comparison-based fields such as amount sanctioned, amount claimed, payable difference, and remaining balance. This made the sheet design more logic-driven and improved understanding of reconciliation-oriented spreadsheet work.",
                "The training also emphasized the importance of preparing supporting documents such as pre-receipt sheets and claim statements in a clean and traceable format. Such work helped build familiarity with statement preparation that is suitable for office review, documentation, and printing.",
            ],
            "tasks": [
                "Prepared student-wise claim sheets with period, bill amount, sanctioned amount, claim amount, and balance columns.",
                "Verified difference values manually and through formulas to ensure proper reconciliation.",
                "Created structured tables that could be used later as supporting documents for official submission.",
                "Maintained neat formatting so that the statements remained readable and easy to cross-check.",
            ],
            "outcomes": [
                "This training area improved understanding of spreadsheet-based reconciliation and difference-oriented statement preparation.",
                "It also developed better skill in producing formal-looking summary sheets for administrative and reimbursement support work.",
            ],
            "files": [
                {"layer": "Worksheet Type", "files": "Claim statement sheet, reconciliation sheet, pre-receipt support sheet", "relevance": "Used to practice claim-related statement preparation"},
                {"layer": "Excel Features", "files": "Difference formulas, balance columns, formatted tables, summary rows", "relevance": "Used to support accurate comparison and reconciliation"},
                {"layer": "Output Use", "files": "Print-ready reimbursement support statements", "relevance": "Used for administrative verification and documentation"},
            ],
        },
        {
            "name": "Excel Validation, Reconciliation, and Report Formatting",
            "frontend": ["Cross-check sheet", "Verification columns", "Final print layout sheet"],
            "backend": ["Manual comparison steps", "Formula review", "Page setup and header alignment"],
            "focus": "Validation of entries, reconciliation of totals, and preparation of final printable Excel outputs",
            "overview": [
                "The third major training area involved validation and correction of spreadsheet data along with final formatting work. Once the entries and calculations were prepared, the next task was to ensure that all totals, row values, period labels, and summary lines were correct. This part of the training showed that spreadsheet work is not complete after data entry; it also requires verification and clean presentation.",
                "The reconciliation process involved checking whether row totals matched expected values, whether repeated formulas were copied properly, and whether printed outputs reflected the same structure as the working sheet. This was a valuable training area because small spreadsheet errors can affect the final register significantly if not caught early.",
                "Formatting work included adjusting titles, borders, column width, alignment, spacing, and page layout. This improved the ability to prepare spreadsheets that are not only accurate but also professional in appearance and suitable for official use.",
            ],
            "tasks": [
                "Checked row totals, grand totals, and repeated formulas for calculation consistency.",
                "Verified student records and period labels to reduce duplication or mismatch errors.",
                "Applied borders, headings, alignment, and sheet layout improvements for neat presentation.",
                "Prepared print area and page setup so that reports could be taken in a formal document style.",
                "Performed manual reconciliation between working values and final statement output before completion.",
            ],
            "outcomes": [
                "This part of the training improved accuracy checking habits and strengthened the discipline required in manual spreadsheet work.",
                "It also improved skill in converting working sheets into presentable official records suitable for review and printing.",
            ],
            "files": [
                {"layer": "Worksheet Type", "files": "Verification sheet, corrected master sheet, final print sheet", "relevance": "Used to study review and correction stages"},
                {"layer": "Excel Features", "files": "Formula recheck, page layout, print setup, borders, alignment, headings", "relevance": "Used to improve reliability and official presentation"},
                {"layer": "Output Use", "files": "Final reviewed statement or register", "relevance": "Used as the final administrative output after reconciliation"},
            ],
        },
    ],
    "integration": [
        "The manual spreadsheet work covered in this report followed a natural sequence from initial data entry to final document preparation. Student-wise billing sheets created the foundation, claim-oriented and reimbursement-oriented statements added comparison and balance logic, and validation plus formatting work ensured that the final outputs remained correct and presentable.",
        "These activities are closely connected because one sheet often supports the preparation of another. A student-wise register may feed a summary statement, and a reimbursement sheet may depend on earlier values already prepared in a billing sheet. This interdependence made the training useful for understanding how spreadsheet workflows build step by step through careful manual work.",
    ],
    "integration_map": [
        {"step": "Data entry and row preparation", "primary": "Bill Register Preparation", "connected": "Validation and Formatting", "reason": "Accurate entry is required before review and presentation can happen"},
        {"step": "Difference and balance calculation", "primary": "Claim Statement Preparation", "connected": "Bill Register Preparation", "reason": "Claim-related sheets depend on correctly prepared base values"},
        {"step": "Cross-check and correction", "primary": "Validation and Reconciliation", "connected": "All Excel worksheets", "reason": "Every sheet requires verification before final use"},
        {"step": "Print-ready statement creation", "primary": "Report Formatting", "connected": "Registers and summary sheets", "reason": "Administrative sheets must be clear, readable, and suitable for official records"},
    ],
    "weeks": [
        {"week": "1", "focus": "Excel sheet layout planning", "task": "Learned heading structure, row planning, and column arrangement", "outcome": "Built foundation for organized spreadsheet work"},
        {"week": "2", "focus": "Student-wise bill register preparation", "task": "Prepared monthly tabular bill sheets", "outcome": "Understood register design and repeated row handling"},
        {"week": "3", "focus": "Formula use and total calculation", "task": "Applied totals and verified payable amount calculations", "outcome": "Improved accuracy in formula-based spreadsheet work"},
        {"week": "4", "focus": "Claim and reimbursement sheet practice", "task": "Prepared difference and balance-oriented summary statements", "outcome": "Learned reconciliation-based spreadsheet logic"},
        {"week": "5", "focus": "Validation and correction", "task": "Checked repeated formulas and corrected layout or value errors", "outcome": "Developed stronger verification habits"},
        {"week": "6", "focus": "Formatting and print preparation", "task": "Applied borders, alignment, titles, and page setup", "outcome": "Improved ability to create official-looking documents"},
        {"week": "7", "focus": "Cross-sheet comparison", "task": "Compared registers with claim sheets and summary statements", "outcome": "Understood interdependence between spreadsheet outputs"},
        {"week": "8", "focus": "Final review and documentation", "task": "Prepared clean, print-ready final sheets and notes", "outcome": "Strengthened confidence in complete spreadsheet workflow handling"},
    ],
    "week_reflections": [
        "The week-wise progression helped show that spreadsheet-based office work is not a single-step task. It moves through planning, entry, calculation, checking, correction, and formatting before a reliable output is produced.",
        "A major insight from the training was that manual Excel work requires discipline similar to formal administrative documentation. Even a small formula or alignment mistake can affect the usefulness of the final sheet, so careful review is essential at every stage.",
    ],
    "skills": [
        {
            "title": "Technical Skills",
            "bullets": [
                "Improved understanding of spreadsheet layout planning for institutional records",
                "Better skill in formula-based total calculation, difference handling, and balance checking",
                "Greater confidence in preparing print-ready monthly registers and claim statements",
            ],
            "paragraphs": [
                "The training developed practical Excel skills beyond simple typing and table creation. It improved awareness of how structured spreadsheet work supports recurring administrative records and financial support sheets in a disciplined office environment."
            ],
        },
        {
            "title": "Tools and Software",
            "bullets": [
                "Microsoft Excel for data entry, formula handling, sorting, filtering, and formatting",
                "Page layout and print setup tools for preparing formal statements",
                "Worksheet review methods for correction and reconciliation",
            ],
            "paragraphs": [
                "Regular use of Excel during the training period improved confidence in using spreadsheet tools for practical administrative work instead of only academic exercises."
            ],
        },
        {
            "title": "Soft Skills",
            "bullets": [
                "Improved patience while checking repeated rows and formulas",
                "Better attention to detail in manual calculations and formatting",
                "Stronger habit of verifying outputs before final submission or printing",
            ],
            "paragraphs": [],
        },
    ],
    "industry_practices": [
        "This training highlighted an important administrative reality: many institutions still depend heavily on structured spreadsheet work for day-to-day records, monthly statements, and office documentation. Therefore, Excel skills remain highly relevant for practical workplace tasks.",
        "Another key observation was that manual sheets require careful consistency because they often become the base for printing, sharing, or internal verification. This made the training useful for understanding how accuracy, formatting, and discipline contribute directly to the quality of institutional documentation.",
    ],
    "challenges": [
        "One challenge during the training was maintaining accuracy while working with repeated rows and multiple columns of values. When similar formulas are copied across many student entries, even a small error in one row can affect the correctness of the final register.",
        "Another challenge was preparing sheets that were not only numerically correct but also properly formatted for official presentation. This required balancing calculation accuracy with alignment, spacing, title structure, and print layout quality.",
        "Difference-based and reimbursement-oriented sheets also created challenges because they required comparison between multiple value columns rather than only simple total calculations. These challenges were addressed through repeated checking, row-wise verification, and correction before final output preparation.",
    ],
    "key_learnings": [
        "Manual Excel work becomes more reliable when sheet structure is planned before data entry begins.",
        "Formula use reduces repetitive effort, but it must always be combined with careful verification.",
        "A good spreadsheet should be both accurate in calculation and clean in official presentation.",
        "Cross-checking and reconciliation are essential parts of administrative spreadsheet work.",
    ],
    "self_assessment": [
        "The training period improved confidence in handling spreadsheet-based administrative tasks such as bill register preparation, statement formatting, difference calculation, and output verification. It also created a more practical understanding of how office records are managed through careful Excel work.",
        "Further improvement is still needed in advanced Excel tools such as pivot-based analysis, deeper conditional formatting strategies, and larger automation methods. However, the present training has built a strong foundation in manual spreadsheet organization, reconciliation, and official statement preparation.",
    ],
    "assessment_table": [
        {"area": "Register preparation", "level": "Strong working understanding", "future": "Improve speed and large-sheet handling"},
        {"area": "Formula-based calculations", "level": "Good practical clarity", "future": "Learn more advanced formula techniques"},
        {"area": "Claim and reimbursement sheets", "level": "Good conceptual understanding", "future": "Strengthen complex reconciliation methods"},
        {"area": "Formatting and print setup", "level": "Comfortable with practical output preparation", "future": "Improve professional sheet design and automation"},
    ],
    "conclusion": [
        "The training activities documented in this report provided meaningful practical exposure to Microsoft Excel as a tool for hostel administrative records, billing support, statement preparation, and manual reconciliation. Through repeated spreadsheet exercises, the training improved both calculation accuracy and presentation discipline.",
        "The overall experience also showed that manual spreadsheet work continues to be a valuable skill in administrative environments. Preparing clean registers, summary sheets, claim statements, and print-ready reports required care, consistency, and verification at every stage. These outcomes make the training highly relevant for future office, financial-assistance, and documentation-related work.",
    ],
    "appendix_items": [
        "Screenshot of Excel sheet layout planning for student-wise bill register",
        "Screenshot of heading structure and column arrangement in a monthly register",
        "Screenshot of formula-based total calculation in Excel",
        "Screenshot of repeated row formula checking exercise",
        "Screenshot of student-wise bill preparation worksheet",
        "Screenshot of summary total and grand total verification in Excel",
        "Screenshot of claim statement preparation sheet",
        "Screenshot of difference amount and balance calculation sheet",
        "Screenshot of reimbursement support statement formatting activity",
        "Screenshot of cross-check sheet used for verification",
        "Screenshot of corrected worksheet after formula or entry review",
        "Screenshot of sorting or filtering used during data checking",
        "Screenshot of borders, titles, and formatting applied to Excel register",
        "Screenshot of page setup and print area preparation in Excel",
        "Screenshot of print preview for a formatted administrative statement",
        "Screenshot of row-wise comparison between register and summary statement",
        "Screenshot of validation checklist prepared during spreadsheet review",
        "Screenshot of final reviewed print-ready Excel output",
        "Screenshot of student-wise bill register workflow sequence mapping exercise",
        "Screenshot of spreadsheet validation checklist used during training",
        "Screenshot of worksheet integration observation notes",
        "Screenshot of formula review activity for manual reconciliation",
        "Screenshot of sheet structure or schema planning notes",
        "Screenshot of UI-like formatting practice inside Excel sheet",
        "Screenshot of testing or verification exercise for the prepared register",
        "Screenshot of final revision checklist prepared during training",
    ],
    "appendix_notes": [
        "All screenshots in this appendix should relate only to manual Microsoft Excel work carried out during the training period.",
        "Project screenshots, software module screens, or application interfaces should not be included in this training report.",
        "Each figure may be described briefly with the Excel activity performed, such as formula checking, statement preparation, formatting, or print setup.",
    ],
    "support_items": [
        {"material": "Bill register worksheet screenshot", "purpose": "Shows student-wise manual register preparation activity"},
        {"material": "Claim statement worksheet screenshot", "purpose": "Represents reimbursement and difference-based spreadsheet work"},
        {"material": "Validation or correction sheet screenshot", "purpose": "Shows checking and reconciliation practices"},
        {"material": "Print preview screenshot", "purpose": "Demonstrates official presentation and page setup preparation"},
        {"material": "Training checklist or notes screenshot", "purpose": "Documents structured learning and revision work"},
    ],
}


def main():
    out_path = build_report(member_data)
    print(out_path)


if __name__ == "__main__":
    main()
