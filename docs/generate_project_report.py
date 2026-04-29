from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


TITLE = "FinTrix: Web-Based Hostel Management System"
OUT = Path("docs/FinTrix_Project_Report.docx")
ASSET_DIR = Path("docs/report_assets")

REFERENCES = [
    "[1] J. Oyeniyi, \"Development of Web-Based Hostel Management System,\" British Journal of Computer, Networking and Information Technology, vol. 8, no. 1, pp. 30-41, 2025.",
    "[2] D. Narkhede, R. Bamgude, M. Sonawane, and M. Shevade, \"Hostel Management System (HMS),\" International Journal for Research in Applied Science & Engineering Technology, vol. 10, issue IV, 2022.",
    "[3] A. Pawar, V. Ukarande, S. Kale, P. Kshirsagar, S. G. Ekdante, and J. M. Shaikh, \"Hostel Management System,\" International Journal of Recent Research in Mathematics Computer Science and Information Technology, vol. 12, issue 1, pp. 47-56, 2025.",
    "[4] Dinesh B., Gogul Nithin R., Pavatharani R., Sneha R., and C. Senthilkumar, \"Implementation of Hostel Management with Automation Using Design Thinking,\" IJCRT, vol. 10, issue 4, 2022.",
    "[5] A. M. Diyaolu, O. B. Abodunrin, A. A. Adedamola, R. S. Ogunode, and O. Omoloba, \"Development of an E-Based Hostel Management System,\" International Journal of Innovative Science and Research Technology, vol. 9, issue 6, 2024.",
    "[6] Aravinth M., Nithin K., and J. Kayalvizhi, \"Automated Hostel Management System,\" International Journal of Scientific Research & Engineering Trends, vol. 11, issue 1, 2025.",
    "[7] R. K. Bista, A. J. Karki, B. V. M. Reddy, U. Aakash, R. A. Makaram, and S. Das, \"Hostel Management System,\" International Journal of Trend in Scientific Research and Development, vol. 2, issue 4, 2018.",
    "[8] T. Sai Prasad Reddy, S. Jayakrishna, I. Vasu, N. Leela Siddhiswar, and G. Raviteja, \"Hostel Management System,\" Journal of Emerging Technologies and Innovative Research, vol. 13, issue 4, 2026.",
    "[9] Likhin S. and Shashidhar Kini K., \"Hostel Management System,\" Journal of Emerging Technologies and Innovative Research, vol. 12, issue 7, 2025.",
]


def set_run_font(run, size=12, bold=False, italic=False, color="000000", name="Times New Roman"):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)
    r_pr = run._element.get_or_add_rPr()
    r_fonts = r_pr.rFonts
    r_fonts.set(qn("w:ascii"), name)
    r_fonts.set(qn("w:hAnsi"), name)


def style_doc(doc):
    section = doc.sections[0]
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1.15)
    section.right_margin = Inches(1.0)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(12)

    for sec in doc.sections:
        footer = sec.footer.paragraphs[0]
        footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in footer.runs:
            run.text = ""


def para(doc, text="", align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_indent=True, after=8, before=0):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.line_spacing = 1.15
    if first_indent:
        p.paragraph_format.first_line_indent = Inches(0.3)
    if text:
        run = p.add_run(text)
        set_run_font(run)
    return p


def add_text(p, text, **kwargs):
    run = p.add_run(text)
    set_run_font(run, **kwargs)
    return run


def centered(doc, text, size=14, bold=False, italic=False, after=6, before=0):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.space_before = Pt(before)
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold, italic=italic)
    return p


def chapter(doc, no, title):
    doc.add_page_break()
    centered(doc, f"CHAPTER {no}", size=14, bold=True, after=10, before=12)
    centered(doc, title, size=16, bold=True, after=16)


def section_head(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(text)
    set_run_font(run, size=14, bold=True)


def sub_head(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    set_run_font(run, size=12, bold=True)


def bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    set_run_font(run)


def image_caption(doc, path, caption, width=6.0):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(path), width=Inches(width))
    cp = doc.add_paragraph()
    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cp.paragraph_format.space_after = Pt(10)
    run = cp.add_run(caption)
    set_run_font(run, size=11, italic=True)


def simple_table(doc, rows):
    table = doc.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    table.autofit = True
    for left, right in rows:
        cells = table.add_row().cells
        cells[0].text = ""
        cells[1].text = ""
        r1 = cells[0].paragraphs[0].add_run(left)
        r2 = cells[1].paragraphs[0].add_run(right)
        set_run_font(r1, bold=True, size=11)
        set_run_font(r2, size=11)
    doc.add_paragraph()


def code_block(doc, lines):
    for line in lines:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.5)
        p.paragraph_format.space_after = Pt(2)
        run = p.add_run(line)
        set_run_font(run, size=10.5, name="Courier New")


def cover_page(doc):
    centered(doc, "PROJECT FINAL REPORT", size=16, bold=True, after=18, before=18)
    centered(doc, "On", size=14, after=8)
    centered(doc, f"“{TITLE}”", size=18, bold=True, after=18)
    centered(doc, "Bachelor of Computer Applications", size=14, bold=True, after=8)
    centered(doc, "Submitted in partial fulfillment of the requirements for the award of the degree", size=12, after=8)
    centered(doc, "of", size=12, after=6)
    centered(doc, "BACHELOR OF COMPUTER APPLICATIONS", size=14, bold=True, after=16)
    centered(doc, "Prepared for academic and documentation purposes", size=12, italic=True, after=18)
    centered(doc, "Prepared By", size=12, bold=True, after=6)
    centered(doc, "______________________________", size=12, after=4)
    centered(doc, "Student Name / USN", size=12, italic=True, after=20)
    centered(doc, "Under the Guidance of", size=12, bold=True, after=6)
    centered(doc, "______________________________", size=12, after=4)
    centered(doc, "Project Guide", size=12, italic=True, after=26)
    centered(doc, "DEPARTMENT OF COMPUTER APPLICATIONS", size=14, bold=True, after=6)
    centered(doc, "KLE TECHNOLOGICAL UNIVERSITY", size=14, bold=True, after=4)
    centered(doc, "Vidyanagar, Hubballi - 580031, Karnataka", size=12, after=4)
    centered(doc, "Academic Year 2025 - 2026", size=12, after=12)


def certificate_page(doc):
    doc.add_page_break()
    centered(doc, "CERTIFICATE", size=16, bold=True, after=18)
    para(
        doc,
        f"This is to certify that the project report entitled “{TITLE}” is a bonafide record of work carried out as part of the Bachelor of Computer Applications programme. The report has been prepared with reference to the implemented FinTrix MERN application and with support from current hostel management literature. It satisfies the expected academic structure for a final project report and is submitted for evaluation during the academic year 2025-2026.",
    )
    para(
        doc,
        "The work presented in this document is intended as a project report template aligned to institutional submission practice. Student name, university seat number, guide name, and internal evaluation signatures may be updated before final submission.",
    )
    doc.add_paragraph()
    simple_table(
        doc,
        [
            ("Project Guide", "______________________________"),
            ("Project Coordinator", "______________________________"),
            ("Head of Department", "______________________________"),
            ("External Examiner", "______________________________"),
        ],
    )


def acknowledgement_page(doc):
    doc.add_page_break()
    centered(doc, "ACKNOWLEDGEMENT", size=16, bold=True, after=18)
    para(
        doc,
        "The completion of this project report is the result of guidance, encouragement, and constructive feedback from many people who supported the development of the FinTrix system. We express our sincere gratitude to our project guide for continuous mentoring, valuable suggestions, and technical direction during the design and documentation of the project.",
    )
    para(
        doc,
        "We are grateful to the faculty members of the Department of Computer Applications for providing the academic environment necessary to understand software engineering practice, full-stack development, and project structuring. Their lectures, reviews, and practical insights were essential in transforming a problem statement into a complete hostel management solution.",
    )
    para(
        doc,
        "We also thank the institution for the infrastructure, learning resources, and encouragement required to carry out this work. Finally, we acknowledge our family members, classmates, and well-wishers whose motivation and cooperation helped us complete both the implementation and the report in a disciplined manner.",
    )


def toc_page(doc):
    doc.add_page_break()
    centered(doc, "Table of Contents", size=16, bold=True, after=18)
    toc_lines = [
        "Abstract",
        "Chapter 1  Introduction",
        "1.1  Literature Review / Survey",
        "1.2  Challenges / Motivation",
        "1.3  Objectives of the Project",
        "1.4  Problem Definition",
        "Chapter 2  Proposed System",
        "2.1  Description of Proposed System with Simple Block Diagram",
        "2.2  Description of Target Users",
        "2.3  Advantages / Applications of the Proposed System",
        "2.4  Scope",
        "Chapter 3  Software Requirement Specification",
        "3.1  Overview of SRS",
        "3.2  Requirement Specifications",
        "3.3  Use Cases and Scenarios",
        "3.4  Software and Hardware Requirement Specifications",
        "3.5  GUI Navigation",
        "3.6  Acceptance Test Plan",
        "Chapter 4  System Design",
        "4.1  Architecture of the System",
        "4.2  DFD and Detailed Data Flow",
        "4.3  Class Diagram",
        "4.4  Sequence Diagram",
        "4.5  ER Diagram and Schema",
        "4.6  State Transition Diagram",
        "4.7  Data Structures Used",
        "Chapter 5  Implementation",
        "Chapter 6  Testing",
        "Chapter 7  Results and Discussions",
        "Chapter 8  Conclusion and Future Scope",
        "Chapter 9  References / Bibliography",
    ]
    for line in toc_lines:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        run = p.add_run(line)
        set_run_font(run, size=12)


def abstract_page(doc):
    doc.add_page_break()
    centered(doc, "ABSTRACT", size=16, bold=True, after=18)
    abstract_paras = [
        "FinTrix is a web-based hostel management system designed to digitize academic hostel administration and monthly finance management in institutions where paper records, spreadsheets, and manually maintained ledgers continue to slow down operations. The system combines student registration, hostel records, expense collection, consumption tracking, bill generation, payment updates, EBL handling, analytics, report approvals, and notification support in one full-stack application. The implemented software uses React and Vite for the frontend, Node.js with Express for the service layer, and MongoDB with Mongoose for persistent data storage.",
        "The motivation for FinTrix emerges directly from the recurring issues reported in hostel management literature: slow information retrieval, limited transparency, billing inaccuracies, weak record coordination, and difficulty in generating timely summaries for administrators [1], [2], [5]. Existing systems discussed in recent studies establish the need for digital hostel operations, yet many of them remain broad in description and do not sufficiently address fine-grained operational finance such as monthly mess billing, expense snapshots, charge tracking, manual and dynamic fines, scholarship-linked payment handling, and workflow-driven reporting [3], [6], [9].",
        "The proposed FinTrix architecture is role based. Students access personal bills, payment information, EBL summaries, and notifications. Caretakers manage expenses, hostel expenses, consumption entries, guest charges, advances, bills, and reports. Administrators, wardens, and deans oversee approvals, users, hostels, and analytics. Core business logic is implemented through modular controllers, domain services, scheduled jobs, and validation middleware. The system also includes route guarding, report snapshot generation, cron-based bill creation, PDF outputs, and API documentation support.",
        "The completed project demonstrates that a hostel management solution can be both operationally practical and academically well structured when software engineering principles are combined with domain-aware billing rules. The expected institutional benefits include better accuracy, faster decision making, reduced clerical effort, stronger auditability, improved student visibility into dues, and an extendable base for future modules such as complaint handling, mobile access, room allocation optimization, and payment gateway integration.",
    ]
    for text in abstract_paras:
        para(doc, text)


def chapter_one(doc):
    chapter(doc, 1, "Introduction")
    section_head(doc, "1.1  Literature Review / Survey")
    texts = [
        "Hostel management has steadily evolved from manual registers and ledger books toward digital systems that centralize resident records, room allocation, and fee handling. Oyeniyi presents a web-based hostel management system as a means to streamline registration, room allocation, maintenance, and reporting, emphasizing the importance of real-time administrative information [1]. This work is valuable because it frames hostel management as a decision-support problem, not merely a data-entry exercise. That framing aligns with FinTrix, which goes beyond record keeping by integrating analytics, report approval, and billing traceability.",
        "Narkhede et al. describe hostel management software as a response to increasing institutional hostel populations and the burden placed on staff by manual processes [2]. Their report highlights efficiency, user friendliness, and the need to reduce repetitive administrative effort. Pawar et al. reinforce the same point and note that web-oriented administration reduces operational strain and enables better service quality [3]. These papers collectively justify the transition from fragmented record keeping to browser-accessible systems in which hostel staff can retrieve information quickly and maintain updated records consistently.",
        "Dinesh and co-authors discuss hostel automation through a design-thinking perspective and argue that digital solutions should respond directly to user pain points such as repetitive work, slow verification, and poor visibility into operational status [4]. Diyaolu et al. similarly emphasize improved access to information and better service delivery in e-based hostel systems [5]. These studies inform FinTrix's multi-role structure because the needs of students, caretakers, and administrators differ, and each role benefits from focused screens and workflow-specific actions.",
        "More recent literature continues to prioritize automation, billing support, and centralized governance. Aravinth et al. emphasize automated registration, room handling, and mess management [6], while Bista et al. and later JETIR publications describe hostel systems as tools for modernizing routine institutional administration [7], [8], [9]. However, a recurring gap across many surveyed works is the limited depth devoted to financial subflows such as monthly charge distribution, hostel expense balancing, payment auditability, scholarship-linked exceptions, and approval-oriented reporting. FinTrix is designed specifically to address that gap by combining hostel operations with structured monthly finance workflows.",
    ]
    for t in texts:
        para(doc, t)

    section_head(doc, "1.2  Challenges / Motivation")
    challenges = [
        "A hostel environment generates a large amount of interrelated information every month: student status, hostel assignments, attendance-linked consumption, mess expenses, additional charges, due dates, payments, scholarship cases, and reports for higher authorities. The first challenge is that these data points are usually handled by different people at different times, which leads to inconsistencies if there is no centralized system.",
        "The second challenge lies in fair and transparent billing. Mess charges, labour components, bakery totals, utilities, additional student charges, guest expenses, and absence deductions must all be reconciled before a valid monthly bill can be generated. Manual methods make these calculations slow and error prone, especially when hostels have different headcounts or when some students qualify for exceptional schemes such as EBL.",
        "A third challenge concerns workflow governance. In practical hostel administration, generating a number is not enough; it must be reviewable, explainable, and approvable. FinTrix is motivated by the need for reports that capture snapshots of monthly totals, allow status transitions such as draft, submitted, or warden approved, and preserve a traceable operational history. This is especially important in institutional contexts where multiple roles share oversight responsibility.",
        "The overall motivation behind FinTrix is therefore to build a solution that treats hostel management as an operational ecosystem rather than a single CRUD application. The project is designed to reduce administrative friction, improve trust in billing, and give students and staff better access to timely, role-specific information.",
    ]
    for t in challenges:
        para(doc, t)

    section_head(doc, "1.3  Objectives of the Project")
    objectives = [
        "To design and implement a complete MERN-based hostel management platform that supports operational, financial, and supervisory workflows.",
        "To reduce manual paperwork, duplicated record keeping, and billing ambiguity in monthly hostel administration.",
        "To provide separate interfaces and permissions for students, caretakers, wardens, deans, and administrators.",
        "To automate expense-aware monthly mess bill generation using reusable services and scheduled execution support.",
        "To maintain transparency through downloadable reports, bill breakdowns, payment data, and approval-oriented snapshots.",
        "To support extensibility for future institutional features such as complaint handling, room allocation automation, and online payment integration.",
    ]
    for item in objectives:
        bullet(doc, item)

    section_head(doc, "1.4  Problem Definition")
    paras = [
        "Most hostel offices still manage a mixture of resident records, monthly consumption details, expense sheets, and payment updates using handwritten registers or disconnected spreadsheets. This causes data duplication, late updates, inconsistent calculations, and repeated effort whenever administrators need reports or students request clarification about dues.",
        "The problem becomes more severe in systems where charges are not uniform for every student. Absence deductions, manual fines, guest event costs, hostel-specific expenses, late fine accrual, scholarship-assisted billing, and due-date revisions all require business rules that are difficult to maintain reliably without software support. Existing approaches often lack traceability, role separation, and automated reconciliation across related entities.",
        "FinTrix addresses the defined problem by proposing and implementing a role-based web platform that unifies student registration, hostel records, expense collection, billing, payment tracking, scholarship-linked exceptions, analytics, and reporting. The project aims to convert hostel management from a loosely coordinated clerical activity into a structured software-driven workflow that is transparent, auditable, and scalable.",
    ]
    for t in paras:
        para(doc, t)


def chapter_two(doc):
    chapter(doc, 2, "Proposed System")
    section_head(doc, "2.1  Description of Proposed System with Simple Block Diagram")
    paras = [
        "FinTrix is a MERN-oriented web application in which operational data flows from authenticated users to a centralized service layer and then into a MongoDB-backed data model. The frontend exposes role-based dashboards, form workflows, and reporting screens. The backend provides modular routes and controllers for authentication, hostel operations, expenses, billing, reporting, notifications, and analytics. Domain services implement calculations such as bill generation, fine computation, hostel expense reconciliation, and monthly report preparation.",
        "The system has been deliberately structured to balance day-to-day data entry with supervisory visibility. Students are consumers of finalized information such as bills, payments, and EBL status. Caretakers act as operational maintainers who enter expenses and trigger financial workflows. Administrators and wardens verify correctness at the institutional level. This distinction ensures that the proposed system reflects real-world hostel governance instead of treating all users identically.",
    ]
    for t in paras:
        para(doc, t)
    image_caption(doc, ASSET_DIR / "block_diagram.png", "Figure 2.1  Simple block diagram of the proposed FinTrix system", width=6.4)
    para(
        doc,
        "The block diagram shows the high-level flow from role-based users to the React interface, through the Express API and business logic services, and finally into the MongoDB persistence layer. This layered separation supports maintainability, testing, and future scalability.",
    )

    section_head(doc, "2.2  Description of Target Users")
    user_rows = [
        ("Students", "View personal hostel bills, payment dates, EBL summaries, notifications, and downloadable outputs."),
        ("Caretakers", "Manage hostel expenses, monthly consumption, guest charges, advances, bills, reports, and operational student records."),
        ("Wardens / Deans", "Review submitted reports, approvals, EBL claims, and operational analytics."),
        ("Administrators", "Manage hostels, users, approvals, institutional dashboards, and governance-level reporting."),
    ]
    simple_table(doc, user_rows)
    para(doc, "The target-user model is essential to the system design because each role participates in hostel management differently. FinTrix therefore uses route guards, role middleware, and dashboard segmentation to prevent confusion and to limit accidental modification of data outside a user's responsibility.")

    section_head(doc, "2.3  Advantages / Applications of the Proposed System")
    advantages = [
        "Centralized record management reduces duplication across hostel registers, spreadsheets, and report drafts.",
        "Expense-aware bill generation improves fairness and traceability in monthly student dues.",
        "Role-based access reduces operational clutter and makes the interface easier for each stakeholder.",
        "Approval workflows and report snapshots improve institutional accountability.",
        "Analytics and downloadable outputs help decision makers review hostel performance quickly.",
        "The architecture can be extended to mobile support, online payment integration, and complaint workflows.",
    ]
    for item in advantages:
        bullet(doc, item)
    para(doc, "The system is applicable to college and university hostels, semi-autonomous boarding facilities, and any educational accommodation environment that requires structured student records, periodic billing, and approval-driven reporting.")

    section_head(doc, "2.4  Scope (Boundary of Proposed System)")
    paras = [
        "The present implementation covers login and role management, student signups, hostel records, expense and hostel expense handling, consumption entry, charge management, guest charges, advances, mess bill generation, payments, EBL workflow support, analytics, notifications, and reports. The project also includes cron-driven bill scheduling and partial testing coverage for both frontend and backend workflows.",
        "The report does not claim that the current version includes biometric attendance, hostel room sensor integration, payment gateway settlement, or automated complaint redressal. Those features are left for future expansion. By keeping the project boundary focused, FinTrix remains feasible for academic implementation while still delivering a strong operational base for institutional hostel management.",
    ]
    for t in paras:
        para(doc, t)


def chapter_three(doc):
    chapter(doc, 3, "Software Requirement Specification")
    section_head(doc, "3.1  Overview of SRS")
    paras = [
        "The Software Requirement Specification defines what FinTrix must do, how it should behave under expected use, and what quality attributes it must preserve while performing hostel administration tasks. The SRS is especially important for this project because the system manages both user-facing features and rule-driven financial workflows. Therefore, requirements must cover interface behavior, data integrity, role separation, operational timing, and reporting outcomes.",
        "The SRS for FinTrix is organized around functional requirements, non-functional requirements, interaction scenarios, deployment needs, GUI flow expectations, and acceptance criteria. This structure mirrors the academic format used in the attached reference report while adapting the content to a hostel management domain rather than a machine learning pipeline.",
    ]
    for t in paras:
        para(doc, t)

    section_head(doc, "3.2  Requirement Specifications")
    sub_head(doc, "3.2.1  Functional Requirements")
    frs = [
        "The system shall allow role-based login for student, caretaker, warden, dean, and admin users.",
        "The system shall allow student signup requests and route them for review and approval.",
        "The system shall maintain hostel records and user-hostel associations.",
        "The system shall capture monthly expenses, hostel expenses, consumption records, charges, advances, guest charges, and scholarship-linked data.",
        "The system shall generate mess bills and update due dates, fines, and payable totals according to business rules.",
        "The system shall allow payment entry with idempotency support and audit-friendly handling of duplicate requests.",
        "The system shall generate monthly reports, analytics summaries, notifications, and downloadable documents.",
        "The system shall support EBL period creation, verification, reporting, and student balance settlement where applicable.",
    ]
    for item in frs:
        bullet(doc, item)

    sub_head(doc, "3.2.2  Use Case Diagrams")
    para(doc, "The primary interactions of the system are shown in the use case diagram below. The diagram groups common actions around three core actor categories: students, caretakers, and administrators or approvers.")
    image_caption(doc, ASSET_DIR / "use_case_diagram.png", "Figure 3.3.2  Primary use case diagram for FinTrix", width=6.5)

    sub_head(doc, "3.2.3  Use Case Descriptions Using Scenarios")
    scenarios = [
        [
            ("Use Case", "Student views current month bill"),
            ("Primary Actor", "Student"),
            ("Precondition", "Student is authenticated and has an active profile."),
            ("Main Flow", "Student logs in, opens the bills page, selects the relevant month, views bill amount, fine, payment status, and downloadable details."),
            ("Postcondition", "Current dues become visible to the student."),
            ("Alternative Flow", "If no bill exists for the selected month, the system displays a no-data state."),
        ],
        [
            ("Use Case", "Caretaker generates expense-linked bill data"),
            ("Primary Actor", "Caretaker"),
            ("Precondition", "Caretaker is authenticated and mapped to a hostel."),
            ("Main Flow", "Caretaker records expenses and student consumption, submits hostel expense inputs, and triggers bill generation for the target month."),
            ("Postcondition", "Mess bill records are created and available for review."),
            ("Alternative Flow", "If expense data is missing, the system blocks bill generation and returns a validation message."),
        ],
        [
            ("Use Case", "Approver reviews hostel report"),
            ("Primary Actor", "Warden / Admin"),
            ("Precondition", "Monthly report has been generated and submitted."),
            ("Main Flow", "Approver opens the report module, reviews snapshot totals and notes, then approves or sends back the report."),
            ("Postcondition", "Report status changes and the audit trail is updated."),
            ("Alternative Flow", "If report state is invalid for the requested action, approval is rejected with a message."),
        ],
    ]
    for scenario in scenarios:
        simple_table(doc, scenario)

    sub_head(doc, "3.2.4  Nonfunctional Requirements")
    nfrs = [
        "Performance: Dashboard and API operations should complete within practical interactive latency for ordinary hostel datasets.",
        "Safety: The system should prevent accidental role misuse by enforcing route and action restrictions.",
        "Security: JWT-based authentication, password hashing, request sanitization, and rate protection should reduce misuse and unauthorized access.",
        "Usability: Each role should see only the screens and actions necessary for its workflow.",
        "Reliability: Validation and centralized error handling should prevent malformed requests from silently corrupting data.",
        "Maintainability: The application should remain modular through separation of controllers, services, middleware, models, and pages.",
    ]
    for item in nfrs:
        bullet(doc, item)

    section_head(doc, "3.4  Software and Hardware Requirement Specifications")
    simple_table(
        doc,
        [
            ("Frontend Technology", "React, Vite, React Router, Zustand, TanStack React Query, Axios"),
            ("Backend Technology", "Node.js, Express.js, JWT, bcrypt, swagger-jsdoc, PDFKit"),
            ("Database", "MongoDB with Mongoose"),
            ("Testing Tools", "Vitest, Jest, Supertest"),
            ("Minimum Client Hardware", "Dual-core processor, 4 GB RAM, updated browser"),
            ("Recommended Deployment Server", "4+ cores, 8 GB RAM, managed MongoDB or Atlas deployment"),
        ],
    )

    section_head(doc, "3.5  GUI of Proposed System (Navigation from Home Screen to End Results)")
    para(doc, "The frontend is organized around a public landing and login flow, after which the authenticated user is redirected to a role-specific dashboard. Student pages focus on transparency and bill access. Caretaker pages focus on data entry and monthly operations. Admin pages focus on review, governance, and analytics.")
    image_caption(doc, ASSET_DIR / "gui_navigation.png", "Figure 3.5  GUI navigation flow of the proposed system", width=6.5)
    para(doc, "This navigation model reduces interface complexity because each user sees only the screens required for their role. It also maps directly to the route guard tests and role-based routing present in the implementation.")

    section_head(doc, "3.6  Acceptance Test Plan")
    atps = [
        "Authentication: Users should reach only the pages allowed by their role.",
        "Billing: Monthly expense and consumption data should produce valid mess bills.",
        "Payments: Duplicate payment submissions should not create duplicate records.",
        "Reports: Generated monthly reports should move correctly through draft, submitted, and approved states.",
        "EBL Handling: Scholarship-linked bills should follow claim and settlement rules before reaching paid state.",
        "Analytics and Downloads: Authorized users should be able to inspect summaries and export outputs where available.",
    ]
    for item in atps:
        bullet(doc, item)


def chapter_four(doc):
    chapter(doc, 4, "System Design")
    section_head(doc, "4.1  Architecture of the System (Explanation)")
    paras = [
        "The architecture of FinTrix follows a layered design in which the React frontend handles routing, forms, dashboard presentation, and user experience concerns, while the Express backend handles authentication, validation, domain workflows, and persistence. The data layer uses MongoDB documents to model hostels, users, students, bills, charges, reports, notifications, and payment-related entities. This separation supports maintainability and allows the system to evolve by feature domain.",
        "A notable design decision in FinTrix is the use of domain-specific controllers and services rather than placing all billing or reporting logic inside route handlers. This improves clarity because features such as monthly expense reconciliation, fine computation, report snapshots, and notifications can be reasoned about independently and tested more safely.",
    ]
    for t in paras:
        para(doc, t)
    image_caption(doc, ASSET_DIR / "block_diagram.png", "Figure 4.1  Architectural overview of FinTrix", width=6.3)

    section_head(doc, "4.1  Level 0 DFD (with Brief Explanation)")
    para(doc, "The Level 0 data flow diagram represents FinTrix as a single high-level process that receives operational inputs from students, caretakers, and administrators, interacts with persistent storage, and returns bills, reports, status data, and notifications.")
    image_caption(doc, ASSET_DIR / "dfd_level0.png", "Figure 4.1.1  Level 0 DFD of the proposed system", width=6.5)

    section_head(doc, "4.2  Detailed DFD for the Proposed System")
    para(doc, "The detailed DFD decomposes the high-level process into authentication, student and hostel records, expense and consumption workflows, billing and payments, and analytics/reporting. This decomposition reflects the actual route and controller grouping used in the Express backend.")
    image_caption(doc, ASSET_DIR / "dfd_detailed.png", "Figure 4.2  Detailed data flow diagram of FinTrix", width=6.5)
    para(doc, "The data stores shown in the diagram correspond to document groups in MongoDB. This modeling choice keeps related data clustered by domain while still allowing aggregation for analytics and reporting.")

    section_head(doc, "4.3  Class Diagram (with Brief Explanation)")
    para(doc, "The class diagram models the main backend entities and their conceptual associations. User and Student represent identity and hostel-resident details, Hostel anchors administrative grouping, MessBill captures the monthly student liability, and related payment, charge, and report entities extend the operational lifecycle.")
    image_caption(doc, ASSET_DIR / "class_diagram.png", "Figure 4.3  Simplified class diagram of the FinTrix domain model", width=6.5)

    section_head(doc, "4.4  Sequence Diagram (with Brief Explanation)")
    para(doc, "The sequence diagram below illustrates a common monthly workflow: the caretaker submits expense data, the frontend calls the backend, the billing service computes hostel-aware totals, and records are persisted before the resulting information is shown back to the user.")
    image_caption(doc, ASSET_DIR / "sequence_diagram.png", "Figure 4.4  Sequence diagram for bill generation and payment workflow", width=6.4)

    section_head(doc, "4.5  ER Diagram and Schema (if Applicable)")
    para(doc, "The ER view highlights the relational thinking behind the document schema. Although MongoDB is non-relational, the application still depends on structured references such as userId, studentId, hostelId, billId, and report ownership to preserve business meaning across modules.")
    image_caption(doc, ASSET_DIR / "er_diagram.png", "Figure 4.5  ER-oriented schema view for the proposed system", width=6.5)

    section_head(doc, "4.6  State Transition Diagram (if Applicable)")
    para(doc, "Several FinTrix workflows behave as state machines. The most visible example is the bill lifecycle, where records move from draft or generated status into pending payment, partial handling, EBL-driven claim states, and finally paid status. Modeling state transitions explicitly helps prevent invalid actions.")
    image_caption(doc, ASSET_DIR / "state_diagram.png", "Figure 4.6  State transition diagram for bill lifecycle", width=6.3)

    section_head(doc, "4.7  Data Structure Used")
    paras = [
        "The project uses JSON-like document structures through MongoDB and Mongoose schemas. These structures are well suited to operational data that may vary slightly by hostel, student status, or report month while still requiring validation and consistent query patterns.",
        "Arrays and nested objects are used in report snapshots and EBL monthly details to preserve historical context. This makes it possible to store summary data at the time a report is generated, even if source records later change.",
        "On the frontend, state is handled through a combination of local component state, Zustand-based authentication state, and React Query caches for server-sourced data. This mixture allows responsive UI updates without sacrificing centralized session management.",
    ]
    for t in paras:
        para(doc, t)


def chapter_five(doc):
    chapter(doc, 5, "Implementation")
    section_head(doc, "5.1  Proposed Methodology (Explain the Methodology with Diagram / Algorithm Explanation)")
    paras = [
        "The implementation methodology followed an iterative software engineering approach. First, the domain was broken into operational modules such as authentication, student records, expenses, billing, reporting, and analytics. Next, data structures and business rules were modeled in Mongoose schemas and services. After that, React pages and role-based navigation were aligned with each workflow. Finally, validation, testing, and report generation support were added to improve reliability.",
        "This approach was chosen because hostel management problems are rule heavy. Instead of writing a monolithic application, FinTrix isolates calculations and state transitions inside services such as billLifecycleService, hostelExpenseCalculationService, calculationService, and monthlyExpenseReportService. This makes the system easier to explain, test, and extend.",
    ]
    for t in paras:
        para(doc, t)
    sub_head(doc, "Illustrative Pseudocode for Monthly Bill Generation")
    code_block(
        doc,
        [
            "Input: hostel expense record, active students, monthly consumption, charges",
            "1. Validate hostel and month context",
            "2. Filter only active operational students",
            "3. Read monthly consumption for those students",
            "4. Compute shared mess and hostel expense components",
            "5. Apply charges, absence deduction, and special cases",
            "6. Create bill payload for each student",
            "7. Persist bill records in transaction",
            "8. Return generated bills and reporting totals",
        ],
    )

    section_head(doc, "5.2  Modules")
    para(doc, "FinTrix is implemented as cooperating modules. Each module is responsible for a coherent business area and interacts with routes, services, models, and pages that match the same domain.")

    modules = [
        (
            "Authentication and Access Control",
            "Input: username, password, token, requested route.",
            "Output: authenticated session, denied access, or role-based redirect.",
            "This module includes login flow, password hashing, JWT issuance, route guarding, and role middleware. It ensures that unauthenticated users do not reach protected pages and that users can only access workflows allowed for their role."
        ),
        (
            "Student Signup and Resident Management",
            "Input: signup requests, student profile information, hostel mapping updates.",
            "Output: approved or rejected signup state, student records available for hostel workflows.",
            "This module supports resident onboarding and student administration. It is used by caretakers and administrators to maintain the resident base that later drives expense and billing workflows."
        ),
        (
            "Expense and Hostel Expense Management",
            "Input: monthly cost components such as kirana, milk, labour, bakery, and hostel totals.",
            "Output: normalized expense snapshots, hostel expense summaries, and billable per-student values.",
            "This module is central to the project because it converts operational spending into structured monthly finance data suitable for bill generation and reporting."
        ),
        (
            "Consumption and Charge Management",
            "Input: egg, chicken, paneer, milk, absent days, fines, and charge records.",
            "Output: student-level consumption details and extra charge components.",
            "This module captures variable values that personalize monthly billing. It prevents flat or unfair billing by keeping student-specific consumption visible in the final bill."
        ),
        (
            "Bill Lifecycle and Payment Handling",
            "Input: generated monthly bills, due dates, payment dates, UTR numbers, and payment method details.",
            "Output: pending, partial, EBL-linked, or paid bill records with payable totals.",
            "The bill lifecycle module manages fine calculations, due-date updates, duplicate payment protection, and transitions toward paid status. It is one of the most business-critical modules in the system."
        ),
        (
            "EBL Workflow Module",
            "Input: scholarship months, GOI amounts, university claims, and verification actions.",
            "Output: verified EBL periods, pre-receipt reports, and settled student balances.",
            "This module handles exceptional student payment cases where a scholarship or claim process changes the normal bill settlement path."
        ),
        (
            "Reporting and Approval Module",
            "Input: monthly totals, generated snapshots, submission actions, approval notes.",
            "Output: report records with draft, submitted, or approved status.",
            "The module converts operational data into supervisory documents and ensures that reports move through institution-friendly review states."
        ),
        (
            "Analytics and Notification Module",
            "Input: expense totals, bill records, payment records, and event changes.",
            "Output: dashboards, summaries, hostel-wise insights, and user-facing notifications.",
            "This module supports monitoring and transparency by making the current state of hostel finance and operations easier to interpret."
        ),
    ]
    for name, input_line, output_line, body in modules:
        sub_head(doc, f"Module Name: {name}")
        para(doc, input_line, first_indent=False)
        para(doc, output_line, first_indent=False)
        para(doc, body)


def chapter_six(doc):
    chapter(doc, 6, "Testing")
    section_head(doc, "6.1  Test Plan and Test Cases (Tested as per Acceptance Test Plan)")
    paras = [
        "Testing in FinTrix is oriented around business risk rather than purely visual coverage. Because the application handles monthly billing, payment uniqueness, report snapshots, and scholarship-linked exceptions, tests focus on correctness of operational rules and route protection.",
        "The backend uses Jest and Supertest to validate API-level behavior, while the frontend uses Vitest and React Testing Library to confirm route-guard and state-management behavior. This combination gives the project a useful baseline of automated validation without requiring a full end-to-end browser suite.",
    ]
    for t in paras:
        para(doc, t)
    simple_table(
        doc,
        [
            ("Test Case 1", "Verify unauthenticated users are redirected away from protected routes."),
            ("Test Case 2", "Verify authenticated users can access the dashboards allowed for their role."),
            ("Test Case 3", "Verify duplicate payment submissions do not create duplicate payment records."),
            ("Test Case 4", "Verify revised absence deduction policy produces correct bill values."),
            ("Test Case 5", "Verify report generation, submission, and warden approval update status correctly."),
            ("Test Case 6", "Verify monthly expense updates resynchronize downstream reports and bills."),
            ("Test Case 7", "Verify due-date updates do not incorrectly modify paid-bill fine state."),
            ("Test Case 8", "Verify EBL period creation, verification, settlement, and reporting work correctly."),
        ],
    )
    para(doc, "Representative backend tests already implemented in the repository cover idempotent payment handling, duplicate-prevention logic, absence deduction rules, report snapshot approval flow, monthly report recalculation, bill due-date updates, manual fine preservation, student payment date update, and EBL lifecycle processing. Frontend tests validate route guards and session persistence behavior.")
    para(doc, "This testing approach is important for FinTrix because the most serious failures in a hostel management system are not aesthetic defects; they are hidden operational defects such as duplicated payments, incorrect due calculations, broken role permissions, or invalid report states.")


def chapter_seven(doc):
    chapter(doc, 7, "Results and Discussions")
    paras = [
        "The implemented FinTrix system demonstrates that a MERN-based hostel platform can successfully unify operational data entry, finance-sensitive monthly billing, and supervisory reporting inside a single application. Instead of treating each hostel activity as an isolated form, the project connects expenses, student consumption, bill generation, payments, and report snapshots into one continuous workflow.",
        "From a functional perspective, the project produces clear value in three areas. First, it improves administrative consistency by centralizing student, hostel, expense, and billing records. Second, it improves transparency by exposing bill details, payment information, and status-driven reports. Third, it improves maintainability by separating responsibilities into routes, controllers, services, models, and role-specific pages.",
        "The system also reveals the importance of domain-specific rules. Features such as dynamic late fine calculation, absence deduction policy, EBL exception handling, report status transitions, and idempotent payment entry are not generic CRUD concerns. They represent real hostel-policy logic that must be captured explicitly if the system is to be trusted in practice.",
        "A discussion of the implemented result also shows that FinTrix is stronger as an operational management platform than as a superficial dashboard application. The project contains meaningful workflow depth in billing and reporting, and that depth is precisely what differentiates it from many high-level hostel management prototypes described in literature [4], [6], [8].",
    ]
    for t in paras:
        para(doc, t)
    sub_head(doc, "Representative Result Highlights")
    highlights = [
        "Role-based route handling successfully separates student, caretaker, and admin workspaces.",
        "Monthly bill workflows incorporate shared expenses, consumption, fines, and hostel-specific logic.",
        "Payment operations are protected from duplicate record creation through idempotency handling.",
        "Reports move through structured review states that better reflect institutional approval practice.",
        "Scholarship-assisted EBL cases are modeled without forcing them into the standard payment path.",
        "Analytics and downloadable outputs make operational monitoring more accessible to administrators.",
    ]
    for item in highlights:
        bullet(doc, item)
    para(doc, "Overall, the project outcome is a practical hostel management foundation with strong academic value. It demonstrates full-stack integration, domain modeling, workflow design, and testing awareness in a way that suits both project evaluation and future real-world deployment.")


def chapter_eight(doc):
    chapter(doc, 8, "Conclusion and Future Scope")
    paras = [
        "FinTrix addresses a practical institutional need by transforming hostel administration from a fragmented clerical process into a software-supported, role-aware workflow. The project combines operational simplicity at the interface level with meaningful depth in business logic, especially in expense-aware billing, report approvals, and payment handling.",
        "The report has shown that the proposed system is supported by contemporary hostel management literature and that its design choices are consistent with real administrative problems identified in prior work [1], [3], [5]. At the same time, FinTrix extends beyond many literature examples by modeling detailed hostel finance processes such as monthly expense snapshots, idempotent payments, EBL exceptions, and structured report transitions.",
        "The implemented solution is therefore academically relevant, technically feasible, and operationally valuable. It demonstrates that a well-designed MERN application can support students, caretakers, and administrators without collapsing their workflows into a single cluttered interface.",
    ]
    for t in paras:
        para(doc, t)
    sub_head(doc, "Future Scope")
    futures = [
        "Integration with online payment gateways and automated transaction reconciliation.",
        "Room allocation and occupancy optimization features.",
        "Complaint management and maintenance ticket workflows.",
        "Mobile-first or dedicated Android application support for students and caretakers.",
        "Deeper analytics, forecasting, and hostel performance dashboards.",
        "Automatic document generation for institutional audits and year-end summaries.",
    ]
    for item in futures:
        bullet(doc, item)


def chapter_nine(doc):
    chapter(doc, 9, "References / Bibliography")
    for ref in REFERENCES:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        run = p.add_run(ref)
        set_run_font(run, size=11)


def main():
    doc = Document()
    style_doc(doc)
    cover_page(doc)
    certificate_page(doc)
    acknowledgement_page(doc)
    toc_page(doc)
    abstract_page(doc)
    chapter_one(doc)
    chapter_two(doc)
    chapter_three(doc)
    chapter_four(doc)
    chapter_five(doc)
    chapter_six(doc)
    chapter_seven(doc)
    chapter_eight(doc)
    chapter_nine(doc)
    doc.save(OUT)


if __name__ == "__main__":
    main()
