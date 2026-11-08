"""Render the current credential-free integration guide; never embed deployment keys."""
from pathlib import Path
from html import escape
import re
import textwrap
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, KeepTogether

ROOT = Path(__file__).resolve().parents[1]

def build_pdf(filename=None):
    target = Path(filename) if filename else ROOT / 'docs/BEMS_AI_AUTOMATION_N8N_ENGINEER_GUIDE.pdf'
    source = (ROOT / 'docs/AI_AUTOMATION_N8N_GUIDE.md').read_text()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle('GuideBody', fontName='Helvetica', fontSize=9, leading=13, spaceAfter=7, wordWrap='CJK'))
    styles.add(ParagraphStyle('GuideCode', fontName='Courier', fontSize=7.5, leading=10, leftIndent=10, rightIndent=10, backColor=colors.HexColor('#f1f5f9'), spaceBefore=7, spaceAfter=9))
    styles['Title'].textColor = colors.HexColor('#9a3412')
    styles['Heading2'].textColor = colors.HexColor('#9a3412')
    story=[]; code=[]; in_code=False
    for line in source.splitlines():
        if line.startswith('```'):
            if in_code:
                wrapped=[]
                for item in code: wrapped.extend(textwrap.wrap(item, width=94, replace_whitespace=False, drop_whitespace=False) or [''])
                story.append(KeepTogether([Preformatted('\n'.join(wrapped), styles['GuideCode'])]))
                code=[]
            in_code=not in_code
            continue
        if in_code: code.append(line); continue
        if not line.strip(): continue
        if line.startswith('# '): story.append(Paragraph(escape(line[2:]),styles['Title'])); continue
        if line.startswith('## '): story.append(Paragraph(escape(line[3:]),styles['Heading2'])); continue
        story.append(Paragraph(escape(line),styles['GuideBody']))
    def footer(canvas, doc):
        canvas.saveState();canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#64748b'))
        canvas.drawString(42,25,'BEMS | Source integration contract | 7 November 2026')
        canvas.drawRightString(570,25,str(doc.page));canvas.restoreState()
    SimpleDocTemplate(str(target),pagesize=(612,792),leftMargin=42,rightMargin=42,topMargin=42,bottomMargin=45,title='BEMS AI and Monnify Wallet Integration Guide',author='BEMS Engineering').build(story,onFirstPage=footer,onLaterPages=footer)
    print(f'Integration guide regenerated: {target}')

if __name__ == '__main__': build_pdf()
