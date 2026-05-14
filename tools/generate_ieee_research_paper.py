from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt
from PIL import Image, ImageDraw, ImageFont


OUTPUT = Path(r"Z:\WORK\Extra-Projects\INTERNSHIP\Hostel-Management\FinTrix\IEEE_Research_Paper_Hostel_Management_System.docx")
ASSET_DIR = OUTPUT.parent / "paper_assets"


def set_font(run, size=10, bold=False, italic=False):
    run.font.name = "Times New Roman"
    run._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
    run._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic


def set_para_format(paragraph, before=0, after=6, line_spacing=1.0):
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line_spacing


def add_text(paragraph, text, size=10, bold=False, italic=False):
    run = paragraph.add_run(text)
    set_font(run, size=size, bold=bold, italic=italic)
    return run


def set_columns(section, count=2, space_twips=540):
    sect_pr = section._sectPr
    cols = sect_pr.xpath("./w:cols")
    if cols:
        cols = cols[0]
    else:
        cols = OxmlElement("w:cols")
        sect_pr.append(cols)
    cols.set(qn("w:num"), str(count))
    cols.set(qn("w:space"), str(space_twips))


def apply_page_setup(document):
    section = document.sections[0]
    configure_section_margins(section)
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)


def configure_section_margins(section):
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.65)
    section.right_margin = Inches(0.65)
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)


def _font(size, bold=False):
    candidates = [
        Path(r"C:\Windows\Fonts\timesbd.ttf" if bold else r"C:\Windows\Fonts\times.ttf"),
        Path(r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def _draw_centered(draw, box, text, font, fill="black"):
    bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=6)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = box[0] + (box[2] - box[0] - tw) / 2
    y = box[1] + (box[3] - box[1] - th) / 2
    draw.multiline_text((x, y), text, font=font, fill=fill, spacing=6, align="center")


def create_diagram_assets():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    arch_path = ASSET_DIR / "architecture.png"
    workflow_path = ASSET_DIR / "workflow.png"

    img = Image.new("RGB", (1100, 700), "white")
    draw = ImageDraw.Draw(img)
    title_font = _font(28, bold=True)
    header_font = _font(21, bold=True)
    body_font = _font(18)

    draw.text((235, 18), "Proposed Hostel Management System Architecture", font=title_font, fill="black")
    boxes = [
        ((90, 110, 1010, 205), "Presentation Layer", "React.js Dashboards and Pages\nStudent | Caretaker | Admin"),
        ((90, 285, 1010, 405), "Application Layer", "Express.js Routes | Controllers | Validation | Role Checks | Services"),
        ((90, 490, 1010, 635), "Data Layer", "MongoDB Models\nUsers, Students, Bills, Payments, Expenses, Charges,\nNotifications, Reports, Deposits, NOC Records"),
    ]
    fills = ["#EAF2FF", "#EEF9F0", "#FFF4E8"]
    for (box, title, body), fill in zip(boxes, fills):
        draw.rounded_rectangle(box, radius=16, outline="black", width=2, fill=fill)
        _draw_centered(draw, (box[0], box[1] + 4, box[2], box[1] + 42), title, header_font)
        _draw_centered(draw, (box[0] + 15, box[1] + 38, box[2] - 15, box[3] - 10), body, body_font)

    for y1, y2 in [(205, 285), (405, 490)]:
        draw.line((550, y1, 550, y2), fill="black", width=3)
        draw.polygon([(550, y2), (540, y2 - 14), (560, y2 - 14)], fill="black")
    img.save(arch_path)

    img = Image.new("RGB", (1100, 640), "white")
    draw = ImageDraw.Draw(img)
    title_font = _font(27, bold=True)
    box_font = _font(18, bold=True)
    note_font = _font(17)
    draw.text((360, 18), "Billing and Settlement Workflow", font=title_font, fill="black")

    steps = [
        "Monthly Bill\nGeneration",
        "Student Views\nDue Details",
        "UTR / Payment\nSubmission",
        "Caretaker\nVerification",
        "Report and\nSettlement Update",
    ]
    x_positions = [20, 230, 440, 650, 860]
    for i, (x, text) in enumerate(zip(x_positions, steps)):
        box = (x, 195, x + 180, 305)
        draw.rounded_rectangle(box, radius=14, outline="black", width=2, fill="#F4F8FF")
        _draw_centered(draw, box, text, box_font)
        if i < len(steps) - 1:
            draw.line((x + 180, 250, x_positions[i + 1], 250), fill="black", width=3)
            draw.polygon([(x_positions[i + 1], 250), (x_positions[i + 1] - 14, 240), (x_positions[i + 1] - 14, 260)], fill="black")

    note_box = (190, 390, 910, 545)
    draw.rounded_rectangle(note_box, radius=14, outline="black", width=2, fill="#FFF8E8")
    note = (
        "Supporting logic applied across the workflow:\n"
        "fine computation, remaining balance calculation,\n"
        "EBL difference adjustment, hostel deposit deduction,\n"
        "and final NOC settlement preparation."
    )
    _draw_centered(draw, note_box, note, note_font)
    img.save(workflow_path)

    return arch_path, workflow_path


def add_title_block(document):
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para_format(p, after=8)
    add_text(p, "A Web-Based Hostel Billing and Management System Using the MERN Stack", size=16, bold=True)

    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para_format(p, after=2)
    add_text(p, "Author 1, Author 2, Author 3, Author 4", size=11)

    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para_format(p, after=8)
    add_text(p, "Department / College Name, City, State, Country", size=10)

    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para_format(p, after=10)
    add_text(p, "Email: author1@example.com, author2@example.com, author3@example.com, author4@example.com", size=9)


def add_abstract_keywords(document):
    p = document.add_paragraph()
    set_para_format(p, after=4)
    add_text(p, "Abstract-", size=10, bold=True)
    add_text(
        p,
        "Hostel administration in educational institutions often depends on fragmented manual records, spreadsheet-based calculations, and delayed communication between students, caretakers, and administrators. These limitations create difficulties in managing monthly billing, expense tracking, student onboarding, approval workflows, reimbursement handling, and report preparation. This paper presents a web-based Hostel Billing and Management System developed using the MERN stack to digitize and streamline these activities through a centralized platform. The proposed system integrates role-based authentication, student signup and resident management, mess bill generation, payment handling, electricity bill claim workflows, expense and consumption tracking, charge management, approval flow, analytics, notifications, hostel deposit tracking, and NOC settlement support. The backend is implemented using Node.js, Express.js, and MongoDB, while React.js is used for the user interface. The system improves data consistency, reduces repetitive manual effort, supports report generation, and enhances transparency in administrative operations. The paper also discusses the architecture, workflow design, mathematical formulation, implementation approach, and functional outcomes of the proposed platform.",
        size=10,
    )

    p = document.add_paragraph()
    set_para_format(p, after=8)
    add_text(p, "Keywords-", size=10, bold=True)
    add_text(p, "Hostel Management System, MERN Stack, Mess Billing, Role-Based Access Control, Web Application, Administrative Automation.", size=10)


def add_heading(document, text):
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_para_format(p, before=6, after=4)
    add_text(p, text, size=10, bold=True)


def add_body(document, text):
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    set_para_format(p, after=4)
    add_text(p, text, size=10)


def add_bullet(document, text):
    p = document.add_paragraph(style="List Bullet")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    set_para_format(p, after=2)
    add_text(p, text, size=10)


def add_equation(document, expression, number):
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para_format(p, before=2, after=2)
    add_text(p, f"{expression}    ({number})", size=10, italic=True)


def add_figure(document, image_path, caption, width=Inches(2.55)):
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para_format(p, before=2, after=2)
    p.add_run().add_picture(str(image_path), width=width)
    cp = document.add_paragraph()
    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para_format(cp, after=6)
    add_text(cp, caption, size=9)


def add_full_width_figure_page(document, image_path, caption, width=Inches(6.0)):
    figure_section = document.add_section(WD_SECTION_START.NEW_PAGE)
    configure_section_margins(figure_section)
    set_columns(figure_section, count=1, space_twips=0)
    add_figure(document, image_path, caption, width=width)
    body_section = document.add_section(WD_SECTION_START.CONTINUOUS)
    configure_section_margins(body_section)
    set_columns(body_section, count=2, space_twips=540)


def build_document():
    arch_path, workflow_path = create_diagram_assets()

    document = Document()
    apply_page_setup(document)
    normal = document.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
    normal.font.size = Pt(10)

    add_title_block(document)
    add_abstract_keywords(document)

    body_section = document.add_section(WD_SECTION_START.CONTINUOUS)
    configure_section_margins(body_section)
    set_columns(body_section, count=2, space_twips=540)

    add_heading(document, "I. INTRODUCTION")
    add_body(document, "Educational institutions with hostel facilities are required to manage resident records, monthly mess billing, fee collection, expenditure tracking, electricity and reimbursement claims, approvals, reports, and communication. When these activities are handled manually through physical registers and disconnected spreadsheets, the administrative process becomes slow, repetitive, and prone to errors. Record duplication, delayed payment verification, poor visibility of balances, and difficulties in preparing official reports are common challenges in such environments.")
    add_body(document, "To address these problems, a centralized web-based Hostel Billing and Management System was designed and implemented using the MERN stack. The proposed platform provides role-based access for students, caretakers, and administrators, and offers dedicated workflows for onboarding, billing, claims, expenses, approvals, analytics, and final settlement. The system aims to improve operational efficiency, transparency, and consistency while reducing manual workload.")
    add_body(document, "The major contribution of this work is the integration of hostel-specific billing and settlement workflows into a single modular platform. In addition to regular hostel administration functions, the system addresses mess bill generation, student payment verification, electricity bill reimbursement handling, hostel deposit tracking, and NOC-based clearance, which are often handled separately in traditional environments.")

    add_heading(document, "II. LITERATURE SURVEY")
    add_body(document, "Several researchers have explored web-based hostel automation systems. Eweoya et al. [1] presented a web-based hostel management system that supports student registration, room allocation, maintenance, and reporting. Pawar et al. [2] described an online hostel management platform focused on reducing manual workload and improving database-driven administration. Dinesh et al. [3] discussed hostel management automation using design thinking with emphasis on student accommodation and record organization.")
    add_body(document, "Akorede et al. [4] developed an e-based hostel allocation platform for replacing manual file-based administration, while Aravinth et al. [5] proposed an automated hostel management system integrating attendance, room allocation, fee verification, and barcode-enabled workflow. Bista et al. [6] explored a system including mess billing, outpass generation, and complaint management. More recent works such as Reddy et al. [7] and Kini et al. [8] further demonstrated the relevance of centralized hostel platforms with controlled user access, fee collection, and reporting features.")
    add_body(document, "Although the literature establishes the importance of digital hostel administration, many existing works focus on general accommodation management, room allocation, or high-level fee handling. The present work extends the scope by integrating hostel-specific mess billing, expense distribution, electricity reimbursement support, approval workflows, analytics, notifications, and final settlement operations within a MERN-based architecture.")

    add_heading(document, "III. PROBLEM STATEMENT")
    add_body(document, "Traditional hostel administration often depends on multiple manual registers and spreadsheet sheets maintained separately for student details, monthly bills, daily collections, expenses, reimbursement support statements, and official approvals. This creates redundancy, delays, and inconsistencies. Students may not know their exact dues, caretakers may spend additional time verifying payments and compiling reports, and administrators may lack a consolidated view of current operational status.")
    add_body(document, "The key problem addressed in this work is the absence of a centralized, workflow-driven system that can manage billing and operational records together while preserving role-based responsibilities and improving transparency.")

    add_heading(document, "IV. OBJECTIVES")
    add_bullet(document, "To develop a centralized hostel billing and management platform using the MERN stack.")
    add_bullet(document, "To implement role-based access control for students, caretakers, and administrators.")
    add_bullet(document, "To support monthly mess bill generation, payment verification, and report preparation.")
    add_bullet(document, "To integrate reimbursement, expense, consumption, charge, approval, analytics, and notification workflows.")
    add_bullet(document, "To improve transparency, reduce manual effort, and strengthen administrative record consistency.")

    add_heading(document, "V. PROPOSED SYSTEM")
    add_body(document, "The proposed system is a modular web application that centralizes hostel administration and billing operations. Students can view their bills, update transaction details, submit hostel deposit information, and track final settlement records. Caretakers can manage bills, expenses, consumption values, EBL claim periods, payment marking, and report generation. Administrators can review analytics, handle approvals, monitor users, and access summary views.")
    add_body(document, "The architecture follows the MERN stack model. React.js is used to create responsive and role-specific interfaces. Node.js and Express.js implement backend logic, while MongoDB stores operational records such as student data, mess bills, expenses, charges, payments, and report states. This separation of concerns supports maintainability and modular growth.")
    add_body(document, "The major functional modules of the proposed system are authentication and access control, student signup and resident management, mess billing and payment handling, EBL and reimbursement support, expenses and consumption tracking, charge management, approvals, analytics, notifications, hostel deposit review, and NOC settlement support. Each module was designed to operate independently while sharing a common role-based data model.")

    add_heading(document, "VI. SYSTEM ARCHITECTURE")
    add_body(document, "The system follows a layered architecture. At the presentation layer, React.js pages and components render student, caretaker, and admin dashboards. At the application layer, Express.js controllers process requests, validate input, and coordinate workflow transitions. At the data layer, MongoDB models persist user records, student records, bills, expenses, consumption, charges, notifications, and settlement data.")
    add_body(document, "The architecture also includes service-style calculations for billing and fine logic, route-level access protection, and report-generation support. Such an arrangement makes it possible to manage operational complexity while preserving role-based boundaries and reusable logic.")
    add_full_width_figure_page(document, arch_path, "Fig. 1. Layered architecture of the proposed hostel billing and management system.")

    add_heading(document, "VII. MATHEMATICAL FORMULATION")
    add_body(document, "The financial workflows in the proposed system depend on a set of reusable equations for mess billing, reimbursement balancing, and settlement calculation. Let MB denote the base mess bill, AC denote the sum of additional food charges, EC denote establishment-related charges, FC denote fine, HD denote accepted hostel deposit deduction, UC denote university claim support, OB denote opening balance, TC denote total collected amount, and TE denote total expenditure.")
    add_equation(document, "TB = MB + AC + EC + FC", "1")
    add_body(document, "Equation (1) defines the total bill amount before any external adjustment. The bill is obtained by combining the monthly mess value, additional item charges, establishment-related charges, and fine when applicable.")
    add_equation(document, "RB = DP - UC", "2")
    add_body(document, "Equation (2) is applied in reimbursement-oriented workflows, where RB is the remaining balance and DP is the difference payable for a selected EBL period after deducting the university claim amount.")
    add_equation(document, "NP = TB - HD", "3")
    add_body(document, "Equation (3) models the final net payable amount during NOC or deposit-adjusted clearance, where the accepted hostel deposit is deducted from the computed bill or settlement total.")
    add_equation(document, "CB = OB + TC - TE", "4")
    add_body(document, "Equation (4) defines the closing balance of a monthly ledger. It is calculated from the opening balance, the total collected amount, and the total expenditure recorded in the selected period.")

    add_heading(document, "VIII. IMPLEMENTATION METHODOLOGY")
    add_body(document, "The implementation followed a module-wise development strategy. Foundational modules such as authentication, student signup, and resident management were addressed first because they define the user lifecycle and access rules. Billing and payment modules were then implemented to support the monthly financial workflow of the hostel. After that, expenditure-oriented modules including expenses, consumption, and charges were developed to support administrative record completeness.")
    add_body(document, "Supervisory modules such as approvals, analytics, and notifications were implemented to help administrators monitor system activity. Finally, support modules such as hostel deposit and NOC settlement were added to manage end-of-stay financial clearance. Throughout the implementation, the emphasis remained on role-based flow, consistent data validation, and usable report outputs.")

    add_heading(document, "IX. IMPLEMENTED WORKFLOWS")
    add_body(document, "The mess billing workflow supports month selection, student-wise bill preparation, total calculation, and report generation. Students can inspect billing details and update payment-related information, while caretakers can verify and mark records. The EBL workflow supports period selection, claim tracking, difference calculation, pre-receipt generation, and university claim statements.")
    add_body(document, "Expense and consumption workflows provide operational support by storing categorized values that influence administrative review and cost understanding. Reporting and approval workflows help transform raw records into supervisory outputs. Hostel deposit and NOC workflows add settlement completeness by enabling deposit review and exit-time adjustment of remaining balances.")
    add_full_width_figure_page(document, workflow_path, "Fig. 2. Operational workflow for bill generation, payment submission, verification, and settlement support.")

    add_heading(document, "X. RESULTS AND DISCUSSION")
    add_body(document, "The developed system demonstrates that role-based hostel administration can be handled more effectively through a centralized web platform than through disconnected manual registers. The implemented modules improve visibility of student dues, simplify caretaker-side payment review, reduce repetition in statement preparation, and support report generation in structured form.")
    add_body(document, "A key outcome is the integration of hostel-specific administrative processes that are usually scattered across spreadsheets and registers. The system not only stores data but also preserves workflow order, enabling students, caretakers, and administrators to interact with the same records under controlled responsibilities. This contributes to transparency and operational consistency.")
    add_body(document, "The work also confirms the relevance of modular web architecture in educational administration. By separating authentication, billing, expenses, approvals, analytics, and settlement workflows, the platform remains extensible and easier to maintain. Although the current implementation focuses on hostel billing and management, the same design can be adapted for related institutional accommodation systems.")
    add_body(document, "Compared with a manual process, the proposed system provides centralized digital storage instead of scattered registers, role-based and traceable bill verification instead of repetitive manual confirmation, integrated report generation instead of manual compilation, real-time role-based visibility instead of delayed information flow, and structured deposit/NOC handling instead of difficult manual settlement reconciliation.")

    add_heading(document, "XI. ADVANTAGES OF THE SYSTEM")
    add_bullet(document, "Reduces manual paperwork and duplicate data handling.")
    add_bullet(document, "Improves transparency in billing, payment, and claim workflows.")
    add_bullet(document, "Supports role-based responsibilities for students, caretakers, and administrators.")
    add_bullet(document, "Provides structured report, approval, and analytics support.")
    add_bullet(document, "Improves consistency in final settlement through deposit and NOC handling.")

    add_heading(document, "XII. LIMITATIONS AND FUTURE ENHANCEMENT")
    add_body(document, "The current system is oriented toward the operational needs observed in the studied hostel environment and can be expanded further. Future enhancements may include advanced analytics, mobile application support, stronger document workflow automation, payment gateway integration, and more extensive notification strategies. Further work may also explore predictive expense analysis or broader inter-hostel benchmarking dashboards.")

    add_heading(document, "XIII. CONCLUSION")
    add_body(document, "This paper presented a web-based Hostel Billing and Management System developed using the MERN stack to address the administrative and financial challenges of hostel environments. The proposed system integrates student onboarding, access control, mess billing, payment handling, reimbursement support, expense tracking, approvals, analytics, notifications, hostel deposit, and NOC settlement in a single platform.")
    add_body(document, "The implementation shows that a modular and role-based digital approach can substantially improve efficiency, transparency, and consistency over manual record handling. By combining operational workflows with report-ready outputs, the system offers a practical and scalable model for educational institutions seeking to modernize hostel administration.")

    add_heading(document, "REFERENCES")
    references = [
        '[1] I. Eweoya, A. Awoniyi, O. Adeniyi, K. Okesola, A. Udosen, T. Adigun, O. Fatade, and A. Amusa, "Development of Web-Based Hostel Management System," British Journal of Computer, Networking and Information Technology, vol. 8, no. 1, pp. 30-41, 2025.',
        '[2] A. Pawar, V. Ukarande, S. Kale, P. Kshirsagar, S. G. Ekdante, and J. M. Shaikh, "Hostel Management System," International Journal of Recent Research in Mathematics Computer Science and Information Technology, vol. 12, no. 1, pp. 47-56, 2025.',
        '[3] B. Dinesh, R. Gogul Nithin, R. Pavatharani, R. Sneha, and C. Senthilkumar, "Implementation of Hostel Management with Automation Using Design Thinking," International Journal of Creative Research Thoughts, vol. 10, no. 4, pp. e156-e161, 2022.',
        '[4] M. A. Diyaolu, O. B. Abodunrin, A. A. Adedamola, R. S. Ogunode, and O. Omoloba, "Development of an E-Based Hostel Management System," International Journal of Innovative Science and Research Technology, vol. 9, no. 6, pp. 1000-1006, 2024.',
        '[5] M. Aravinth, K. Nithin, and J. Kayalvizhi, "Automated Hostel Management System," International Journal of Scientific Research & Engineering Trends, vol. 11, no. 1, pp. 818-823, 2025.',
        '[6] R. K. Bista, A. J. Karki, B. V. M. Reddy, U. Aakash, R. A. Makaram, and S. Das, "Hostel Management System," International Journal of Trend in Scientific Research and Development, vol. 2, no. 4, pp. 856-861, 2018.',
        '[7] T. S. P. Reddy, S. Jayakrishna, I. Vasu, N. L. Siddhiswar, and G. Raviteja, "Hostel Management System," Journal of Emerging Technologies and Innovative Research, vol. 13, no. 4, 2026.',
        '[8] L. S. and S. K. K., "Hostel Management System," Journal of Emerging Technologies and Innovative Research, vol. 12, no. 7, 2025.',
    ]
    for ref in references:
        p = document.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        set_para_format(p, after=2)
        add_text(p, ref, size=9)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document.save(OUTPUT)


if __name__ == "__main__":
    build_document()
