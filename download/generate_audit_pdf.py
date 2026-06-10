#!/usr/bin/env python3
"""
KFM Delice - Audit Technique Complet - PDF Generation
ReportLab body PDF with detailed audit analysis
"""
import sys
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image, HRFlowable, CondPageBreak
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import hashlib

# ── Color Palette ──
ACCENT       = colors.HexColor('#af4c2b')
TEXT_PRIMARY  = colors.HexColor('#22211e')
TEXT_MUTED    = colors.HexColor('#7a766e')
BG_SURFACE   = colors.HexColor('#dedbd6')
BG_PAGE      = colors.HexColor('#efeeec')

TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ── Fonts ──
pdfmetrics.registerFont(TTFont('NotoSerifSC', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansMono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold')
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')
registerFontFamily('DejaVuSansMono', normal='DejaVuSansMono', bold='DejaVuSansMono')

# ── Page Setup ──
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ── Styles ──
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'CustomTitle', fontName='LiberationSerif', fontSize=22, leading=28,
    textColor=ACCENT, spaceBefore=24, spaceAfter=12, alignment=TA_LEFT
)

h1_style = ParagraphStyle(
    'CustomH1', fontName='LiberationSerif', fontSize=18, leading=24,
    textColor=ACCENT, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT
)

h2_style = ParagraphStyle(
    'CustomH2', fontName='LiberationSerif', fontSize=14, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8, alignment=TA_LEFT
)

h3_style = ParagraphStyle(
    'CustomH3', fontName='LiberationSerif', fontSize=12, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6, alignment=TA_LEFT
)

body_style = ParagraphStyle(
    'CustomBody', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6, alignment=TA_JUSTIFY
)

body_left_style = ParagraphStyle(
    'CustomBodyLeft', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6, alignment=TA_LEFT
)

bullet_style = ParagraphStyle(
    'CustomBullet', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=2, alignment=TA_LEFT,
    leftIndent=20, bulletIndent=8
)

muted_style = ParagraphStyle(
    'MutedText', fontName='LiberationSerif', fontSize=9, leading=14,
    textColor=TEXT_MUTED, spaceBefore=0, spaceAfter=4, alignment=TA_LEFT
)

callout_style = ParagraphStyle(
    'Callout', fontName='LiberationSerif', fontSize=11, leading=17,
    textColor=ACCENT, spaceBefore=6, spaceAfter=6, alignment=TA_LEFT,
    leftIndent=16, borderPadding=8, borderWidth=0
)

# Table styles
th_style = ParagraphStyle(
    'TableHeader', fontName='Carlito', fontSize=10, leading=14,
    textColor=colors.white, alignment=TA_CENTER
)

td_style = ParagraphStyle(
    'TableCell', fontName='Carlito', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)

td_center_style = ParagraphStyle(
    'TableCellCenter', fontName='Carlito', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER
)

caption_style = ParagraphStyle(
    'Caption', fontName='LiberationSerif', fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=6, alignment=TA_CENTER
)

# ── TOC Template ──
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ── Helpers ──
def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

H1_ORPHAN_THRESHOLD = (PAGE_H - TOP_MARGIN - BOTTOM_MARGIN) * 0.15

def add_major_section(text):
    return [
        CondPageBreak(H1_ORPHAN_THRESHOLD),
        add_heading(text, h1_style, level=0),
    ]

def make_table(data, col_widths, caption_text=None):
    """Create a styled table with standard colors."""
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_commands = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ]
    # Alternating row colors
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_commands.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_commands))
    
    elements = [Spacer(1, 18), t]
    if caption_text:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(caption_text, caption_style))
    elements.append(Spacer(1, 18))
    return elements

def score_badge(score, max_score=10):
    """Create a colored score badge."""
    ratio = score / max_score
    if ratio >= 0.7:
        color_hex = '#16a34a'
    elif ratio >= 0.5:
        color_hex = '#d97706'
    else:
        color_hex = '#dc2626'
    return f'<font color="{color_hex}"><b>{score}/{max_score}</b></font>'

def critical_box(text):
    """Red-bordered critical finding box."""
    return Paragraph(
        f'<font color="#dc2626"><b>CRITIQUE :</b></font> {text}',
        ParagraphStyle('CriticalBox', parent=body_left_style, leftIndent=16,
                       borderWidth=1, borderColor=colors.HexColor('#dc2626'),
                       borderPadding=8, backColor=colors.HexColor('#fef2f2'))
    )

def warning_box(text):
    """Amber-bordered warning finding box."""
    return Paragraph(
        f'<font color="#d97706"><b>ATTENTION :</b></font> {text}',
        ParagraphStyle('WarningBox', parent=body_left_style, leftIndent=16,
                       borderWidth=1, borderColor=colors.HexColor('#d97706'),
                       borderPadding=8, backColor=colors.HexColor('#fffbeb'))
    )

def success_box(text):
    """Green-bordered positive finding box."""
    return Paragraph(
        f'<font color="#16a34a"><b>POINT FORT :</b></font> {text}',
        ParagraphStyle('SuccessBox', parent=body_left_style, leftIndent=16,
                       borderWidth=1, borderColor=colors.HexColor('#16a34a'),
                       borderPadding=8, backColor=colors.HexColor('#f0fdf4'))
    )

# ── Build Document ──
output_path = '/home/z/my-project/download/kfm-delice-audit-body.pdf'

doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN
)

story = []

# ━━━ TABLE OF CONTENTS ━━━
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='LiberationSerif', fontSize=12, leading=20, leftIndent=20, textColor=TEXT_PRIMARY),
    ParagraphStyle('TOC2', fontName='LiberationSerif', fontSize=10, leading=16, leftIndent=40, textColor=TEXT_MUTED),
]
story.append(Paragraph('<b>Table des Matieres</b>', title_style))
story.append(Spacer(1, 12))
story.append(toc)
story.append(PageBreak())

# ━━━ 1. RESUME EXECUTIF ━━━
story.extend(add_major_section('1. Resume Executif'))

story.append(Paragraph(
    "Ce rapport presente l'audit technique complet de l'application KFM Delice, une plateforme de commande "
    "de repas en ligne destinee au marche guineen. L'audit couvre sept dimensions critiques : l'architecture "
    "globale, la securite, l'experience utilisateur, les fonctionnalites, la qualite du code, la performance "
    "et la maintenabilite. Chaque dimension est evaluee sur une echelle de 10 points, avec une analyse "
    "detaillee des forces, des faiblesses et des recommandations actionnables.",
    body_style
))

story.append(Spacer(1, 12))

# Global scores table
scores_data = [
    [Paragraph('<b>Categorie</b>', th_style), Paragraph('<b>Score</b>', th_style), Paragraph('<b>Appreciation</b>', th_style)],
    [Paragraph('Architecture Globale', td_style), Paragraph(score_badge(7), td_center_style), Paragraph('Solide mais monolithique', td_style)],
    [Paragraph('Securite', td_style), Paragraph(score_badge(5), td_center_style), Paragraph('Insuffisant pour la production', td_style)],
    [Paragraph('Experience Utilisateur', td_style), Paragraph(score_badge(8), td_center_style), Paragraph('Tres bonne, moderne et fluide', td_style)],
    [Paragraph('Fonctionnalites', td_style), Paragraph(score_badge(8), td_center_style), Paragraph('Riche et bien couverte', td_style)],
    [Paragraph('Qualite du Code', td_style), Paragraph(score_badge(6), td_center_style), Paragraph('Acceptable mais manque de rigueur', td_style)],
    [Paragraph('Performance', td_style), Paragraph(score_badge(6), td_center_style), Paragraph('Polling excessif, pas de WebSocket', td_style)],
    [Paragraph('Maintenabilite', td_style), Paragraph(score_badge(5), td_center_style), Paragraph('Composants monolithiques, pas de tests', td_style)],
]
col_w = [CONTENT_W * 0.35, CONTENT_W * 0.15, CONTENT_W * 0.50]
story.extend(make_table(scores_data, col_w, 'Tableau 1 : Synthese des scores par categorie'))

story.append(Spacer(1, 12))
story.append(Paragraph(
    '<b>SCORE GLOBAL : 6.4 / 10</b> - Prototype avance, pas encore production-ready. '
    'Lapplication presente une base fonctionnelle solide avec une experience utilisateur remarquable, '
    'mais des lacunes significatives en securite et maintenabilite bloquent le passage en production.',
    callout_style
))

# Radar chart
radar_img_path = '/home/z/my-project/download/radar_chart.png'
if os.path.exists(radar_img_path):
    story.append(Spacer(1, 12))
    img = Image(radar_img_path, width=CONTENT_W * 0.65, height=CONTENT_W * 0.65)
    img.hAlign = 'CENTER'
    story.append(img)
    story.append(Paragraph('Figure 1 : Visualisation radar des scores par categorie', caption_style))

# ━━━ 2. ARCHITECTURE GLOBALE (7/10) ━━━
story.extend(add_major_section('2. Architecture Globale - 7/10'))

story.append(Paragraph(
    "L'architecture de KFM Delice repose sur Next.js 16 avec App Router, Prisma ORM et SQLite. "
    "L'ensemble de l'application est organisee en un depot monolithique comprenant les pages, les composants, "
    "les routes API et la logique metier. Cette approche facilite le developpement rapide et le deploiement "
    "simple, mais elle introduit des limites structurelles qui deviendront problematiques a mesure que "
    "l'application evolue et que le volume de donnees augmente.",
    body_style
))

story.append(add_heading('2.1 Structure du projet', h2_style, level=1))

story.append(Paragraph(
    "Le projet suit la convention Next.js App Router avec les repertoires standards : "
    "<font name='DejaVuSans'>src/app/</font> pour les pages et routes API, "
    "<font name='DejaVuSans'>src/components/</font> pour les composants React organises par role "
    "(admin, customer, driver, ui), et <font name='DejaVuSans'>src/lib/</font> pour la logique partagee. "
    "L'application compte 26 routes API, 68 gestionnaires de methodes HTTP, et des dashboards distincts "
    "pour les trois types d'utilisateurs (admin, client, livreur). La base de donnees SQLite contient "
    "13 modeles Prisma avec des relations hierarchiques centrees sur l'entite Restaurant.",
    body_style
))

story.append(add_heading('2.2 Points forts', h2_style, level=1))

story.append(success_box(
    "Separation claire des roles utilisateur avec des dashboards dedies (admin 15 onglets, "
    "client 7 onglets, livreur 4 onglets). L'architecture des routes API est coherente avec "
    "des endpoints RESTful bien structures et une couverture CRUD complete pour chaque entite."
))
story.append(success_box(
    "Utilisation moderne de Next.js App Router avec server components et streaming. "
    "Les 26 routes API couvrent l'ensemble du cycle de vie metier avec une authentification "
    "JWT et un controle d'acces base sur les roles (admin, manager, staff, customer, driver)."
))

story.append(add_heading('2.3 Faiblesses identifiees', h2_style, level=1))

story.append(Paragraph(
    "<b>Absence de couche service :</b> Les routes API interrogent directement Prisma sans couche "
    "de service intermediaire. Cela signifie que la logique metier (calcul de prix, gestion des statuts, "
    "regles de validation) est dispersee dans les handlers API plutot que centralisee. Toute modification "
    "de regle metier necessite de retrouver et modifier chaque endpoint concerne, avec un risque eleve "
    "de regression et d'incoherence.",
    body_style
))

story.append(Paragraph(
    "<b>Monolithe unique :</b> L'ensemble de l'application (front-end, back-end, base de donnees) "
    "est contenu dans un seul depot et un seul processus. Si l'API de paiement ou le service de "
    "notification rencontre un probleme, l'integralite de l'application est impactee. Il n'existe "
    "aucune possibilite de mise a l'echelle independante des differents modules.",
    body_style
))

story.append(Paragraph(
    "<b>Hypothese mono-restaurant :</b> Le schema Prisma et le code utilisent systematiquement "
    "<font name='DejaVuSans'>db.restaurant.findFirst()</font> pour recuperer le restaurant, "
    "ce qui suppose l'existence d'un seul etablissement. Cette conception rend impossible "
    "le support multi-enseignes sans refonte majeure du schema et de la logique applicative.",
    body_style
))

story.append(Paragraph(
    "<b>Base de donnees SQLite :</b> SQLite ne supporte pas les ecritures concurrentes, la recherche "
    "en texte integral native, ni les requetes complexes sur de grands volumes. En production, avec "
    "des commandes simultanees et des requetes analytiques, SQLite deviendra un goulot d'etranglement "
    "incontournable. La migration vers PostgreSQL est indispensable.",
    body_style
))

# ━━━ 3. SECURITE (5/10) ━━━
story.extend(add_major_section('3. Securite - 5/10'))

story.append(Paragraph(
    "La securite est le point le plus critique de cet audit. Malgre des fondations solides (JWT avec jose, "
    "bcrypt pour les mots de passe, headers de securite en middleware), plusieurs vulnerabilites majeures "
    "rendent l'application impropre a un deploiement en production. Certaines de ces failles pourraient "
    "etre exploitees pour modifier des paiements, acceder a des donnees sensibles ou compromettre "
    "l'integrite du systeme.",
    body_style
))

story.append(add_heading('3.1 Vulnerabilite critique : contournement du paiement', h2_style, level=1))

story.append(critical_box(
    "La route <font name='DejaVuSans'>/api/payment</font> accepte un parametre "
    "<font name='DejaVuSans'>webhook=true</font> qui contourne completement l'authentification. "
    "N'importe quel utilisateur peut envoyer une requete PATCH avec <font name='DejaVuSans'>"
    "{ webhook: true, id: '...', status: 'paid' }</font> pour marquer n'importe quel paiement comme "
    "paye sans authentification. Cette faille permet a un client malveillant de valider ses propres "
    "commandes sans payer."
))

story.append(Paragraph(
    "Le code source dans <font name='DejaVuSans'>src/app/api/payment/route.ts</font> (lignes 352-353) "
    "verifie si le parametre webhook est present et, le cas echeant, saute entierement la verification "
    "d'authentification admin. La solution correcte est d'utiliser une signature HMAC ou un secret "
    "partage entre le webhook du fournisseur de paiement et l'API, plutot qu'un simple drapeau "
    "dans le corps de la requete.",
    body_style
))

story.append(add_heading('3.2 Vulnerabilites de niveau moyen', h2_style, level=1))

story.append(warning_box(
    "Modification du mot de passe admin sans verification de l'ancien mot de passe. "
    "Dans <font name='DejaVuSans'>src/app/api/admins/route.ts</font> (lignes 90-98), un administrateur "
    "peut changer son mot de passe sans fournir le mot de passe actuel. Contrairement aux clients "
    "qui doivent fournir <font name='DejaVuSans'>currentPassword</font>, les administrateurs n'ont "
    "aucune verification. Si un attaquant obtient un token JWT admin, il peut verrouiller "
    "definitivement l'acces de l'administrateur legitime."
))

story.append(warning_box(
    "Endpoint de seed accessible sans authentification lorsqu'aucun admin n'existe. "
    "Sur un deploiement frais, un attaquant pourrait creer un administrateur avant le proprietaire "
    "legitime et prendre le controle total de l'application."
))

story.append(warning_box(
    "Rate limiting en memoire uniquement. Les compteurs de limitation de debit sont stockes en "
    "memoire et reinitialises a chaque redemarrage du serveur. Dans un deploiement multi-instance, "
    "chaque instance maintient ses propres compteurs, ce qui multiplie le debit autorise par le "
    "nombre d'instances. La migration vers Redis ou un store partage est necessaire."
))

story.append(add_heading('3.3 Points forts de securite', h2_style, level=1))

story.append(success_box(
    "Verification JWT via jose (compatible Edge Runtime) dans le middleware avec injection "
    "des informations utilisateur via les headers de requete (x-user-id, x-user-type, x-user-role). "
    "Les headers de securite sont appliques sur toutes les reponses : X-Content-Type-Options, "
    "X-Frame-Options: DENY, X-XSS-Protection, Referrer-Policy, Permissions-Policy et CSP en production."
))

story.append(success_box(
    "Validation Zod exhaustive : plus de 30 schemas couvrent l'ensemble des entrees (cote client et serveur). "
    "Verification des prix cote serveur pour les commandes, empechant la manipulation client-side des tarifs. "
    "Hachage bcrypt des mots de passe avec rate limiting sur les routes d'authentification (10 req/min)."
))

# ━━━ 4. EXPERIENCE UTILISATEUR (8/10) ━━━
story.extend(add_major_section('4. Experience Utilisateur - 8/10'))

story.append(Paragraph(
    "L'experience utilisateur est l'un des points forts de l'application. L'interface est moderne, fluide "
    "et bien pensee, avec une navigation intuitive, un design responsive et des retours visuels appropriés. "
    "L'utilisation de shadcn/ui et de Tailwind CSS confere a l'application un aspect professionnel et "
    "coherent a travers toutes les pages. Les transitions sont douces, les formulaires sont bien structures "
    "et les etats de chargement sont generalement bien geres.",
    body_style
))

story.append(add_heading('4.1 Points forts UX', h2_style, level=1))

story.append(success_box(
    "Design responsive complet avec breakpoints Tailwind sur 30+ composants. Le dashboard admin "
    "s'adapte parfaitement du mobile au desktop avec des grilles dynamiques. Le mode sombre est "
    "implemente nativement avec next-themes, detection des preferences systeme et toggle sur "
    "chaque dashboard."
))

story.append(success_box(
    "Systeme de notification multi-couches : toast Sonner avec 30+ helpers types, "
    "WebSocket temps reel avec heartbeat et reconnexion exponentielle, notifications push "
    "VAPID via service worker, et polling de fallback toutes les 30 secondes pour les statistiques admin."
))

story.append(success_box(
    "Etats vides bien geres : 19+ composants affichent des messages contextuels lorsqu'aucune "
    "donnee n'est disponible (Aucun client trouve, Aucun livreur, Aucun avis, etc.). "
    "Le cycle de vie complet des commandes est visualisable avec une timeline de statut claire."
))

story.append(add_heading('4.2 Lacunes identifiees', h2_style, level=1))

story.append(Paragraph(
    "<b>Absence de pages d'erreur :</b> Aucun fichier <font name='DejaVuSans'>error.tsx</font> "
    "n'existe dans l'application. Les erreurs runtime affichent la page d'erreur par defaut de Next.js, "
    "qui est en anglais et sans mise en page coherente avec le reste de l'application. De meme, "
    "aucun <font name='DejaVuSans'>not-found.tsx</font> n'est defini pour les erreurs 404. "
    "Cette lacune degrade significativement l'experience en cas de probleme technique.",
    body_style
))

story.append(Paragraph(
    "<b>Gestion des erreurs API silencieuse :</b> Le hook <font name='DejaVuSans'>useAdminData</font> "
    "effectue 13 appels API en parallele au montage du composant. Si ces appels echouent, les erreurs "
    "sont logguees en console mais aucun message utilisateur n'est affiche. L'utilisateur se retrouve "
    "face a un spinner infini sans comprehension du probleme ni possibilite d'action (reessayer, "
    "recharger, contacter le support).",
    body_style
))

story.append(Paragraph(
    "<b>Accessibilite partielle :</b> Les composants custom manquent d'attributs ARIA (le bouton WhatsApp "
    "n'a pas de aria-label, les toggles de statut driver n'ont pas de aria-pressed, les elements de "
    "sidebar n'ont pas de aria-current). Il n'existe pas de lien de navigation skip-to-content pour "
    "les utilisateurs de lecteurs d'ecran, et la gestion du focus dans les modales est absente.",
    body_style
))

story.append(Paragraph(
    "<b>Absence d'internationalisation :</b> L'interface est entierement en francais sans possibilite "
    "de changement de langue. Aucune bibliotheque i18n, aucun fichier de traduction, aucun mecanisme "
    "de changement de locale n'est implemente. Pour un marche en expansion en Afrique de l'Ouest, "
    "le support multilingue (anglais, langues locales) serait un avantage competitif.",
    body_style
))

# ━━━ 5. FONCTIONNALITES (8/10) ━━━
story.extend(add_major_section('5. Fonctionnalites - 8/10'))

story.append(Paragraph(
    "KFM Delice offre une couverture fonctionnelle remarquable pour une application a ce stade de "
    "developpement. Le cycle de vie complet des commandes est implemente, de la creation par le client "
    "jusqu'a la livraison par le driver, en passant par la preparation en cuisine et le paiement. "
    "Les 26 routes API et 68 gestionnaires HTTP couvrent l'ensemble des operations CRUD necessaires "
    "pour chaque entite metier.",
    body_style
))

story.append(add_heading('5.1 Cycle de vie des commandes', h2_style, level=1))

# Order lifecycle table
lifecycle_data = [
    [Paragraph('<b>Etape</b>', th_style), Paragraph('<b>Statut</b>', th_style), Paragraph('<b>Acteur</b>', th_style), Paragraph('<b>Implementation</b>', th_style)],
    [Paragraph('Creation', td_style), Paragraph('pending', td_center_style), Paragraph('Client / Public', td_style), Paragraph('Complete', td_center_style)],
    [Paragraph('Confirmation', td_style), Paragraph('confirmed', td_center_style), Paragraph('Admin / Manager', td_style), Paragraph('Complete', td_center_style)],
    [Paragraph('Preparation', td_style), Paragraph('preparing', td_center_style), Paragraph('Admin / Manager', td_style), Paragraph('Complete', td_center_style)],
    [Paragraph('Pret', td_style), Paragraph('ready', td_center_style), Paragraph('Admin / Manager', td_style), Paragraph('Complete', td_center_style)],
    [Paragraph('Prise en charge', td_style), Paragraph('picking_up', td_center_style), Paragraph('Driver', td_style), Paragraph('Complete', td_center_style)],
    [Paragraph('En livraison', td_style), Paragraph('delivering', td_center_style), Paragraph('Driver', td_style), Paragraph('Complete', td_center_style)],
    [Paragraph('Livre', td_style), Paragraph('delivered', td_center_style), Paragraph('Driver', td_style), Paragraph('Complete', td_center_style)],
    [Paragraph('Paiement', td_style), Paragraph('paid', td_center_style), Paragraph('Client', td_style), Paragraph('Simule', td_center_style)],
    [Paragraph('Annulation', td_style), Paragraph('cancelled', td_center_style), Paragraph('Admin', td_style), Paragraph('Complete', td_center_style)],
]
col_lw = [CONTENT_W * 0.22, CONTENT_W * 0.18, CONTENT_W * 0.25, CONTENT_W * 0.15]
story.extend(make_table(lifecycle_data, col_lw, 'Tableau 2 : Cycle de vie complet des commandes'))

story.append(add_heading('5.2 Fonctionnalites implementees', h2_style, level=1))

story.append(Paragraph(
    "Le dashboard administrateur comprend 15 onglets couvrant l'ensemble de la gestion : vue d'ensemble "
    "avec KPIs et graphiques, gestion des reservations, commandes, menu (avec upload d'images et optimisation "
    "sharp), livraisons avec suivi en temps reel, livreurs, avis clients, personnel, clients, administrateurs, "
    "factures (avec calcul de taxes), devis (avec workflow de statut et remises), depenses, paiements "
    "(avec filtre par methode), et point de vente (POS) complet avec panier et checkout. Le dashboard client "
    "offre 7 onglets et le dashboard livreur 4 onglets, chacun avec des fonctionnalites dediees.",
    body_style
))

story.append(add_heading('5.3 Fonctionnalites manquantes', h2_style, level=1))

missing_data = [
    [Paragraph('<b>Fonctionnalite</b>', th_style), Paragraph('<b>Priorite</b>', th_style), Paragraph('<b>Impact</b>', th_style)],
    [Paragraph('Integration Orange Money / MTN Money reelle', td_style), Paragraph('Critique', td_center_style), Paragraph('Paiements actuellement simules avec Math.random()', td_style)],
    [Paragraph('Export PDF des factures et CSV des rapports', td_style), Paragraph('Haute', td_center_style), Paragraph('Impossible de generer des documents comptables', td_style)],
    [Paragraph('Annulation de commande par le client', td_style), Paragraph('Haute', td_center_style), Paragraph('Seul l\'admin peut annuler, frustration client', td_style)],
    [Paragraph('Parametres restaurant (UI d\'edition)', td_style), Paragraph('Moyenne', td_center_style), Paragraph('Informations modifiables uniquement via seed/DB', td_style)],
    [Paragraph('Redemption des points de fidelite', td_style), Paragraph('Moyenne', td_center_style), Paragraph('Programme de fidelite affichage uniquement', td_style)],
    [Paragraph('Carnet d\'adresses de livraison', td_style), Paragraph('Moyenne', td_style), Paragraph('Saisie manuelle a chaque commande', td_style)],
    [Paragraph('Journal d\'audit (AuditLog)', td_style), Paragraph('Haute', td_center_style), Paragraph('Aucune trace de qui a modifie quoi et quand', td_style)],
    [Paragraph('Carte interactive (Leaflet/Mapbox)', td_style), Paragraph('Basse', td_center_style), Paragraph('DriverMapTab existe sans rendu de carte reel', td_style)],
    [Paragraph('Chat admin-client-livreur', td_style), Paragraph('Basse', td_center_style), Paragraph('Communication uniquement par WhatsApp externe', td_style)],
]
col_mw = [CONTENT_W * 0.40, CONTENT_W * 0.12, CONTENT_W * 0.48]
story.extend(make_table(missing_data, col_mw, 'Tableau 3 : Fonctionnalites manquantes identifiees'))

story.append(add_heading('5.4 Paiements simules', h2_style, level=1))

story.append(warning_box(
    "Les integrations Orange Money et MTN Money sont entierement simulees. Le code utilise "
    "<font name='DejaVuSans'>Math.random()</font> pour determiner le succes ou l'echec des paiements "
    "(95% de taux de succes simule), avec un delai artificiel de 2 secondes. Le flux OTP retourne "
    "<font name='DejaVuSans'>otpRequired: true</font> sans verification reelle. La mise en production "
    "requiert le remplacement de ces simulations par les veritables API des operateurs mobile money."
))

# ━━━ 6. QUALITE DU CODE (6/10) ━━━
story.extend(add_major_section('6. Qualite du Code - 6/10'))

story.append(Paragraph(
    "La qualite du code est acceptable pour un prototype avance mais manque de rigueur sur plusieurs "
    "aspects critiques. L'utilisation de TypeScript est systematique mais la discipline de typage est "
    "insuffisante, avec de nombreuses occurrences de types permissifs et de conversions implicites. "
    "La gestion des erreurs est inegale, oscillant entre des patterns robustes (Zod, try/catch dans les "
    "API routes) et des silences dangereux (erreurs avalees dans les hooks sans feedback utilisateur).",
    body_style
))

story.append(add_heading('6.1 Typage TypeScript', h2_style, level=1))

story.append(Paragraph(
    "Le fichier <font name='DejaVuSans'>tsconfig.json</font> ne active pas les options de "
    "verification les plus strictes. L'utilisation du type <font name='DejaVuSans'>any</font> "
    "est repandue dans les composants et les hooks, notamment dans les reponses API et les "
    "gestionnaires d'evenements. Cette permissivite masque des erreurs potentielles a la compilation "
    "et rend le refactoring risqure. L'activation progressive de <font name='DejaVuSans'>strict: true</font> "
    "dans tsconfig.json, accompagnee de la correction des erreurs resultantees, serait un premier "
    "pas essentiel.",
    body_style
))

story.append(add_heading('6.2 Validation des donnees', h2_style, level=1))

story.append(success_box(
    "La validation Zod est exhaustive et coherente : 30+ schemas couvrent toutes les entrees, "
    "avec validation a la fois cote client et cote serveur. Chaque route API utilise "
    "<font name='DejaVuSans'>safeParse()</font> avant tout traitement, et les schemas PATCH "
    "sont definis separement des schemas de creation pour permettre les mises a jour partielles. "
    "C'est l'un des points les plus solides du codebase."
))

story.append(add_heading('6.3 Gestion des erreurs', h2_style, level=1))

story.append(Paragraph(
    "La gestion des erreurs presente un contraste marque entre les API routes et les composants frontend. "
    "Cote serveur, chaque route API encapsule sa logique dans un bloc try/catch avec des reponses "
    "d'erreur structurees en francais. Cote client, en revanche, le hook <font name='DejaVuSans'>"
    "useAdminData</font> capture les erreurs via <font name='DejaVuSans'>console.error</font> "
    "sans les exposer a l'utilisateur. Si les 13 appels API paralleles echouent simultanement, "
    "l'utilisateur est confronte a un spinner permanent sans aucune indication du probleme ni "
    "moyen de relancer les requetes.",
    body_style
))

story.append(add_heading('6.4 Duplication de code', h2_style, level=1))

story.append(Paragraph(
    "Des patterns de code similaires se repetent a travers les composants d'onglets admin : "
    "la structure de tableau avec pagination, les modales de creation/edition, les filtres de recherche, "
    "et les appels API CRUD suivent tous le meme modele mais sont reimplémentes a chaque fois. "
    "L'extraction de composants generiques (DataTable, CrudModal, SearchFilter) reduirait "
    "significativement la duplication et faciliterait l'ajout de nouvelles entites. On estime "
    "qu'environ 40% du code des onglets admin pourrait etre factorise dans des composants partages.",
    body_style
))

# ━━━ 7. PERFORMANCE (6/10) ━━━
story.extend(add_major_section('7. Performance - 6/10'))

story.append(Paragraph(
    "La performance est un domaine a ameliorer pour atteindre le niveau production. L'application "
    "presente plusieurs anti-patterns qui degradent les temps de reponse et la consommation de "
    "ressources, notamment le chargement massif de donnees au montage des composants et le recours "
    "au polling plutot qu'aux mises a jour temps reel via WebSocket. Malgre l'existence d'une "
    "infrastructure WebSocket fonctionnelle, elle n'est pas utilisee de maniere optimale.",
    body_style
))

story.append(add_heading('7.1 Chargement massif de donnees', h2_style, level=1))

story.append(critical_box(
    "Le hook <font name='DejaVuSans'>useAdminData</font> charge 1000 items par entite "
    "pour 13 entites differentes au montage du dashboard admin, soit potentiellement 13 000 "
    "enregistrements charges simultanement. Ce pattern provoque des temps de chargement "
    "initiaux excessifs et une consommation memoire injustifiee. La pagination cote serveur "
    "avec des tailles de page raisonnables (20-50 items) est indispensable."
))

story.append(add_heading('7.2 Polling vs WebSocket', h2_style, level=1))

story.append(Paragraph(
    "L'application dispose d'une infrastructure WebSocket complete (serveur sur port 3001, hook "
    "<font name='DejaVuSans'>useWebSocket</font> avec reconnexion exponentielle et heartbeat), "
    "mais le dashboard admin continue d'utiliser un polling HTTP toutes les 30 secondes pour les "
    "statistiques. Cette approche genere un trafic reseau inutile et des latences de mise a jour "
    "allant jusqu'a 30 secondes. La migration vers une architecture pilotee par evenements via "
    "WebSocket pour les mises a jour temps reel (nouvelles commandes, changements de statut, "
    "positions des livreurs) est essentielle.",
    body_style
))

story.append(add_heading('7.3 Absence de pagination cote serveur', h2_style, level=1))

story.append(Paragraph(
    "Les routes API de liste (<font name='DejaVuSans'>/api/orders</font>, <font name='DejaVuSans'>"
    "/api/customers</font>, etc.) retournent l'integralite des enregistrements sans pagination. "
    "Le parametre <font name='DejaVuSans'>take: 1000</font> est utilise comme limite artificielle "
    "dans les requetes Prisma, mais il ne s'agit pas d'une veritable pagination. L'absence de "
    "parametres <font name='DejaVuSans'>skip</font>, <font name='DejaVuSans'>cursor</font> et "
    "<font name='DejaVuSans'>orderBy</font> cote serveur oblige le client a charger et filtrer "
    "de grands volumes de donnees inutilement.",
    body_style
))

story.append(add_heading('7.4 Optimisations absentes', h2_style, level=1))

perf_data = [
    [Paragraph('<b>Optimisation</b>', th_style), Paragraph('<b>Statut actuel</b>', th_style), Paragraph('<b>Impact attendu</b>', th_style)],
    [Paragraph('Pagination cote serveur', td_style), Paragraph('Absente (take: 1000)', td_style), Paragraph('Reduction de 95% du volume de donnees transferees', td_style)],
    [Paragraph('Mise en cache (SWR/React Query)', td_style), Paragraph('Absente', td_style), Paragraph('Elimination des rechargements inutiles', td_style)],
    [Paragraph('Lazy loading des onglets admin', td_style), Paragraph('Tous charges au montage', td_style), Paragraph('Temps de chargement initial divise par 3-5', td_style)],
    [Paragraph('React.memo / useMemo', td_style), Paragraph('Rarement utilise', td_style), Paragraph('Reduction des re-rendus inutiles', td_style)],
    [Paragraph('Server Components (RSC)', td_style), Paragraph('Usage minimal', td_style), Paragraph('Reduction du bundle JavaScript client', td_style)],
    [Paragraph('Compression des images', td_style), Paragraph('Sharp implemente', td_style), Paragraph('Deja en place', td_style)],
]
col_pw = [CONTENT_W * 0.35, CONTENT_W * 0.28, CONTENT_W * 0.37]
story.extend(make_table(perf_data, col_pw, 'Tableau 4 : Optimisations de performance identifiees'))

# ━━━ 8. MAINTENABILITE (5/10) ━━━
story.extend(add_major_section('8. Maintenabilite - 5/10'))

story.append(Paragraph(
    "La maintenabilite est le point faible de l'application, a egalite avec la securite. L'absence "
    "de tests automatises, la taille excessive de certains composants, l'absence de documentation "
    "technique et le manque de separation des responsabilites rendent les evolutions et les corrections "
    "de bugs de plus en plus couteuses et risquees au fil du temps. Ce score de 5/10 signifie que "
    "chaque modification du code a un risque significatif de regression non detectee.",
    body_style
))

story.append(add_heading('8.1 Absence de tests automatises', h2_style, level=1))

story.append(critical_box(
    "Malgre l'existence de 12 fichiers de test dans <font name='DejaVuSans'>src/__tests__/</font>, "
    "la couverture de test est largement insuffisante. Les tests existants couvrent principalement "
    "la validation, l'authentification, la pagination et le rate limiting, mais aucune route API "
    "complete n'est testee de bout en bout. Il n'y a aucun test d'integration, aucun test E2E, "
    "et aucun test de composant React. Le ratio code de test / code applicatif est estime a "
    "moins de 5%."
))

story.append(Paragraph(
    "Le framework de test Vitest est configure, ce qui est positif, mais l'absence de tests pour "
    "les composants React (pas de React Testing Library) et pour les flux critiques (cycle de vie "
    "d'une commande, processus de paiement, gestion des sessions) signifie que toute modification "
    "du code peut introduire des regressions sans qu'aucun test ne les detecte. La mise en place "
    "d'une pipeline CI/CD avec des seuils de couverture minimum (80% pour les routes API, 60% "
    "pour les composants) est indispensable.",
    body_style
))

story.append(add_heading('8.2 Composants monolithiques', h2_style, level=1))

story.append(Paragraph(
    "Plusieurs composants depassent largement la taille recommandee de 300 lignes. Le composant "
    "<font name='DejaVuSans'>AdminDashboard.tsx</font> agit comme un routeur d'onglets qui importe "
    "et orchestre 15 sous-composants. Certains onglets (OrdersTab, MenuTab) contiennent a la fois "
    "la logique de recuperation de donnees, la logique de presentation et les modales d'edition "
    "dans un seul fichier. La separation entre composants de presentation (UI pure) et composants "
    "conteneurs (logique de donnees) n'est pas respectee, ce qui rend les composants difficiles "
    "a tester, reutiliser et maintenir.",
    body_style
))

story.append(add_heading('8.3 Relations en chaine de caracteres', h2_style, level=1))

story.append(warning_box(
    "Les commandes, reservations et avis sont lies aux clients par <font name='DejaVuSans'>"
    "customerName</font> (chaine de caracteres) et non par <font name='DejaVuSans'>customerId</font> "
    "(cle etrangere). Cette conception viole les principes fondamentaux des bases de donnees "
    "relationnelles et cree des risques d'integrite : deux clients homonymes provoquent des "
    "conflits, un changement de nom d'un client rompt ses liens avec ses commandes, et les "
    "requetes par client necessitent des recherches textuelles couteuses et imprecises."
))

story.append(add_heading('8.4 Absence de journal d\'audit', h2_style, level=1))

story.append(Paragraph(
    "Il n'existe aucun mecanisme de journalisation des actions administratives. Aucune trace "
    "n'est conservee de qui a modifie quelles donnees et quand. En cas de probleme (donnees "
    "corrompues, modification abusive, erreur de manipulation), il est impossible de determiner "
    "la cause ou de restaurer l'etat anterieur. Le schema Prisma ne contient pas de modele "
    "AuditLog, et aucune logique de traabilite n'est implementee dans les routes API. Pour une "
    "application de restauration gerant des paiements et des donnees clients, cette lacune "
    "est un risque juridique et operationnel majeur.",
    body_style
))

# ━━━ 9. FEUILLE DE ROUTE VERS LA PRODUCTION ━━━
story.extend(add_major_section('9. Feuille de Route vers la Production'))

story.append(Paragraph(
    "Le passage de prototype avance a application production-ready necessite un effort structure "
    "sur plusieurs phases. Les recommandations ci-dessous sont classees par priorite et estimees "
    "en semaines-homme de travail. L'ordre propose respecte les dependances entre les taches et "
    "maximise l'impact de chaque phase sur la qualite globale du produit.",
    body_style
))

story.append(add_heading('9.1 Phase 1 : Securite critique (2 semaines)', h2_style, level=1))

p1_data = [
    [Paragraph('<b>Tache</b>', th_style), Paragraph('<b>Description</b>', th_style), Paragraph('<b>Effort</b>', th_style)],
    [Paragraph('Corriger le contournement webhook', td_style), Paragraph('Remplacer le flag webhook par une signature HMAC avec secret partage', td_style), Paragraph('2 jours', td_center_style)],
    [Paragraph('Verification mot de passe admin', td_style), Paragraph('Ajouter currentPassword obligatoire pour les modifications admin', td_style), Paragraph('0.5 jour', td_center_style)],
    [Paragraph('Protection de l\'endpoint seed', td_style), Paragraph('Desactiver en production ou proteger par un token d\'initialisation', td_style), Paragraph('0.5 jour', td_center_style)],
    [Paragraph('Rate limiting persistant', td_style), Paragraph('Migrer les compteurs vers Redis ou Upstash', td_style), Paragraph('1 jour', td_center_style)],
    [Paragraph('Migration vers PostgreSQL', td_style), Paragraph('Remplacer SQLite par PostgreSQL avec les memes schemas Prisma', td_style), Paragraph('3 jours', td_center_style)],
    [Paragraph('Correction des relations client', td_style), Paragraph('Remplacer customerName par customerId (cle etrangere)', td_style), Paragraph('3 jours', td_center_style)],
]
col_p1w = [CONTENT_W * 0.30, CONTENT_W * 0.55, CONTENT_W * 0.15]
story.extend(make_table(p1_data, col_p1w, 'Tableau 5 : Phase 1 - Securite critique'))

story.append(add_heading('9.2 Phase 2 : Performance et stabilite (2 semaines)', h2_style, level=1))

p2_data = [
    [Paragraph('<b>Tache</b>', th_style), Paragraph('<b>Description</b>', th_style), Paragraph('<b>Effort</b>', th_style)],
    [Paragraph('Pagination cote serveur', td_style), Paragraph('Implementer skip/take/cursor sur toutes les routes de liste', td_style), Paragraph('3 jours', td_center_style)],
    [Paragraph('Migration WebSocket', td_style), Paragraph('Remplacer le polling admin par les evenements WebSocket', td_style), Paragraph('2 jours', td_center_style)],
    [Paragraph('Lazy loading des onglets', td_style), Paragraph('Charger chaque onglet admin uniquement quand il est actif', td_style), Paragraph('1 jour', td_center_style)],
    [Paragraph('Pages d\'erreur custom', td_style), Paragraph('Ajouter error.tsx et not-found.tsx pour chaque section', td_style), Paragraph('1 jour', td_center_style)],
    [Paragraph('Gestion erreurs API frontend', td_style), Paragraph('Afficher des messages d\'erreur et boutons retry', td_style), Paragraph('2 jours', td_center_style)],
    [Paragraph('SWR / React Query', td_style), Paragraph('Remplacer les fetch manuels par un cache intelligent', td_style), Paragraph('3 jours', td_center_style)],
]
col_p2w = [CONTENT_W * 0.30, CONTENT_W * 0.55, CONTENT_W * 0.15]
story.extend(make_table(p2_data, col_p2w, 'Tableau 6 : Phase 2 - Performance et stabilite'))

story.append(add_heading('9.3 Phase 3 : Maintenabilite et qualite (3 semaines)', h2_style, level=1))

p3_data = [
    [Paragraph('<b>Tache</b>', th_style), Paragraph('<b>Description</b>', th_style), Paragraph('<b>Effort</b>', th_style)],
    [Paragraph('Tests d\'integration API', td_style), Paragraph('Couverture 80% minimum sur les routes critiques', td_style), Paragraph('5 jours', td_center_style)],
    [Paragraph('Tests de composants React', td_style), Paragraph('React Testing Library sur les composants principaux', td_style), Paragraph('3 jours', td_center_style)],
    [Paragraph('Refactoring composants admin', td_style), Paragraph('Extraire DataTable, CrudModal, SearchFilter generiques', td_style), Paragraph('3 jours', td_center_style)],
    [Paragraph('TypeScript strict', td_style), Paragraph('Activer strict: true et corriger les erreurs', td_style), Paragraph('2 jours', td_center_style)],
    [Paragraph('Journal d\'audit', td_style), Paragraph('Modele AuditLog + middleware de traabilite', td_style), Paragraph('2 jours', td_center_style)],
    [Paragraph('CI/CD avec seuils de couverture', td_style), Paragraph('Pipeline GitHub Actions avec tests et deploiement', td_style), Paragraph('2 jours', td_center_style)],
]
col_p3w = [CONTENT_W * 0.30, CONTENT_W * 0.55, CONTENT_W * 0.15]
story.extend(make_table(p3_data, col_p3w, 'Tableau 7 : Phase 3 - Maintenabilite et qualite'))

story.append(add_heading('9.4 Phase 4 : Fonctionnalites production (4 semaines)', h2_style, level=1))

p4_data = [
    [Paragraph('<b>Tache</b>', th_style), Paragraph('<b>Description</b>', th_style), Paragraph('<b>Effort</b>', th_style)],
    [Paragraph('Integration Orange Money reelle', td_style), Paragraph('API Orange Money CI avec gestion OTP et callback', td_style), Paragraph('5 jours', td_center_style)],
    [Paragraph('Integration MTN Money reelle', td_style), Paragraph('API MTN MoMo avec token et notification', td_style), Paragraph('5 jours', td_center_style)],
    [Paragraph('Export PDF factures', td_style), Paragraph('Generation PDF des factures avec ReportLab', td_style), Paragraph('2 jours', td_center_style)],
    [Paragraph('Export CSV rapports', td_style), Paragraph('Export des donnees admin en CSV', td_style), Paragraph('1 jour', td_center_style)],
    [Paragraph('Parametres restaurant UI', td_style), Paragraph('Interface d\'edition des infos restaurant', td_style), Paragraph('1 jour', td_center_style)],
    [Paragraph('Annulation commande client', td_style), Paragraph('Permettre l\'annulation dans un delai configurable', td_style), Paragraph('1 jour', td_center_style)],
    [Paragraph('Accessibilite (ARIA)', td_style), Paragraph('Ajouter aria-labels, skip-nav, focus management', td_style), Paragraph('2 jours', td_center_style)],
    [Paragraph('Persistance PushSubscription', td_style), Paragraph('Stocker les abonnements push en base', td_style), Paragraph('1 jour', td_center_style)],
]
col_p4w = [CONTENT_W * 0.30, CONTENT_W * 0.55, CONTENT_W * 0.15]
story.extend(make_table(p4_data, col_p4w, 'Tableau 8 : Phase 4 - Fonctionnalites production'))

# ━━━ 10. CONCLUSION ━━━
story.extend(add_major_section('10. Conclusion'))

story.append(Paragraph(
    "KFM Delice est un prototype avance qui demontre une comprehension solide des besoins metier "
    "du marche guineen de la livraison de repas. L'experience utilisateur est remarquable (8/10), "
    "avec une interface moderne, responsive et bien pensee. La couverture fonctionnelle est riche "
    "(8/10), avec un cycle de vie complet des commandes et des dashboards complets pour chaque role. "
    "L'architecture (7/10) est coherente mais monolithique, et les bases technologiques (Next.js, Prisma, "
    "TypeScript) sont modernes et appropriees.",
    body_style
))

story.append(Paragraph(
    "Cependant, le passage en production est bloque par deux domaines critiques : la securite (5/10) "
    "et la maintenabilite (5/10). La vulnerabilite de contournement du paiement, les paiements simules, "
    "l'absence de tests automatises et les relations basees sur des chaines de caracteres plutot que "
    "des cles etrangeres sont des bloquants absolus. La performance (6/10) et la qualite du code (6/10) "
    "necessitent egalement des ameliorations significatives pour supporter un trafic reel.",
    body_style
))

story.append(Paragraph(
    "La feuille de route proposee en quatre phases (securite, performance, maintenabilite, fonctionnalites) "
    "represente environ 11 semaines de travail. L'execution sequentielle de ces phases permettrait "
    "de transformer KFM Delice d'un prototype avance en une application production-ready, capable de "
    "gerer des transactions financieres reelles et de servir des utilisateurs avec fiabilite et securite.",
    body_style
))

story.append(Spacer(1, 24))

# Summary score table
final_data = [
    [Paragraph('<b>Dimension</b>', th_style), Paragraph('<b>Score</b>', th_style), Paragraph('<b>Objectif Production</b>', th_style), Paragraph('<b>Ecart</b>', th_style)],
    [Paragraph('Architecture Globale', td_style), Paragraph(score_badge(7), td_center_style), Paragraph('8/10', td_center_style), Paragraph('-1', td_center_style)],
    [Paragraph('Securite', td_style), Paragraph(score_badge(5), td_center_style), Paragraph('8/10', td_center_style), Paragraph('-3', td_center_style)],
    [Paragraph('Experience Utilisateur', td_style), Paragraph(score_badge(8), td_center_style), Paragraph('8/10', td_center_style), Paragraph('0', td_center_style)],
    [Paragraph('Fonctionnalites', td_style), Paragraph(score_badge(8), td_center_style), Paragraph('9/10', td_center_style), Paragraph('-1', td_center_style)],
    [Paragraph('Qualite du Code', td_style), Paragraph(score_badge(6), td_center_style), Paragraph('8/10', td_center_style), Paragraph('-2', td_center_style)],
    [Paragraph('Performance', td_style), Paragraph(score_badge(6), td_center_style), Paragraph('8/10', td_center_style), Paragraph('-2', td_center_style)],
    [Paragraph('Maintenabilite', td_style), Paragraph(score_badge(5), td_center_style), Paragraph('8/10', td_center_style), Paragraph('-3', td_center_style)],
]
col_fw = [CONTENT_W * 0.30, CONTENT_W * 0.12, CONTENT_W * 0.28, CONTENT_W * 0.10]
# Recalculate to use full width properly
col_fw = [CONTENT_W * 0.35, CONTENT_W * 0.15, CONTENT_W * 0.30, CONTENT_W * 0.10]
story.extend(make_table(final_data, col_fw, 'Tableau 9 : Scores actuels vs objectifs production'))

# ── Build ──
doc.multiBuild(story)
print(f"Body PDF generated: {output_path}")
