from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT_DIR = Path("docs/user_manual_assets")
OUT_DIR.mkdir(parents=True, exist_ok=True)

W, H = 1800, 1100
BG = "white"
FG = (25, 25, 25)
ACCENT = (20, 78, 120)
LIGHT = (235, 244, 250)


def load_font(size, bold=False):
    fonts = []
    if bold:
        fonts += [
            "C:/Windows/Fonts/timesbd.ttf",
            "C:/Windows/Fonts/calibrib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ]
    else:
        fonts += [
            "C:/Windows/Fonts/times.ttf",
            "C:/Windows/Fonts/calibri.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
    for font in fonts:
        if Path(font).exists():
            return ImageFont.truetype(font, size)
    return ImageFont.load_default()


TITLE = load_font(42, True)
BODY = load_font(28)
SMALL = load_font(22)
CAPTION = load_font(26, True)


def new_canvas(title):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw.text((W // 2, 40), title, fill=ACCENT, font=TITLE, anchor="ma")
    return img, draw


def rounded_box(draw, xy, text, font=BODY, fill=LIGHT):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=20, fill=fill, outline=ACCENT, width=4)
    lines = text.split("\n")
    line_h = font.size + 8
    total_h = line_h * len(lines)
    y = y1 + ((y2 - y1) - total_h) / 2
    for line in lines:
        draw.text(((x1 + x2) / 2, y), line, fill=FG, font=font, anchor="ma")
        y += line_h


def arrow(draw, start, end, label=None):
    sx, sy = start
    ex, ey = end
    draw.line((sx, sy, ex, ey), fill=FG, width=4)
    if abs(ex - sx) >= abs(ey - sy):
        d = 1 if ex > sx else -1
        draw.polygon([(ex, ey), (ex - 18 * d, ey - 10), (ex - 18 * d, ey + 10)], fill=FG)
    else:
        d = 1 if ey > sy else -1
        draw.polygon([(ex, ey), (ex - 10, ey - 18 * d), (ex + 10, ey - 18 * d)], fill=FG)
    if label:
        draw.text(((sx + ex) / 2, (sy + ey) / 2 - 18), label, fill=ACCENT, font=SMALL, anchor="ma")


def save(img, name):
    img.save(OUT_DIR / name)


def overview_flow():
    img, d = new_canvas("Figure 1  Monthly Hostel Operations Flow")
    boxes = [
        ((70, 420, 290, 580), "1\nConsumption"),
        ((360, 420, 590, 580), "2\nGuest Charges\nand Static Charges"),
        ((660, 420, 900, 580), "3\nHostel Expense\nEntry"),
        ((970, 420, 1200, 580), "4\nAuto-Generated\nBills"),
        ((1270, 420, 1510, 580), "5\nPayments /\nEBL Handling"),
        ((1580, 420, 1730, 580), "6\nReports and\nApprovals"),
    ]
    for rect, label in boxes:
        rounded_box(d, rect, label)
    for i in range(len(boxes) - 1):
        arrow(d, (boxes[i][0][2], 500), (boxes[i + 1][0][0], 500))
    save(img, "overview_flow.png")


def signup_flow():
    img, d = new_canvas("Figure 2  Student Signup and Approval Flow")
    boxes = [
        ((130, 180, 420, 320), "Student fills\nsignup form"),
        ((130, 420, 420, 560), "Temporary ID\nor manual ID"),
        ((560, 300, 910, 440), "Caretaker reviews,\nassigns hostel and EBL"),
        ((1060, 300, 1380, 440), "Admin approves\nor rejects"),
        ((1460, 300, 1710, 440), "Approved student\ncan sign in"),
    ]
    for rect, label in boxes:
        rounded_box(d, rect, label)
    arrow(d, (420, 250), (560, 370))
    arrow(d, (420, 490), (560, 370))
    arrow(d, (910, 370), (1060, 370))
    arrow(d, (1380, 370), (1460, 370))
    save(img, "signup_flow.png")


def billing_flow():
    img, d = new_canvas("Figure 3  Student Bill Calculation Flow")
    rounded_box(d, (80, 180, 360, 320), "Expense Snapshot")
    rounded_box(d, (80, 420, 360, 560), "Consumption Data")
    rounded_box(d, (80, 660, 360, 800), "Static / Guest\nCharges")
    rounded_box(d, (520, 300, 880, 520), "Calculation Service\nbase_mess + keb + labour +\nnight_watch + bakery + proteins +\nmilk + additional_charge")
    rounded_box(d, (1040, 220, 1360, 360), "Fine Logic\nmanual_fine + late_fine")
    rounded_box(d, (1040, 460, 1360, 600), "Live Bill State\npayable, outstanding,\npayment_status")
    rounded_box(d, (1480, 340, 1720, 480), "Student Bill /\nPDF / Dashboard")
    arrow(d, (360, 250), (520, 360))
    arrow(d, (360, 490), (520, 410))
    arrow(d, (360, 730), (520, 460))
    arrow(d, (880, 410), (1040, 290))
    arrow(d, (880, 410), (1040, 530))
    arrow(d, (1360, 530), (1480, 410))
    save(img, "billing_flow.png")


def report_flow():
    img, d = new_canvas("Figure 4  Report Generation and Approval Flow")
    boxes = [
        ((120, 420, 360, 580), "Draft Report\nAuto-generated"),
        ((470, 420, 720, 580), "Caretaker\nreviews"),
        ((830, 420, 1090, 580), "Submit for\napproval"),
        ((1200, 300, 1460, 460), "Warden\napproval"),
        ((1200, 620, 1460, 780), "Dean / Admin\nreview where needed"),
        ((1560, 420, 1720, 580), "Final status\nvisible"),
    ]
    for rect, label in boxes:
        rounded_box(d, rect, label)
    arrow(d, (360, 500), (470, 500))
    arrow(d, (720, 500), (830, 500))
    arrow(d, (1090, 470), (1200, 380))
    arrow(d, (1090, 530), (1200, 700))
    arrow(d, (1460, 380), (1560, 500))
    arrow(d, (1460, 700), (1560, 500))
    save(img, "report_flow.png")


def ebl_flow():
    img, d = new_canvas("Figure 5  EBL Workflow")
    boxes = [
        ((80, 420, 320, 580), "Student creates\nEBL period"),
        ((430, 420, 700, 580), "Caretaker verifies\nperiod"),
        ((810, 420, 1080, 580), "University claim\namount updated"),
        ((1190, 420, 1450, 580), "Remaining balance\ncalculated"),
        ((1560, 420, 1730, 580), "Student / office\nsettles balance"),
    ]
    for rect, label in boxes:
        rounded_box(d, rect, label)
    for i in range(len(boxes) - 1):
        arrow(d, (boxes[i][0][2], 500), (boxes[i + 1][0][0], 500))
    save(img, "ebl_flow.png")


def calc_map():
    img, d = new_canvas("Figure 6  Calculation Dependency Map")
    rounded_box(d, (90, 170, 430, 310), "Hostel Expense Sheet\nkirana, oil, milk, labour,\nbanana, bakery, KEB, proteins")
    rounded_box(d, (90, 430, 430, 570), "Monthly Expenditure Report\nopening_balance,\nclosing_balance_last_month,\nmess_bill_per_day")
    rounded_box(d, (90, 690, 430, 830), "Consumption Sheet\negg_count, chicken_count,\npaneer_count, milk_amount,\nabsent_days, fine_amount")
    rounded_box(d, (640, 300, 1040, 560), "Expense Snapshot and\nBill Calculation Services")
    rounded_box(d, (1240, 180, 1670, 340), "Mess Bill\nbase_mess, proteins,\ncharges, fines, payable")
    rounded_box(d, (1240, 430, 1670, 590), "Analytics and Reports\nexpenses, billed, collected,\noutstanding, hostel split")
    rounded_box(d, (1240, 680, 1670, 840), "Student Views\ncurrent payable,\namount paid, utilities,\nEBL status")
    arrow(d, (430, 240), (640, 360))
    arrow(d, (430, 500), (640, 430))
    arrow(d, (430, 760), (640, 500))
    arrow(d, (1040, 380), (1240, 260))
    arrow(d, (1040, 430), (1240, 510))
    arrow(d, (1040, 500), (1240, 760))
    save(img, "calc_map.png")


def main():
    overview_flow()
    signup_flow()
    billing_flow()
    report_flow()
    ebl_flow()
    calc_map()


if __name__ == "__main__":
    main()
