import sys
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "BEMS GROUP ENTERPRISE · AI AUTOMATION & n8n INTEGRATION SPECIFICATION")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, 558, 45)
        
        self.drawString(54, 32, "CONFIDENTIAL · AUTHORIZED ENGINEERING USE ONLY · BEMS HOLDINGS HQ")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_str)
        self.restoreState()

def build_pdf(filename="docs/BEMS_AI_AUTOMATION_N8N_ENGINEER_GUIDE.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_orange = colors.HexColor("#EA580C")
    navy_dark = colors.HexColor("#0F172A")
    slate_muted = colors.HexColor("#475569")
    code_bg = colors.HexColor("#F1F5F9")
    border_color = colors.HexColor("#CBD5E1")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=navy_dark,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=brand_orange,
        spaceAfter=15
    )

    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=slate_muted,
        spaceAfter=20
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=navy_dark,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=brand_orange,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=4
    )

    code_style = ParagraphStyle(
        'Code',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # Title & Metadata
    story.append(Spacer(1, 15))
    story.append(Paragraph("BEMS GROUP ENTERPRISE ERP", subtitle_style))
    story.append(Paragraph("AI Automation & n8n Integration Guide", title_style))
    story.append(Paragraph(
        "<b>Comprehensive Manual for Autonomous Corporate Operations, Payroll, Attendance & Staged Approvals</b>",
        ParagraphStyle('Intro', fontName='Helvetica', fontSize=10, leading=14, textColor=navy_dark, spaceAfter=8)
    ))
    story.append(Paragraph(
        "<b>Document Version:</b> 1.1.0 &nbsp;|&nbsp; <b>Environment:</b> Production (<code>https://bemserp.work</code>) &nbsp;|&nbsp; <b>Target Audience:</b> AI Automation Engineer",
        meta_style
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_orange, spaceBefore=0, spaceAfter=14))

    # Executive Summary Card
    exec_text = """
    <b>EXECUTIVE NOTICE & SCOPE BOUNDARIES:</b><br/>
    • <b>Strict 3-Role Governance:</b> Only <code>SUPER_ADMIN</code>, <code>GMD</code>, and <code>STAFF</code> exist in the entire system. Never invent or pass legacy roles.<br/>
    • <b>Approval Staging Guarantee:</b> The AI <i>never</i> approves expenditures directly. It stages actions and dispatches interactive confirmation cards with banking app deep links.<br/>
    • <b>File Upload Exclusion:</b> Physical file uploads (logos, certificates, invoices, photo receipts) are <b>excluded</b> from AI automation tools. All files are uploaded normally via the Web Dashboard.<br/>
    • <b>Zero Dummy Data Rule:</b> AI workflows must collect exact, verified parameters from the GMD before invoking creation endpoints. Incomplete requests return HTTP 400.
    """
    card_table = Table([[Paragraph(exec_text, body_style)]], colWidths=[504])
    card_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFF7ED")),
        ('BOX', (0,0), (-1,-1), 1, brand_orange),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(card_table)
    story.append(Spacer(1, 14))

    # Section 1: Authentication & Headers
    story.append(Paragraph("1. Authentication & Global Headers", h1_style))
    story.append(Paragraph(
        "All requests made by n8n or external automation scripts must authenticate against the production server using the Master AI Service Bearer Token:",
        body_style
    ))

    auth_rows = [
        [Paragraph("<b>Header Name</b>", body_style), Paragraph("<b>Header Value</b>", body_style), Paragraph("<b>Description</b>", body_style)],
        [Paragraph("<code>Authorization</code>", code_style), Paragraph("<code>Bearer 7095ec2348ee3a4ca855707cec7bab8a697f0de4aad3f93f0e545d82bba8e9a8</code>", code_style), Paragraph("Master AI Service Token", body_style)],
        [Paragraph("<code>x-api-key</code>", code_style), Paragraph("<code>7095ec2348ee3a4ca855707cec7bab8a697f0de4aad3f93f0e545d82bba8e9a8</code>", code_style), Paragraph("Alternate header format", body_style)],
        [Paragraph("<code>Content-Type</code>", code_style), Paragraph("<code>application/json</code>", code_style), Paragraph("Mandatory for POST requests", body_style)]
    ]
    t_auth = Table(auth_rows, colWidths=[110, 240, 154])
    t_auth.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F8FAFC")),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_auth)
    story.append(Spacer(1, 14))

    # Section 2: Complete Endpoint Directory
    story.append(Paragraph("2. Complete AI Tool API Endpoints Directory", h1_style))
    
    endpoints_rows = [
        [Paragraph("<b>Domain / Feature</b>", body_style), Paragraph("<b>Method & URL</b>", body_style), Paragraph("<b>Action / Capability</b>", body_style)],
        [Paragraph("<b>Service Discovery</b>", body_style), Paragraph("<code>GET /api/ai/tools</code>", code_style), Paragraph("Lists all available AI tools & capability descriptors", body_style)],
        [Paragraph("<b>Corporate Subsidiaries</b>", body_style), Paragraph("<code>GET /api/ai/tools/subsidiary</code><br/><code>POST /api/ai/tools/subsidiary</code>", code_style), Paragraph("List operating entities or provision a new subsidiary with mandatory parameters", body_style)],
        [Paragraph("<b>Staged Approvals & Payouts</b>", body_style), Paragraph("<code>GET /api/ai/tools/approvals</code><br/><code>POST /api/ai/tools/approvals</code>", code_style), Paragraph("Fetch pending approvals; stage approval with deep links into banking apps & USSD", body_style)],
        [Paragraph("<b>Bank Accounts</b>", body_style), Paragraph("<code>GET /api/ai/tools/bank-accounts</code><br/><code>POST /api/ai/tools/bank-accounts</code>", code_style), Paragraph("Look up or register bank accounts for STAFF, SUBSIDIARY, or VENDOR with NUBAN check", body_style)],
        [Paragraph("<b>Executive Onboarding</b>", body_style), Paragraph("<code>POST /api/ai/tools/admin-onboarding</code>", code_style), Paragraph("Onboard SUPER_ADMIN or GMD via cryptographic invitation email dispatch", body_style)],
        [Paragraph("<b>Full Payroll Operations</b>", body_style), Paragraph("<code>GET /api/ai/tools/payroll</code><br/><code>POST /api/ai/tools/payroll</code>", code_style), Paragraph("Run payroll calculation with attendance deductions; lock batch; mark paid", body_style)],
        [Paragraph("<b>Attendance & Timekeeping</b>", body_style), Paragraph("<code>GET /api/ai/tools/attendance</code><br/><code>POST /api/ai/tools/attendance</code>", code_style), Paragraph("Inspect daily master roster; excuse penalty; clock in/out; update shift policy", body_style)],
        [Paragraph("<b>Conversational Chatbot</b>", body_style), Paragraph("<code>POST /api/ai/chat</code>", code_style), Paragraph("Direct natural language command execution & checklist generator", body_style)]
    ]
    t_end = Table(endpoints_rows, colWidths=[120, 190, 194])
    t_end.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F8FAFC")),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_end)

    story.append(PageBreak())

    # Section 3: Deep Dive - Subsidiary Provisioning
    story.append(Paragraph("3. Corporate Subsidiary Provisioning", h1_style))
    story.append(Paragraph(
        "<b>Endpoint:</b> <code>POST https://bemserp.work/api/ai/tools/subsidiary</code><br/>"
        "<b>Rule:</b> File uploads are excluded from AI tools. Upload logos and legal certificates on the Web Dashboard.",
        body_style
    ))
    sub_payload = """{
  "name": "Arella Creative Studio Ltd",
  "brandColor": "#EA580C",
  "industry": "Media & Creative Production",
  "headquarters": "14 Admiralty Way, Lekki Phase 1, Lagos",
  "code": "ACS",
  "currency": "NGN"
}"""
    t_code1 = Table([[Paragraph(sub_payload.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[504])
    t_code1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), code_bg),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_code1)
    story.append(Spacer(1, 10))

    # Section 4: Staged Approvals & Bank Deep Links
    story.append(Paragraph("4. Staged Approvals & Quick-Pay Bank Deep Links", h1_style))
    story.append(Paragraph(
        "<b>Endpoint:</b> <code>POST https://bemserp.work/api/ai/tools/approvals</code><br/>"
        "<b>Protocol:</b> The AI <i>never</i> executes direct approval. It creates a staged action and returns deep links into Nigerian banking apps (GTWorld, Kuda, Zenith, Access, OPay, Moniepoint) and USSD strings for fast GMD settlement.",
        body_style
    ))
    app_payload = """{
  "requestId": "REQ-2026-0005",
  "decision": "APPROVE",
  "comment": "Approved for immediate deployment"
}"""
    t_code2 = Table([[Paragraph(app_payload.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[504])
    t_code2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), code_bg),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_code2)
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>Response Output Structure:</b><br/>"
        "• <code>status: 'AWAITING_CONFIRMATION'</code><br/>"
        "• <code>beneficiaryAccount: { bankName, accountNumber, accountName }</code><br/>"
        "• <code>links.quickPayPortal: 'https://bemserp.work/pay/REQ-2026-0005'</code><br/>"
        "• <code>links.fastUssdDialer: '*737*2*150000*2001928374#'</code><br/>"
        "• <code>stagedAction.confirmationEndpoint: '/api/ai/staged-actions/{id}/confirm'</code>",
        body_style
    ))
    story.append(Spacer(1, 10))

    # Section 5: Bank Account Registration
    story.append(Paragraph("5. Bank Account Registration & Verification", h1_style))
    story.append(Paragraph(
        "<b>Endpoint:</b> <code>POST https://bemserp.work/api/ai/tools/bank-accounts</code><br/>"
        "Registers verified 10-digit NUBAN accounts for staff members, subsidiaries, or vendors.",
        body_style
    ))
    bank_payload = """{
  "accountType": "STAFF",
  "targetQuery": "babatunde@bemsgroup.com",
  "bankName": "Kuda Microfinance Bank",
  "accountNumber": "2001928374",
  "accountName": "Babatunde Diekolayomi"
}"""
    t_code3 = Table([[Paragraph(bank_payload.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[504])
    t_code3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), code_bg),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_code3)

    story.append(PageBreak())

    # Section 6: Executive Admin Onboarding
    story.append(Paragraph("6. Executive Admin Onboarding (Strict 3-Role Rule)", h1_style))
    story.append(Paragraph(
        "<b>Endpoint:</b> <code>POST https://bemserp.work/api/ai/tools/admin-onboarding</code><br/>"
        "<b>Strict Rule:</b> Only <code>SUPER_ADMIN</code> or <code>GMD</code> can be invited. Staff members register exclusively via self-service mobile app. All other roles are rejected.",
        body_style
    ))
    adm_payload = """{
  "legalName": "Engr. Michael Adeyemi",
  "workEmail": "adeyemi@bemsgroup.com",
  "phone": "+2348030001122",
  "role": "SUPER_ADMIN"
}"""
    t_code4 = Table([[Paragraph(adm_payload.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[504])
    t_code4.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), code_bg),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_code4)
    story.append(Spacer(1, 10))

    # Section 7: Full Payroll Operations
    story.append(Paragraph("7. Full Payroll Operations Suite", h1_style))
    story.append(Paragraph(
        "<b>Endpoint:</b> <code>POST https://bemserp.work/api/ai/tools/payroll</code><br/>"
        "Automates attendance penalty deductions (5% lateness, 100% absence) and generates payslip items.",
        body_style
    ))
    pay_payload = """// Action 1: Calculate & Prepare Payroll
{ "action": "PREPARE", "month": 11, "year": 2026 }

// Action 2: Sign Off & Lock Period
{ "action": "SIGN_OFF", "batchId": "BATCH-2026-11" }

// Action 3: Record Payouts Disbursed
{ "action": "RECORD_PAYOUT", "batchId": "BATCH-2026-11", "reference": "GTB-BULK-928371" }"""
    t_code5 = Table([[Paragraph(pay_payload.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[504])
    t_code5.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), code_bg),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_code5)
    story.append(Spacer(1, 10))

    # Section 8: Attendance Operations
    story.append(Paragraph("8. Attendance Operations & Penalty Waivers", h1_style))
    story.append(Paragraph(
        "<b>Endpoint:</b> <code>POST https://bemserp.work/api/ai/tools/attendance</code>",
        body_style
    ))
    att_payload = """// Action 1: Waive / Excuse Lateness Penalty
{ "action": "EXCUSE_OVERRIDE", "employeeId": "emp-uuid", "date": "2026-11-05", "reason": "Official field assignment approved by GMD" }

// Action 2: Update Shift & Resumption Policy
{ "action": "UPDATE_POLICY", "workStartTime": "08:00", "gracePeriodMinutes": 15, "latenessDeductionPercent": 5.0 }"""
    t_code6 = Table([[Paragraph(att_payload.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[504])
    t_code6.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), code_bg),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_code6)

    story.append(PageBreak())

    # Section 9: n8n Node Blueprint & WhatsApp Notification Template
    story.append(Paragraph("9. n8n Node Blueprint & WhatsApp Notification Template", h1_style))
    story.append(Paragraph(
        "<b>WhatsApp / Slack Message Template for Dispatched Approvals:</b>",
        body_style
    ))
    msg_template = """✅ *REQ-2026-0005 APPROVED*
*Title:* Starlink Router Replacement
*Amount:* ₦150,000
*Beneficiary:* Babatunde Diekolayomi
*Bank:* Kuda Microfinance Bank
*Account:* 2001928374

📲 *Tap to Disburse in Bank App:*
https://bemserp.work/pay/REQ-2026-0005

📞 *Fast Phone USSD:*
*737*2*150000*2001928374#"""
    t_code7 = Table([[Paragraph(msg_template.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[504])
    t_code7.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0FDF4")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#86EFAC")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_code7)
    story.append(Spacer(1, 14))

    # Section 10: Mandatory Parameter Checklist
    story.append(Paragraph("10. Mandatory Parameter Checklist Protocol", h1_style))
    story.append(Paragraph(
        "Before sending POST requests, n8n LLM nodes must ask the GMD for all mandatory specifications:",
        body_style
    ))
    story.append(Paragraph("• <b>Subsidiary:</b> Legal Corporate Name, Brand Color (Hex), Business Sector, Headquarters Location.", bullet_style))
    story.append(Paragraph("• <b>Executive Admin:</b> Full Legal Name, Corporate Work Email, Mobile Phone, Role (strictly SUPER_ADMIN or GMD).", bullet_style))
    story.append(Paragraph("• <b>Bank Account:</b> Target Type (STAFF/SUBSIDIARY/VENDOR), Target Identifier, Bank Name, 10-Digit NUBAN, Verified Account Name.", bullet_style))
    story.append(Paragraph("• <b>Payroll:</b> Action (PREPARE/SIGN_OFF/RECORD_PAYOUT), Month, Year.", bullet_style))
    story.append(Spacer(1, 14))

    # Section 11: Scope & Boundaries
    story.append(Paragraph("11. System Scope & Boundary Guarantees", h1_style))
    story.append(Paragraph(
        "1. <b>File Upload Exclusion:</b> Physical file uploads (logos, certificates, invoices, photo receipts) are excluded from AI tools and handled directly on the Web Dashboard.<br/>"
        "2. <b>Approval Staging Guarantee:</b> The AI never executes direct fund approval; it stages the action and dispatches deep links and interactive buttons for the GMD.<br/>"
        "3. <b>Strict 3-Role Architecture:</b> Only <code>SUPER_ADMIN</code>, <code>GMD</code>, and <code>STAFF</code> exist in the system. Never introduce legacy roles.",
        body_style
    ))
    story.append(Spacer(1, 20))

    # Sign-off card
    sign_off = Table([[
        Paragraph(
            "<b>ISSUED BY:</b> BEMS Group Executive Management & Engineering Team<br/>"
            "<b>STATUS:</b> Active & Enforced in Production (<code>bemserp.work</code>)<br/>"
            "<b>SECURITY:</b> Authorized Engineering Automation Integration Only",
            ParagraphStyle('Sign', fontName='Helvetica', fontSize=8, leading=11, textColor=slate_muted)
        )
    ]], colWidths=[504])
    sign_off.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(sign_off)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully built: {filename}")

if __name__ == "__main__":
    build_pdf()
