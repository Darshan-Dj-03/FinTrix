from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT_DIR = Path("docs/report_assets")
OUT_DIR.mkdir(parents=True, exist_ok=True)

WIDTH = 1800
HEIGHT = 1100
BG = "white"
FG = (20, 20, 20)
ACCENT = (27, 79, 114)
LIGHT = (235, 244, 250)


def load_font(size, bold=False):
    candidates = []
    if bold:
        candidates += [
            "C:/Windows/Fonts/timesbd.ttf",
            "C:/Windows/Fonts/calibrib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ]
    else:
        candidates += [
            "C:/Windows/Fonts/times.ttf",
            "C:/Windows/Fonts/calibri.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


TITLE_FONT = load_font(42, bold=True)
BOX_FONT = load_font(28)
SMALL_FONT = load_font(24)
CAPTION_FONT = load_font(22, bold=True)


def canvas(title):
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    draw.text((WIDTH // 2, 40), title, fill=ACCENT, font=TITLE_FONT, anchor="ma")
    return image, draw


def box(draw, xy, text, fill=LIGHT, outline=ACCENT, font=BOX_FONT):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=18, fill=fill, outline=outline, width=4)
    lines = text.split("\n")
    line_height = font.size + 6
    total_h = line_height * len(lines)
    y = y1 + (y2 - y1 - total_h) / 2
    for line in lines:
        draw.text(((x1 + x2) / 2, y), line, fill=FG, font=font, anchor="ma")
        y += line_height


def arrow(draw, start, end, text=None, font=SMALL_FONT):
    draw.line([start, end], fill=FG, width=4)
    ex, ey = end
    sx, sy = start
    if abs(ex - sx) > abs(ey - sy):
        direction = 1 if ex > sx else -1
        draw.polygon(
            [(ex, ey), (ex - 20 * direction, ey - 10), (ex - 20 * direction, ey + 10)],
            fill=FG,
        )
    else:
        direction = 1 if ey > sy else -1
        draw.polygon(
            [(ex, ey), (ex - 10, ey - 20 * direction), (ex + 10, ey - 20 * direction)],
            fill=FG,
        )
    if text:
        mx = (sx + ex) / 2
        my = (sy + ey) / 2 - 20
        draw.text((mx, my), text, fill=ACCENT, font=font, anchor="ma")


def save(img, name):
    img.save(OUT_DIR / name)


def block_diagram():
    img, draw = canvas("Figure 2.1  Simple Block Diagram of FinTrix")
    boxes = [
        ((80, 420, 320, 590), "Student /\nCaretaker /\nAdmin"),
        ((430, 420, 700, 590), "React Frontend\nRole-Based\nDashboards"),
        ((820, 420, 1070, 590), "Express API\nControllers\nand Routes"),
        ((1180, 420, 1450, 590), "Business Logic\nBilling, Reports,\nNotifications"),
        ((1540, 420, 1720, 590), "MongoDB\nDatabase"),
    ]
    for item in boxes:
        box(draw, item[0], item[1])
    for i in range(len(boxes) - 1):
        arrow(draw, (boxes[i][0][2], 505), (boxes[i + 1][0][0], 505))
    save(img, "block_diagram.png")


def use_case():
    img, draw = canvas("Figure 3.3.2  Use Case Diagram")
    draw.ellipse((620, 150, 1550, 980), outline=ACCENT, width=4)
    actors = [
        ((90, 260), "Student"),
        ((90, 520), "Caretaker"),
        ((90, 790), "Admin / Warden"),
    ]
    usecases = [
        ((800, 220, 1180, 290), "Login and Access Dashboard"),
        ((980, 340, 1400, 410), "View Bills and Payments"),
        ((760, 460, 1230, 530), "Manage Expenses and Consumption"),
        ((980, 580, 1440, 650), "Generate Bills and Reports"),
        ((760, 700, 1230, 770), "Approve Signups / Review Analytics"),
        ((980, 820, 1440, 890), "Download Reports and Statements"),
    ]
    for (x, y), label in actors:
        draw.line((x, y + 45, x, y + 150), fill=FG, width=4)
        draw.ellipse((x - 20, y, x + 20, y + 40), outline=FG, width=4)
        draw.line((x - 40, y + 80, x + 40, y + 80), fill=FG, width=4)
        draw.line((x, y + 150, x - 35, y + 210), fill=FG, width=4)
        draw.line((x, y + 150, x + 35, y + 210), fill=FG, width=4)
        draw.text((x, y + 235), label, fill=FG, font=BOX_FONT, anchor="ma")
    for rect, label in usecases:
        draw.ellipse(rect, outline=ACCENT, width=4, fill=LIGHT)
        draw.text(((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2), label, fill=FG, font=SMALL_FONT, anchor="mm")
    connections = [
        ((130, 300), (800, 255)),
        ((130, 300), (980, 375)),
        ((130, 560), (760, 495)),
        ((130, 560), (980, 615)),
        ((130, 830), (760, 735)),
        ((130, 830), (980, 855)),
        ((130, 560), (800, 255)),
    ]
    for start, end in connections:
        draw.line([start, end], fill=FG, width=3)
    save(img, "use_case_diagram.png")


def dfd_level0():
    img, draw = canvas("Figure 4.1  Level 0 Data Flow Diagram")
    box(draw, (110, 430, 350, 590), "Students")
    box(draw, (110, 700, 350, 860), "Caretakers /\nAdmins")
    box(draw, (640, 370, 1160, 650), "FinTrix Hostel Management System")
    box(draw, (1420, 430, 1690, 590), "MongoDB Data Store")
    arrow(draw, (350, 510), (640, 470), "bills, login, profile")
    arrow(draw, (350, 780), (640, 560), "expenses, charges, approvals")
    arrow(draw, (1160, 510), (1420, 510), "store / retrieve records")
    arrow(draw, (640, 610), (350, 820), "reports, alerts, status")
    arrow(draw, (640, 420), (350, 470), "bill view, payment status")
    save(img, "dfd_level0.png")


def dfd_detailed():
    img, draw = canvas("Figure 4.2  Detailed DFD of the Proposed System")
    box(draw, (70, 160, 320, 280), "1.0\nAuthentication")
    box(draw, (70, 360, 320, 480), "2.0\nStudent Signup\nand Hostel Records")
    box(draw, (70, 560, 320, 680), "3.0\nExpenses and\nConsumption")
    box(draw, (70, 760, 320, 880), "4.0\nBilling and\nPayments")
    box(draw, (520, 260, 860, 420), "5.0\nAnalytics,\nReports and Notifications")
    box(draw, (1120, 120, 1380, 240), "D1\nUser / Student Data")
    box(draw, (1120, 320, 1380, 440), "D2\nExpense / Charge Data")
    box(draw, (1120, 520, 1380, 640), "D3\nBill / Payment Data")
    box(draw, (1120, 720, 1380, 840), "D4\nReport / Notification Data")
    box(draw, (1530, 410, 1730, 570), "Users")
    for sy in [220, 420, 620, 820]:
        arrow(draw, (320, sy), (520, 340 if sy < 500 else 340 if sy == 420 else 340))
    arrow(draw, (320, 220), (1120, 180))
    arrow(draw, (320, 420), (1120, 180))
    arrow(draw, (320, 620), (1120, 380))
    arrow(draw, (320, 820), (1120, 580))
    arrow(draw, (860, 340), (1120, 780))
    arrow(draw, (1380, 780), (1530, 490))
    save(img, "dfd_detailed.png")


def class_diagram():
    img, draw = canvas("Figure 4.3  Class Diagram")
    classes = [
        ((80, 150, 420, 350), "User\n- name\n- username\n- role\n- hostelId"),
        ((520, 150, 860, 350), "Student\n- userId\n- studentId\n- gender\n- isActive"),
        ((960, 150, 1300, 350), "Hostel\n- name\n- type\n- location"),
        ((80, 470, 420, 730), "MessBill\n- month\n- total_amount\n- due_date\n- payment_status"),
        ((520, 470, 860, 730), "Expense / HostelExpense\n- month\n- kirana\n- milk\n- labour\n- mess_bill_per_day"),
        ((960, 470, 1300, 730), "Payment / Charge / Advance\n- amount\n- method\n- month\n- status"),
        ((1400, 300, 1740, 560), "Report / Notification\n- snapshot\n- totals\n- status\n- createdAt"),
    ]
    for rect, label in classes:
        box(draw, rect, label)
    arrow(draw, (420, 250), (520, 250), "1:1")
    arrow(draw, (860, 250), (960, 250), "many:1")
    arrow(draw, (250, 350), (250, 470), "1:many")
    arrow(draw, (690, 350), (690, 470), "1:many")
    arrow(draw, (1080, 350), (1080, 470), "1:many")
    arrow(draw, (1300, 600), (1400, 430), "summaries")
    save(img, "class_diagram.png")


def sequence_diagram():
    img, draw = canvas("Figure 4.4  Sequence Diagram for Bill Generation and Payment")
    x_positions = [170, 520, 870, 1220, 1570]
    labels = ["Caretaker", "Frontend", "API", "Billing Service", "MongoDB"]
    for x, label in zip(x_positions, labels):
        draw.text((x, 120), label, fill=FG, font=CAPTION_FONT, anchor="ma")
        draw.line((x, 160, x, 980), fill=FG, width=3)
    steps = [
        (170, 520, 220, "submit expense data"),
        (520, 870, 290, "POST /hostel-expense/create"),
        (870, 1220, 380, "calculate hostel expense"),
        (1220, 1570, 470, "save expense snapshot"),
        (870, 1220, 560, "generate bills"),
        (1220, 1570, 650, "insert MessBill records"),
        (1570, 870, 740, "stored records"),
        (870, 520, 830, "return generated bill data"),
        (520, 170, 920, "show bills/report"),
    ]
    for sx, ex, y, label in steps:
        arrow(draw, (sx, y), (ex, y), label)
    save(img, "sequence_diagram.png")


def er_diagram():
    img, draw = canvas("Figure 4.5  ER Diagram")
    entities = [
        ((120, 180, 420, 320), "USER"),
        ((520, 180, 820, 320), "STUDENT"),
        ((920, 180, 1220, 320), "HOSTEL"),
        ((1320, 180, 1660, 320), "STUDENT_CONSUMPTION"),
        ((320, 500, 660, 640), "MESS_BILL"),
        ((780, 500, 1120, 640), "PAYMENT"),
        ((1240, 500, 1600, 640), "REPORT"),
    ]
    for rect, label in entities:
        box(draw, rect, label, font=CAPTION_FONT)
    arrow(draw, (420, 250), (520, 250), "has one")
    arrow(draw, (820, 250), (920, 250), "belongs to")
    arrow(draw, (1220, 250), (1320, 250), "tracks")
    arrow(draw, (670, 320), (490, 500), "generates")
    arrow(draw, (1390, 320), (1480, 500), "feeds")
    arrow(draw, (660, 570), (780, 570), "paid by")
    arrow(draw, (1120, 570), (1240, 570), "reported in")
    save(img, "er_diagram.png")


def state_diagram():
    img, draw = canvas("Figure 4.6  State Transition Diagram for Bill Lifecycle")
    states = [
        ((120, 470, 340, 620), "Draft"),
        ((470, 470, 690, 620), "Generated"),
        ((820, 470, 1040, 620), "Pending"),
        ((1170, 330, 1390, 480), "Partial"),
        ((1170, 610, 1390, 760), "EBL / Claim"),
        ((1500, 470, 1720, 620), "Paid"),
    ]
    for rect, label in states:
        box(draw, rect, label, font=CAPTION_FONT)
    arrow(draw, (340, 545), (470, 545), "expense saved")
    arrow(draw, (690, 545), (820, 545), "bills published")
    arrow(draw, (1040, 520), (1170, 405), "part payment")
    arrow(draw, (1040, 570), (1170, 685), "EBL flag")
    arrow(draw, (1390, 405), (1500, 545), "complete payment")
    arrow(draw, (1390, 685), (1500, 545), "balance settled")
    save(img, "state_diagram.png")


def gui_navigation():
    img, draw = canvas("Figure 3.5  GUI Navigation Flow")
    box(draw, (90, 420, 320, 560), "Home / Login")
    box(draw, (450, 160, 760, 300), "Student Dashboard")
    box(draw, (450, 420, 760, 560), "Caretaker Dashboard")
    box(draw, (450, 680, 760, 820), "Admin Dashboard")
    box(draw, (980, 120, 1360, 260), "Bills / Payments /\nEBL View")
    box(draw, (980, 340, 1360, 480), "Expenses / Consumption /\nCharges / Reports")
    box(draw, (980, 620, 1360, 760), "Approvals / Users /\nAnalytics / Hostels")
    box(draw, (1510, 360, 1730, 500), "PDF Downloads /\nNotifications")
    arrow(draw, (320, 490), (450, 230))
    arrow(draw, (320, 490), (450, 490))
    arrow(draw, (320, 490), (450, 750))
    arrow(draw, (760, 230), (980, 190))
    arrow(draw, (760, 490), (980, 410))
    arrow(draw, (760, 750), (980, 690))
    arrow(draw, (1360, 410), (1510, 430))
    arrow(draw, (1360, 690), (1510, 430))
    arrow(draw, (1360, 190), (1510, 430))
    save(img, "gui_navigation.png")


def main():
    block_diagram()
    use_case()
    dfd_level0()
    dfd_detailed()
    class_diagram()
    sequence_diagram()
    er_diagram()
    state_diagram()
    gui_navigation()


if __name__ == "__main__":
    main()
