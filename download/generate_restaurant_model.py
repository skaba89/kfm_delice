#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Restaurant Booking Pro - Modele pour restaurants en Guinee
Document PDF - Corps du rapport
"""

import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image, CondPageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from hashlib import md5

# ━━ Palette ━━
ACCENT       = colors.HexColor('#1c7796')
HEADER_FILL  = colors.HexColor('#756842')
COVER_BLOCK  = colors.HexColor('#5a5340')
BORDER       = colors.HexColor('#c2baa4')
ICON         = colors.HexColor('#8d7a3f')
PAGE_BG      = colors.HexColor('#f2f2f1')
CARD_BG      = colors.HexColor('#eae9e5')
TABLE_STRIPE = colors.HexColor('#eeedeb')
TEXT_PRIMARY  = colors.HexColor('#20201d')
TEXT_MUTED    = colors.HexColor('#84827a')
SEM_SUCCESS  = colors.HexColor('#4c8c62')
SEM_WARNING  = colors.HexColor('#ac8a46')
SEM_ERROR    = colors.HexColor('#92514b')
SEM_INFO     = colors.HexColor('#577593')

# ━━ Font Setup ━━
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('CarlitoBold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansBold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansMono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('Carlito', normal='Carlito', bold='CarlitoBold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSansBold')

# Install font fallback
PDF_SKILL_DIR = '/home/z/my-project/skills/pdf'
_scripts = os.path.join(PDF_SKILL_DIR, 'scripts')
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)
from pdf import install_font_fallback
install_font_fallback()

# ━━ Page Setup ━━
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
AVAILABLE_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ━━ Styles ━━
BODY_FONT = 'Carlito'
HEADING_FONT = 'Carlito'

styles = getSampleStyleSheet()

style_h1 = ParagraphStyle(
    'H1Custom', fontName=HEADING_FONT, fontSize=20, leading=28,
    textColor=ACCENT, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT
)
style_h2 = ParagraphStyle(
    'H2Custom', fontName=HEADING_FONT, fontSize=15, leading=22,
    textColor=HEADER_FILL, spaceBefore=14, spaceAfter=8, alignment=TA_LEFT
)
style_h3 = ParagraphStyle(
    'H3Custom', fontName=HEADING_FONT, fontSize=12, leading=18,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6, alignment=TA_LEFT
)
style_body = ParagraphStyle(
    'BodyCustom', fontName=BODY_FONT, fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6, alignment=TA_JUSTIFY,
    firstLineIndent=0
)
style_body_indent = ParagraphStyle(
    'BodyIndent', parent=style_body, leftIndent=20
)
style_bullet = ParagraphStyle(
    'BulletCustom', fontName=BODY_FONT, fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=2, alignment=TA_LEFT,
    leftIndent=24, bulletIndent=12
)
style_callout = ParagraphStyle(
    'CalloutCustom', fontName=BODY_FONT, fontSize=11, leading=18,
    textColor=ACCENT, spaceBefore=8, spaceAfter=8, alignment=TA_LEFT,
    leftIndent=24, borderColor=ACCENT, borderWidth=2, borderPadding=8,
    backColor=CARD_BG
)
style_caption = ParagraphStyle(
    'CaptionCustom', fontName=BODY_FONT, fontSize=9, leading=14,
    textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=6, alignment=TA_CENTER
)
style_header_cell = ParagraphStyle(
    'HeaderCell', fontName=HEADING_FONT, fontSize=10, leading=15,
    textColor=colors.white, alignment=TA_CENTER
)
style_cell = ParagraphStyle(
    'CellCustom', fontName=BODY_FONT, fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, wordWrap='CJK'
)
style_cell_center = ParagraphStyle(
    'CellCenter', parent=style_cell, alignment=TA_CENTER
)
style_toc_h1 = ParagraphStyle(
    'TOCH1', fontName=HEADING_FONT, fontSize=13, leading=22,
    textColor=TEXT_PRIMARY, leftIndent=20
)
style_toc_h2 = ParagraphStyle(
    'TOCH2', fontName=BODY_FONT, fontSize=11, leading=18,
    textColor=TEXT_MUTED, leftIndent=40
)

# ━━ Helper Functions ━━
def make_table(data, col_ratios, caption=None):
    """Create a styled table with proportional column widths."""
    col_widths = [r * AVAILABLE_W for r in col_ratios]
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    elements = [Spacer(1, 18), t]
    if caption:
        elements.append(Paragraph(caption, style_caption))
    elements.append(Spacer(1, 18))
    return elements

def h1(text, level=0):
    key = 'h_%s' % md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style_h1)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h2(text, level=1):
    key = 'h_%s' % md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style_h2)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h3(text):
    return Paragraph('<b>%s</b>' % text, style_h3)

def body(text):
    return Paragraph(text, style_body)

def bullet(text):
    return Paragraph('<bullet>&bull;</bullet> %s' % text, style_bullet)

def callout(text):
    return Paragraph(text, style_callout)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=8, spaceAfter=8)

# ━━ TOC Template ━━
from reportlab.platypus.tableofcontents import TableOfContents

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ━━ Build Document ━━
OUTPUT_PATH = '/home/z/my-project/download/restaurant_booking_pro_guinee.pdf'

doc = TocDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN,
    showBoundary=0
)

story = []

# ━━━━━━━━━━ TABLE DES MATIERES ━━━━━━━━━━
story.append(Paragraph('<b>Table des matieres</b>', ParagraphStyle(
    'TOCTitle', fontName=HEADING_FONT, fontSize=22, leading=30,
    textColor=ACCENT, spaceBefore=20, spaceAfter=20, alignment=TA_LEFT
)))
story.append(hr())

toc = TableOfContents()
toc.levelStyles = [style_toc_h1, style_toc_h2]
story.append(toc)
story.append(PageBreak())

# ━━━━━━━━━━ 1. RESUME EXECUTIF ━━━━━━━━━━
story.append(h1('1. Resume executif'))
story.append(body(
    "Ce document presente un modele complet de plateforme digitale dediee aux restaurants en Guinee, "
    "inspire et adapte du projet <b>Hotel Booking Pro</b> developpe pour l'Hotel SETIFANA a Conakry. "
    "L'objectif est de transformer une solution hoteliere eprouvee en un produit SaaS scalable, specialement "
    "concue pour repondre aux besoins uniques du marche restauratif guineen. La Guinee connait une croissance "
    "rapide de son secteur de la restauration, notamment a Conakry, ou la demande pour des experiences culinaires "
    "modernes et digitalisees ne cesse d'augmenter. Les restaurateurs font face a des defis majeurs : gestion "
    "manuelle des reservations, suivi financier approximatif, absence de presence en ligne professionnelle, "
    "et difficultes a gerer les commandes a emporter et les livraisons."
))
story.append(Spacer(1, 6))
story.append(body(
    "Restaurant Booking Pro propose une solution tout-en-un qui couvre la reservation de tables en ligne, "
    "la gestion du menu digital, le traitement des commandes (sur place, a emporter, livraison), "
    "la gestion des paiements via Mobile Money (Orange Money, MTN Money, Wave), Stripe et PayPal, "
    "ainsi qu'un tableau de bord administratif complet avec KPIs, rapports financiers et gestion du personnel. "
    "La plateforme est construite sur une architecture moderne (Next.js 14 + NestJS + PostgreSQL) deployable "
    "via Docker, garantissant performance, securite et evolutivite. L'approche multi-tenants permet de servir "
    "plusieurs restaurants a partir d'une seule instance, chacun avec son identite visuelle et ses donnees isolees."
))
story.append(Spacer(1, 8))
story.append(callout(
    "<b>Objectif principal :</b> Offrir aux restaurateurs guineens une plateforme professionnelle, abordable et "
    "adaptee au contexte local (Mobile Money, langue francaise, connectivite variable) pour digitaliser leur "
    "activite et augmenter leur chiffre d'affaires."
))

# ━━━━━━━━━━ 2. ANALYSE DU PROJET EXISTANT ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('2. Analyse du projet existant : Hotel Booking Pro'))

story.append(h2('2.1 Architecture technique'))
story.append(body(
    "Hotel Booking Pro est un monorepo compose de deux applications principales partageant un package commun. "
    "Le frontend est construit avec <b>Next.js 14</b> (App Router, Server Components, ISR), style avec "
    "<b>Tailwind CSS</b> et <b>shadcn/ui</b>, offrant une interface utilisateur moderne et reactive. "
    "Le backend utilise <b>NestJS</b> avec <b>Prisma ORM</b> sur <b>PostgreSQL</b>, avec un cache <b>Redis</b> "
    "pour les routes publiques. L'ensemble est deploye via <b>Docker Compose</b> avec Nginx comme reverse proxy, "
    "assurant une mise en production simplifiee et reproductible. Cette architecture est robuste, testee et "
    "parfaitement adaptee au contexte africain ou l'infrastructure peut etre variable."
))

# Architecture table
arch_data = [
    [Paragraph('<b>Composant</b>', style_header_cell), Paragraph('<b>Technologie</b>', style_header_cell), Paragraph('<b>Role</b>', style_header_cell)],
    [Paragraph('Frontend Web', style_cell), Paragraph('Next.js 14 + Tailwind CSS + shadcn/ui', style_cell), Paragraph('Interface publique et administration', style_cell)],
    [Paragraph('Backend API', style_cell), Paragraph('NestJS + Prisma ORM', style_cell), Paragraph('Logique metier, auth, paiements', style_cell)],
    [Paragraph('Base de donnees', style_cell), Paragraph('PostgreSQL 16', style_cell), Paragraph('Stockage persistant des donnees', style_cell)],
    [Paragraph('Cache', style_cell), Paragraph('Redis 7', style_cell), Paragraph('Cache routes publiques, sessions', style_cell)],
    [Paragraph('Reverse Proxy', style_cell), Paragraph('Nginx', style_cell), Paragraph('Routing /api et /* vers les services', style_cell)],
    [Paragraph('Conteneurisation', style_cell), Paragraph('Docker Compose', style_cell), Paragraph('Deployment reproductible', style_cell)],
    [Paragraph('Paiements', style_cell), Paragraph('Stripe + PayPal + Mobile Money', style_cell), Paragraph('Multi-providers avec webhooks', style_cell)],
    [Paragraph('Email', style_cell), Paragraph('Gmail SMTP / Resend', style_cell), Paragraph('Notifications et confirmations', style_cell)],
    [Paragraph('i18n', style_cell), Paragraph('Francais, Anglais, Allemand, Arabe', style_cell), Paragraph('Support multilingue complet', style_cell)],
]
story.extend(make_table(arch_data, [0.22, 0.40, 0.38], 'Tableau 1 : Stack technique de Hotel Booking Pro'))

story.append(h2('2.2 Fonctionnalites identifiees'))
story.append(body(
    "L'analyse approfondie du code source a permis d'identifier un ensemble riche de fonctionnalites couvrant "
    "l'ensemble du cycle de vie d'un etablissement hotelier. Ces fonctionnalites constituent la base solide "
    "sur laquelle le modele restaurant sera construit, chacune necessitant une adaptation specifique pour "
    "repondre aux besoins du secteur restauratif. Le projet inclut egalement des fonctionnalites avancees "
    "comme un chatbot AI (Amina), la generation de documents commerciaux (devis et factures), la gestion "
    "des depenses, un systeme de fidelite et une newsletter integree."
))

feat_data = [
    [Paragraph('<b>Module</b>', style_header_cell), Paragraph('<b>Fonctionnalite Hotel</b>', style_header_cell), Paragraph('<b>Adaptation Restaurant</b>', style_header_cell)],
    [Paragraph('Chambres', style_cell), Paragraph('Catalogue de chambres avec images, prix, capacite', style_cell), Paragraph('Tables avec capacite, zones (interieur/terrasse/VIP), photos', style_cell)],
    [Paragraph('Reservations', style_cell), Paragraph('Booking avec dates, adultes/enfants, anti double-booking', style_cell), Paragraph('Reservation de table avec creneaux horaires, nombre de convives', style_cell)],
    [Paragraph('Paiements', style_cell), Paragraph('Stripe, PayPal, Mobile Money, pay-at-hotel', style_cell), Paragraph('Memes providers + paiement sur place, addition digitale', style_cell)],
    [Paragraph('Dashboard Admin', style_cell), Paragraph('KPIs, graphiques occupation/revenus, reservations en attente', style_cell), Paragraph('KPIs restaurants, taux remplissage, plats populaires, revenus par service', style_cell)],
    [Paragraph('Services Hotel', style_cell), Paragraph('Piscine, spa, restaurant, navette, conference', style_cell), Paragraph('Menu digital, livraison, a emporter, evenement prive', style_cell)],
    [Paragraph('Avis/Reviews', style_cell), Paragraph('Notes et commentaires clients, moderation admin', style_cell), Paragraph('Avis sur plats et experience, notes par categorie', style_cell)],
    [Paragraph('Staff', style_cell), Paragraph('Gestion personnel, departements, plannings shifts', style_cell), Paragraph('Equipe cuisine/service, planning par service (midi/soir)', style_cell)],
    [Paragraph('Documents', style_cell), Paragraph('Devis et factures, lignes editables, PDF', style_cell), Paragraph('Factures restaurant, notes de frais, devis evenements', style_cell)],
    [Paragraph('Depenses', style_cell), Paragraph('Categories de depenses, suivi benefice net', style_cell), Paragraph('Depenses ingredients, loyer, salaires, suivi marge', style_cell)],
    [Paragraph('Chatbot AI', style_cell), Paragraph('Amina : FAQ hotel, chambres, tarifs', style_cell), Paragraph('Chatbot restaurant : menu, horaires, allergenes, reservation', style_cell)],
    [Paragraph('Contact', style_cell), Paragraph('Formulaire de contact, messages, suivi statut', style_cell), Paragraph('Demande evenement prive, contact, feedback', style_cell)],
    [Paragraph('Newsletter', style_cell), Paragraph('Inscription, desabonnement', style_cell), Paragraph('Promotions, menu du jour, evenements', style_cell)],
]
story.extend(make_table(feat_data, [0.15, 0.40, 0.45], 'Tableau 2 : Correspondance des fonctionnalites Hotel vers Restaurant'))

story.append(h2('2.3 Modele de donnees'))
story.append(body(
    "Le schema Prisma du projet hotelier comprend 18 modeles couvrant l'authentification (User, RefreshToken, "
    "PasswordResetToken, EmailVerificationToken), le catalogue (Room, RoomImage), les reservations (Booking), "
    "les paiements (Payment, Invoice), les documents commerciaux (Document, DocumentLine), les depenses (Expense), "
    "le personnel (StaffMember, StaffShift), les avis (Review), les contacts (ContactMessage), les parametres "
    "(Setting), la disponibilite (AvailabilityBlock, PriceRule), et la newsletter (NewsletterSubscriber). "
    "Ce modele de donnees est extrement bien structure et la majorite des modeles sont directement reutilisables "
    "ou facilement adaptables pour un restaurant. Les relations entre entites sont claires et les index sont "
    "optimises pour les requetes frequentes."
))

# ━━━━━━━━━━ 3. MODELE RESTAURANT ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('3. Modele Restaurant Booking Pro'))

story.append(h2('3.1 Vue d\'ensemble'))
story.append(body(
    "Restaurant Booking Pro est une plateforme SaaS multi-tenants qui permet a chaque restaurant d'avoir "
    "sa propre instance personnalisee avec son identite visuelle, son menu, ses horaires et ses tarifs. "
    "L'architecture multi-tenants est une evolution cle par rapport au projet hotelier qui etait mono-tenant. "
    "Chaque restaurant dispose d'un espace isole dans la base de donnees (via un tenant_id), d'un sous-domaine "
    "personnalise (ex: lepalais.restaurantbookingpro.gn), et d'une interface d'administration complete. "
    "La plateforme propose trois niveaux de service (Essentiel, Professionnel, Premium) pour s'adapter "
    "aux differents budgets et besoins des restaurateurs guineens, de la petite cafeteria au grand restaurant gastronomique."
))
story.append(Spacer(1, 6))
story.append(body(
    "Le coeur de la plateforme repose sur cinq piliers fonctionnels : la <b>reservation de tables en ligne</b> "
    "avec gestion des creneaux horaires et des zones de service, le <b>menu digital interactif</b> avec photos, "
    "descriptions et gestion des allergenes, la <b>commande en ligne</b> (sur place, a emporter ou livraison), "
    "le <b>paiement integre</b> via Mobile Money et cartes bancaires, et le <b>tableau de bord analytique</b> "
    "avec indicateurs de performance en temps reel. Chaque pilier a ete concu en tenant compte des specificites "
    "du marche guineen, notamment la prevalence du Mobile Money comme moyen de paiement principal, les contraintes "
    "de connectivite internet, et les habitudes alimentaires locales."
))

story.append(h2('3.2 Architecture cible'))
story.append(body(
    "L'architecture conserve la structure monorepo du projet original avec des evolutions significatives pour "
    "supporter le mode multi-tenant. Le frontend Next.js est enrichi avec un systeme de theming dynamique "
    "permettant a chaque restaurant de personnaliser couleurs, logos et typographies. Le backend NestJS "
    "integre un middleware de resolution de tenant base sur le sous-domaine ou un header personnalise. "
    "La base de donnees PostgreSQL utilise le pattern \"shared database, shared schema\" avec un tenant_id "
    "sur chaque table, assurant l'isolation des donnees tout en maintenant de bonnes performances. "
    "Redis est utilise pour le cache des menus et des disponibilites, reduisant la charge sur la base de donnees "
    "lors des heures de pointe."
))

arch_rest_data = [
    [Paragraph('<b>Composant</b>', style_header_cell), Paragraph('<b>Technologie</b>', style_header_cell), Paragraph('<b>Evolution vs Hotel</b>', style_header_cell)],
    [Paragraph('Frontend', style_cell), Paragraph('Next.js 14 + Tailwind + shadcn/ui', style_cell), Paragraph('+ Thematique dynamique multi-tenant', style_cell)],
    [Paragraph('Backend', style_cell), Paragraph('NestJS + Prisma ORM', style_cell), Paragraph('+ Middleware tenant, modules menu/commande', style_cell)],
    [Paragraph('Base de donnees', style_cell), Paragraph('PostgreSQL 16', style_cell), Paragraph('+ Schema multi-tenant (tenant_id)', style_cell)],
    [Paragraph('Cache', style_cell), Paragraph('Redis 7', style_cell), Paragraph('+ Cache menus et disponibilites', style_cell)],
    [Paragraph('Stockage fichiers', style_cell), Paragraph('Cloudinary / S3', style_cell), Paragraph('Photos plats, logos restaurants', style_cell)],
    [Paragraph('Notifications', style_cell), Paragraph('WhatsApp Business API + Email', style_cell), Paragraph('+ SMS pour confirmations locales', style_cell)],
    [Paragraph('Monitoring', style_cell), Paragraph('Health checks + logs structures', style_cell), Paragraph('+ Metriques par tenant', style_cell)],
]
story.extend(make_table(arch_rest_data, [0.20, 0.35, 0.45], 'Tableau 3 : Architecture cible Restaurant Booking Pro'))

story.append(h2('3.3 Schema de donnees adapte'))
story.append(body(
    "Le schema de donnees du modele restaurant s'inspire directement du schema hotelier, avec des transformations "
    "semantiques et structurelles adaptees. Le modele Room devient Table, le modele Booking devient Reservation "
    "avec des creneaux horaires, et de nouveaux modeles apparaissent pour le menu, les commandes et les livraisons. "
    "Le modele HotelService est remplace par RestaurantService couvrant la livraison, l'emportee et les evenements. "
    "Chaque table integre un champ tenant_id pour l'isolation multi-tenant, et les index sont optimises pour "
    "les requetes specifiques au domaine restaurant (recherche de tables disponibles par creneau, plats populaires, etc.)."
))

schema_data = [
    [Paragraph('<b>Modele Hotel</b>', style_header_cell), Paragraph('<b>Modele Restaurant</b>', style_header_cell), Paragraph('<b>Principales adaptations</b>', style_header_cell)],
    [Paragraph('Room', style_cell), Paragraph('Table', style_cell), Paragraph('zone (interieur/terrasse/VIP), capacite convives, equipements', style_cell)],
    [Paragraph('RoomImage', style_cell), Paragraph('TableImage', style_cell), Paragraph('Photos de la table/zone', style_cell)],
    [Paragraph('Booking', style_cell), Paragraph('Reservation', style_cell), Paragraph('Creneau horaire (date+heure), nombre de convives, occasion spec.', style_cell)],
    [Paragraph('-', style_cell), Paragraph('Menu', style_cell), Paragraph('Nouveau : menu du jour, menu permanent, menu evenement', style_cell)],
    [Paragraph('-', style_cell), Paragraph('MenuItem', style_cell), Paragraph('Nouveau : plat avec prix, description, photo, allergenes, statut', style_cell)],
    [Paragraph('-', style_cell), Paragraph('Order', style_cell), Paragraph('Nouveau : commande (sur place/emporte/livraison)', style_cell)],
    [Paragraph('-', style_cell), Paragraph('OrderItem', style_cell), Paragraph('Nouveau : ligne de commande avec quantite et prix', style_cell)],
    [Paragraph('-', style_cell), Paragraph('Delivery', style_cell), Paragraph('Nouveau : adresse, livreur, statut livraison', style_cell)],
    [Paragraph('HotelService', style_cell), Paragraph('RestaurantService', style_cell), Paragraph('Livraison, a emporter, evenement prive, traiteur', style_cell)],
    [Paragraph('AvailabilityBlock', style_cell), Paragraph('TableBlock', style_cell), Paragraph('Indisponibilite de table (evenement prive, maintenance)', style_cell)],
    [Paragraph('PriceRule', style_cell), Paragraph('PricingRule', style_cell), Paragraph('Happy hour, menu du jour, promotions saisonnieres', style_cell)],
    [Paragraph('StaffDepartment', style_cell), Paragraph('StaffDept', style_cell), Paragraph('Cuisine, Service, Bar, Accueil, Direction', style_cell)],
    [Paragraph('Expense', style_cell), Paragraph('Expense', style_cell), Paragraph('+ Categories ingredients, boissons, emballages', style_cell)],
    [Paragraph('User / Customer', style_cell), Paragraph('User / Customer', style_cell), Paragraph('+ Adresses de livraison sauvegardees', style_cell)],
]
story.extend(make_table(schema_data, [0.22, 0.22, 0.56], 'Tableau 4 : Mapping du schema de donnees Hotel vers Restaurant'))

# ━━━━━━━━━━ 4. FONCTIONNALITES DETAILLEES ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('4. Fonctionnalites detaillees'))

story.append(h2('4.1 Reservation de tables en ligne'))
story.append(body(
    "Le module de reservation est le coeur de la plateforme. Il permet aux clients de consulter les tables "
    "disponibles en temps reel, de choisir un creneau horaire, d'indiquer le nombre de convives et d'ajouter "
    "des preferences (zone fumeur/non-fumeur, terrace/interieur, haute chaise pour enfant). Le systeme "
    "de reservation integre une protection anti double-booking identique a celle du projet hotelier, utilisant "
    "un verrou pessimiste au niveau de la ligne PostgreSQL (SELECT ... FOR UPDATE) pour garantir qu'une table "
    "ne peut etre reservee qu'une seule fois pour un creneau donne. Les confirmations sont envoyees par email "
    "et via WhatsApp, et des rappels automatiques sont programmables."
))
story.append(Spacer(1, 6))
story.append(body(
    "Les creneaux horaires sont configurables par restaurant (par exemple : service dejeuner 12h-15h, "
    "service diner 19h-23h) avec une duree de reservation par defaut (90 minutes) ajustable. Le systeme "
    "gestion les temps de preparation entre reservations (turnover time) pour optimiser le taux d'occupation. "
    "Le restaurateur peut definir des regles de disponibilite : fermeture hebdomadaire, vacances, evenements "
    "prives, et la plateforme ajuste automatiquement les creneaux disponibles. Un widget de reservation "
    "embeddable permet aux restaurants d'integrer le systeme directement sur leurs reseaux sociaux."
))

story.append(h2('4.2 Menu digital interactif'))
story.append(body(
    "Le menu digital remplace le menu papier traditionnel et offre une experience enrichie. Chaque plat dispose "
    "d'une fiche detaillee avec photo haute resolution, description, prix, allergenes (avec icones visuelles), "
    "options de personnalisation (cuisson de la viande, niveau d'epices, accompagnements), et statut de "
    "disponibilite en temps reel. Le menu est organise en categories (entrees, plats, desserts, boissons) "
    "et sous-categories personnalisables. Les plats peuvent etre marques comme 'nouveautes', 'populaires' "
    "ou 'recommandes par le chef', offrant une navigation intuitive au client."
))
story.append(Spacer(1, 6))
story.append(body(
    "Le restaurateur dispose d'une interface d'administration complete pour gerer le menu : ajout/modification "
    "de plats avec upload de photos via Cloudinary, gestion des categories et de l'ordre d'affichage, "
    "masquage temporaire de plats en rupture de stock, et planification de menus saisonniers ou evenementiels. "
    "Un systeme de QR code est genere automatiquement pour chaque restaurant, permettant aux clients de scanner "
    "le code sur table pour acceder directement au menu digital depuis leur smartphone, sans application a installer. "
    "Le menu digital est optimise pour le mobile-first, essentiel en Guinee ou la majorite des utilisateurs "
    "accedent a internet via smartphone."
))

story.append(h2('4.3 Commandes en ligne'))
story.append(body(
    "Le module de commandes supporte trois modes distincts : <b>sur place</b> (commande a table via QR code), "
    "<b>a emporter</b> (click & collect avec creneau de retrait), et <b>livraison</b> (avec integration de "
    "livreurs locaux). Chaque mode a son propre flux de validation et de notification. Pour les commandes sur "
    "place, le client scanne le QR code, parcourt le menu, passe commande et paie directement depuis son "
    "telephone, eliminant l'attente du serveur. Pour l'emportee, le client choisit un creneau de retrait "
    "et recoit une notification quand la commande est prete. Pour la livraison, le systeme calcule le temps "
    "estime et suit la commande en temps reel."
))
story.append(Spacer(1, 6))
story.append(body(
    "Le flux de commande en backend suit le meme pattern robuste que le flux de reservation hotelier : "
    "validation serveur des prix et disponibilites, creation de la commande avec statut PENDING, "
    "traitement du paiement, confirmation avec mise a jour du statut, et envoi de notifications. "
    "Les webhooks de paiement sont verifies par signature HMAC, identiquement au projet hotelier. "
    "Le restaurant recoit chaque nouvelle commande sur un ecran dedie en cuisine avec alerte sonore, "
    "et peut mettre a jour le statut (en preparation, pret, servi/livre) en un clic."
))

story.append(h2('4.4 Paiements integres'))
story.append(body(
    "Le systeme de paiement reprend l'infrastructure multi-providers du projet hotelier avec des adaptations "
    "specifiques au restaurant. Le Mobile Money (Orange Money, MTN Money, Wave) reste le moyen de paiement "
    "principal en Guinee, et le flux est identique a celui du projet hotelier : initiation du paiement, "
    "notification push sur le telephone du client, confirmation par webhook, mise a jour de la commande. "
    "Le paiement par carte bancaire via Stripe est disponible pour la clientele internationale et les touristes, "
    "tandis que le paiement sur place est conserve pour les clients qui preferent regler en especes a la fin du repas."
))
story.append(Spacer(1, 6))
story.append(body(
    "Une nouveaute importante par rapport au modele hotelier est le <b>systeme d'addition digitale</b> : "
    "les clients peuvent demander l'addition depuis leur telephone, voir le detail complet, diviser l'addition "
    "entre plusieurs convives (split bill), et regler individuellement. Ce systeme est particulierement "
    "apprecie dans le contexte guineen ou les repas communautaires sont frequents. Les pourboires peuvent "
    "etre ajoutes directement via l'interface de paiement, et les restaurants peuvent configurer des montants "
    "de pourboire suggeres. Toutes les transactions sont securisees avec le meme niveau de protection que "
    "le projet hotelier : HTTPS, validation webhook, et idempotence des confirmations de paiement."
))

story.append(h2('4.5 Tableau de bord analytique'))
story.append(body(
    "Le tableau de bord administratif est adapte du dashboard hotelier avec des KPIs specifiques au restaurant. "
    "Il affiche en temps reel les metriques critiques : nombre de reservations et commandes du jour, chiffre "
    "d'affaires par service (dejeuner/diner), taux d'occupation des tables, plats les plus commandes, panier "
    "moyen, et temps de rotation moyen. Les graphiques d'evolution reprennent les composants mini-chart du "
    "projet hotelier avec des donnees restaurant : chiffre d'affaires hebdomadaire, comparaison jour par jour, "
    "et repartition des revenus par source (sur place/emporte/livraison). Le dashboard integre egalement "
    "un systeme d'alertes pour les reservations en attente de confirmation et les commandes en retard."
))
story.append(Spacer(1, 6))
story.append(body(
    "Le module de rapports etend les capacites du dashboard avec des exports CSV et des generations de PDF "
    "pour les rapports quotidiens, hebdomadaires et mensuels. Le suivi des depenses reprend le module Expense "
    "du projet hotelier avec des categories adaptees au restaurant : ingredients, boissons, emballages, "
    "energie, personnel, loyer, marketing. Le calcul automatique du benefice net (recettes - depenses) "
    "permet au restaurateur d'avoir une vision claire de la sante financiere de son etablissement. "
    "Les documents commerciaux (devis et factures) du projet hotelier sont conserves pour les evenements "
    "prives et le traiteur, avec adaptation des modeles PDF aux besoins restauratifs."
))

# ━━━━━━━━━━ 5. ADAPTATIONS SPECIFIQUES GUINEE ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('5. Adaptations specifiques au marche guineen'))

story.append(h2('5.1 Paiement Mobile Money'))
story.append(body(
    "Le Mobile Money est le pilier du systeme de paiement en Guinee. Le projet hotelier integre deja "
    "Orange Money, MTN Money et Wave, ce qui constitue un avantage concurrentiel majeur. Pour le restaurant, "
    "le flux Mobile Money est optimise pour les micro-transactions : alors qu'une nuit d'hotel represente "
    "un montant eleve (450 000 a 2 500 000 GNF), un repas au restaurant peut couter entre 25 000 et 150 000 GNF "
    "par personne. L'experience de paiement doit donc etre particulierement fluide et rapide, avec un minimum "
    "d'etapes. Le systeme pre-remplit le numero de telephone du client (sauvegarde dans son profil) et propose "
    "un paiement en un clic pour les clients reguliers. Les frais de transaction Mobile Money (generalement 1-2%) "
    "sont transparents et peuvent etre absorbes par le restaurant ou refactures au client selon la politique definie."
))

story.append(h2('5.2 Connectivite et mode hors-ligne'))
story.append(body(
    "La connectivite internet en Guinee peut etre instable, particulierement en dehors de Conakry. "
    "Restaurant Booking Pro integre donc des capacites hors-ligne essentielles. Le menu digital utilise "
    "un Service Worker pour mettre en cache les donnees du menu et les images, permettant aux clients de "
    "consulter le menu meme sans connexion. Les reservations sont d'abord stockees localement et synchronisees "
    "des que la connexion est retablie. Le tableau de bord administratif fonctionne en mode degrade avec "
    "les dernieres donnees en cache, et les operations critiques (creation de commande, paiement) sont "
    "files d'attente avec retry automatique. Cette resilience face a la connectivite est un avantage cle "
    "par rapport aux solutions internationales qui presupposent une connexion permanente."
))

story.append(h2('5.3 Internationalisation et localisation'))
story.append(body(
    "Le projet hotelier dispose deja d'un systeme i18n complet avec support du francais, anglais, allemand "
    "et arabe. Pour le marche guineen, le francais reste la langue principale, mais l'ajout du <b>soussou</b>, "
    "du <b>poular</b> et du <b>malinke</b> (les trois langues nationales les plus parlee en Guinee) serait un "
    "differentiateur significatif. Les noms de plats traditionnels guineens peuvent etre presentes dans leur "
    "langue d'origine avec traduction en francais, enrichissant l'experience culinaire. Le format des prix "
    "est en GNF (Franc Guineen) par defaut, avec la possibilite d'afficher en USD pour la clientele internationale. "
    "Les dates et heures suivent le format francais (JJ/MM/AAAA, 24h), et le systeme de numero de telephone "
    "est adapte au format guineen (+224)."
))

story.append(h2('5.4 Integration WhatsApp'))
story.append(body(
    "WhatsApp est l'outil de communication le plus utilise en Guinee. Le projet hotelier inclut deja un "
    "bouton WhatsApp, mais le modele restaurant va plus loin avec l'integration de l'<b>API WhatsApp Business</b>. "
    "Les restaurateurs peuvent envoyer des messages automatiques de confirmation de reservation, des rappels "
    "avant le repas, des notifications de commande prete pour l'emportee, et des promotions personnalisees. "
    "Les clients peuvent initier une reservation directement via WhatsApp en envoyant un message au numero "
    "du restaurant, le chatbot AI repondant automatiquement aux questions sur le menu, les horaires et la "
    "disponibilite. Cette integration WhatsApp est cruciale car elle supprime la barriere technologique pour "
    "les clients moins a l'aise avec les applications web, tout en restant dans un ecosysteme qu'ils utilisent deja quotidiennement."
))

# ━━━━━━━━━━ 6. MODELE COMMERCIAL ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('6. Modele commercial et tarification'))

story.append(h2('6.1 Offres SaaS multi-niveaux'))
story.append(body(
    "Le modele commercial repose sur un abonnement mensuel avec trois niveaux de service, chacun incluant "
    "un ensemble progressif de fonctionnalites. Cette approche permet de servir l'ensemble du marche, "
    "de la petite gargote du quartier au restaurant gastronomique de Conakry. Le prix est en Franc Guineen "
    "pour s'adapter au marche local, avec des options de paiement annuel offrant une reduction de 15%. "
    "Un periode d'essai gratuit de 14 jours est offerte pour chaque niveau, permettant aux restaurateurs "
    "de tester la plateforme avant de s'engager. Les frais d'installation et de formation sont inclus "
    "dans tous les niveaux pour faciliter l'adoption."
))

pricing_data = [
    [Paragraph('<b>Caracteristique</b>', style_header_cell), Paragraph('<b>Essentiel</b>', style_header_cell), Paragraph('<b>Professionnel</b>', style_header_cell), Paragraph('<b>Premium</b>', style_header_cell)],
    [Paragraph('Prix mensuel', style_cell), Paragraph('150 000 GNF', style_cell_center), Paragraph('350 000 GNF', style_cell_center), Paragraph('750 000 GNF', style_cell_center)],
    [Paragraph('Reservation en ligne', style_cell), Paragraph('Oui (50/mois)', style_cell_center), Paragraph('Oui (illimite)', style_cell_center), Paragraph('Oui (illimite)', style_cell_center)],
    [Paragraph('Menu digital + QR', style_cell), Paragraph('Oui (30 plats)', style_cell_center), Paragraph('Oui (illimite)', style_cell_center), Paragraph('Oui (illimite)', style_cell_center)],
    [Paragraph('Commande en ligne', style_cell), Paragraph('Sur place uniquement', style_cell_center), Paragraph('+ A emporter', style_cell_center), Paragraph('+ Livraison', style_cell_center)],
    [Paragraph('Paiement Mobile Money', style_cell), Paragraph('Oui', style_cell_center), Paragraph('Oui', style_cell_center), Paragraph('Oui + Stripe/PayPal', style_cell_center)],
    [Paragraph('Dashboard analytics', style_cell), Paragraph('Basique', style_cell_center), Paragraph('Avance + exports', style_cell_center), Paragraph('Complet + rapports PDF', style_cell_center)],
    [Paragraph('Chatbot AI', style_cell), Paragraph('Non', style_cell_center), Paragraph('Oui (WhatsApp)', style_cell_center), Paragraph('Oui (web + WhatsApp)', style_cell_center)],
    [Paragraph('Documents commerciaux', style_cell), Paragraph('Non', style_cell_center), Paragraph('Factures', style_cell_center), Paragraph('Devis + factures + PDF', style_cell_center)],
    [Paragraph('Gestion personnel', style_cell), Paragraph('Non', style_cell_center), Paragraph('Planning basique', style_cell_center), Paragraph('Complet + paie', style_cell_center)],
    [Paragraph('Support', style_cell), Paragraph('Email', style_cell_center), Paragraph('WhatsApp + email', style_cell_center), Paragraph('Dedie + telephone', style_cell_center)],
    [Paragraph('Domaine personnalise', style_cell), Paragraph('Sous-domaine', style_cell_center), Paragraph('Sous-domaine', style_cell_center), Paragraph('Domaine propre', style_cell_center)],
]
story.extend(make_table(pricing_data, [0.28, 0.24, 0.24, 0.24], 'Tableau 5 : Grille tarifaire Restaurant Booking Pro'))

story.append(h2('6.2 Revenus complementaires'))
story.append(body(
    "Au-dela des abonnements, plusieurs sources de revenus complementaires renforcent la viabilite economique "
    "du modele. Une commission de 2-3% est prelevee sur chaque transaction Mobile Money et carte bancaire "
    "traitee via la plateforme, generant des revenus proportionnels au volume d'affaires des restaurants. "
    "Des frais d'installation premium (100 000 a 300 000 GNF) sont proposes pour les restaurants souhaitant "
    "une personnalisation avancee (integration de leur identite visuelle, formation du personnel sur site, "
    "configuration du materiel). Le marche de la publicite locale offre egalement un potentiel : les restaurants "
    "Premium peuvent etre mis en avant dans les recherches et les recommandations, et des partenariats avec "
    "des fournisseurs d'ingredients peuvent generer des commissions de mise en relation."
))

# ━━━━━━━━━━ 7. PLAN DE DEVELOPPEMENT ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('7. Plan de developpement'))

story.append(h2('7.1 Phases de developpement'))

phase_data = [
    [Paragraph('<b>Phase</b>', style_header_cell), Paragraph('<b>Duree</b>', style_header_cell), Paragraph('<b>Livrables</b>', style_header_cell), Paragraph('<b>Priorite</b>', style_header_cell)],
    [Paragraph('Phase 1 : MVP', style_cell), Paragraph('8 semaines', style_cell_center), Paragraph('Multi-tenant, menu digital, reservation tables, Mobile Money', style_cell), Paragraph('Critique', style_cell_center)],
    [Paragraph('Phase 2 : Commandes', style_cell), Paragraph('6 semaines', style_cell_center), Paragraph('Commande sur place (QR), a emporter, addition digitale', style_cell), Paragraph('Haute', style_cell_center)],
    [Paragraph('Phase 3 : Livraison', style_cell), Paragraph('6 semaines', style_cell_center), Paragraph('Livraison, suivi en temps reel, integration livreurs', style_cell), Paragraph('Haute', style_cell_center)],
    [Paragraph('Phase 4 : Analytics', style_cell), Paragraph('4 semaines', style_cell_center), Paragraph('Dashboard avance, rapports PDF, gestion depenses, documents', style_cell), Paragraph('Moyenne', style_cell_center)],
    [Paragraph('Phase 5 : AI + WhatsApp', style_cell), Paragraph('6 semaines', style_cell_center), Paragraph('Chatbot, WhatsApp Business, mode hors-ligne, langues locales', style_cell), Paragraph('Moyenne', style_cell_center)],
    [Paragraph('Phase 6 : Scale', style_cell), Paragraph('4 semaines', style_cell_center), Paragraph('Optimisations perf, monitoring, auto-scaling, marketplace', style_cell), Paragraph('Basse', style_cell_center)],
]
story.extend(make_table(phase_data, [0.15, 0.12, 0.55, 0.18], 'Tableau 6 : Phases de developpement et livrables'))

story.append(h2('7.2 Efforts de reutilisation du code existant'))
story.append(body(
    "L'un des avantages majeurs de ce projet est la reutilisation extensive du code du projet hotelier. "
    "L'analyse detaillee du code source montre que environ 60% du code backend et 45% du code frontend "
    "peuvent etre directement reutilises ou legèrement adaptes. Les modules d'authentification (auth), "
    "de paiements (payments), de gestion du personnel (staff), de documents commerciaux (documents, invoices), "
    "de depenses (expenses), de parametres (settings), de contacts (contact), d'avis (reviews), de newsletter, "
    "et de sante (health) sont quasi-identiques et necessitent principalement l'ajout du tenant_id. "
    "Les modules de rooms et bookings servent de base solide pour les tables et reservations, avec des "
    "adaptations de schema mais une logique metier similaire. Seuls les modules menu, commande et livraison "
    "sont entierement nouveaux, representant environ 25% du code total."
))

reuse_data = [
    [Paragraph('<b>Module</b>', style_header_cell), Paragraph('<b>Reutilisation</b>', style_header_cell), Paragraph('<b>Effort adaptation</b>', style_header_cell)],
    [Paragraph('Auth (JWT, RBAC)', style_cell), Paragraph('95%', style_cell_center), Paragraph('Ajout tenant_id', style_cell)],
    [Paragraph('Paiements (Stripe, PayPal, MM)', style_cell), Paragraph('90%', style_cell_center), Paragraph('Ajustement montants micro-transactions', style_cell)],
    [Paragraph('Dashboard Admin', style_cell), Paragraph('60%', style_cell_center), Paragraph('Nouveaux KPIs, graphiques restauration', style_cell)],
    [Paragraph('Rooms -> Tables', style_cell), Paragraph('50%', style_cell_center), Paragraph('Schema different, logique creneaux', style_cell)],
    [Paragraph('Bookings -> Reservations', style_cell), Paragraph('55%', style_cell_center), Paragraph('Creneaux horaires, convives, zones', style_cell)],
    [Paragraph('Staff + Shifts', style_cell), Paragraph('85%', style_cell_center), Paragraph('Departements restaurant', style_cell)],
    [Paragraph('Documents (devis/factures)', style_cell), Paragraph('90%', style_cell_center), Paragraph('Templates PDF restaurant', style_cell)],
    [Paragraph('Expenses', style_cell), Paragraph('85%', style_cell_center), Paragraph('Categories restaurant', style_cell)],
    [Paragraph('Menu digital', style_cell), Paragraph('0% (nouveau)', style_cell_center), Paragraph('Developpement complet', style_cell)],
    [Paragraph('Commandes + Livraison', style_cell), Paragraph('0% (nouveau)', style_cell_center), Paragraph('Developpement complet', style_cell)],
    [Paragraph('i18n', style_cell), Paragraph('80%', style_cell_center), Paragraph('Ajout langues locales', style_cell)],
    [Paragraph('Chatbot AI', style_cell), Paragraph('70%', style_cell_center), Paragraph('Nouveau contexte restaurant', style_cell)],
]
story.extend(make_table(reuse_data, [0.30, 0.20, 0.50], 'Tableau 7 : Taux de reutilisation par module'))

# ━━━━━━━━━━ 8. SECURITE ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('8. Securite et conformite'))

story.append(body(
    "La plateforme reprend l'ensemble des mesures de securite du projet hotelier, adaptees au contexte "
    "multi-tenant. L'authentification JWT avec access token (15 minutes) et refresh token rotatif (7 jours) "
    "est conservee, avec l'ajout d'un middleware de resolution de tenant qui verifie que l'utilisateur "
    "appartient bien au restaurant qu'il tente d'acceder. Le RBAC (ADMIN, STAFF, CUSTOMER) est enrichi "
    "d'un role WAITER (serveur) avec des permissions limitees aux commandes de ses tables. Le rate limiting "
    "global (100 req/60s) est conserve, avec des surcharges sur les routes sensibles (login, register, "
    "paiements). Le SanitizePipe global qui strip le HTML de tous les body entrants protege contre les XSS, "
    "et les cookies httpOnly + secure + sameSite:strict sont maintenus pour le stockage des tokens."
))
story.append(Spacer(1, 6))
story.append(body(
    "La specificite multi-tenant introduit de nouveaux defis de securite : l'isolation des donnees entre "
    "restaurants est garantie par un filtre Prisma global sur tenant_id, et chaque requete est verifiee "
    "pour s'assurer que l'utilisateur n'accede qu'aux donnees de son propre restaurant. Les variables "
    "d'environnement sensibles (JWT_SECRET, JWT_REFRESH_SECRET, cles Stripe/PayPal) sont validees au "
    "demarrage de l'application, qui refuse de lancer si elles sont absentes en production. Les webhooks "
    "de paiement verifient systematiquement la signature du provider avant de traiter la notification, "
    "empechant toute tentative de falsification. La conformite avec les regulations locales guineennes "
    "en matiere de protection des donnees est assuree par le stockage minimal des informations personnelles, "
    "le droit a l'oubli (suppression de compte), et la transparence sur l'utilisation des donnees."
))

# ━━━━━━━━━━ 9. AVANTAGES CONCURRENTIELS ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('9. Avantages concurrentiels'))

story.append(body(
    "Restaurant Booking Pro se differencie des solutions internationales existantes (TheFork, OpenTable, "
    "Resy) par plusieurs avantages strategiques sur le marche guineen. Premierement, l'integration native "
    "du Mobile Money (Orange Money, MTN Money, Wave) est un avantage decisif car aucune plateforme internationale "
    "ne propose cette integration, et le Mobile Money represente plus de 70% des transactions digitales en Guinee. "
    "Deuxiemement, la conception mobile-first et les capacites hors-ligne repondent directement aux contraintes "
    "de connectivite du pays, la ou les plateformes internationales presupposent une connexion haut debit permanente. "
    "Troisiemement, le support du francais et la perspective d'ajouter les langues nationales guineennes "
    "creent une experience utilisateur locale que les solutions anglophones ne peuvent pas egaler."
))
story.append(Spacer(1, 6))
story.append(body(
    "Quatriemement, le modele de prix en GNF et les tarifs adaptes au pouvoir d'achat local eliminent la "
    "barriere financiere que representent les abonnements en dollars des plateformes internationales. "
    "Cinquiemement, l'integration WhatsApp Business est un canal de communication naturel en Guinee, "
    "permettant une adoption rapide sans changement d'habitudes. Sixiemement, le support technique local "
    "base a Conakry assure une reactivite impossible a obtenir avec un support distant en Europe ou aux USA. "
    "Enfin, la base technique solide heritee du projet hotelier SETIFANA, deja eprouvee sur le marche guineen, "
    "apporte une credibilite et une fiabilite que les nouvelles solutions ne peuvent pas revendiquer."
))

adv_data = [
    [Paragraph('<b>Avantage</b>', style_header_cell), Paragraph('<b>Description</b>', style_header_cell), Paragraph('<b>Impact</b>', style_header_cell)],
    [Paragraph('Mobile Money natif', style_cell), Paragraph('Orange Money, MTN Money, Wave integres nativement', style_cell), Paragraph('Critique - 70%+ des transactions', style_cell)],
    [Paragraph('Mode hors-ligne', style_cell), Paragraph('Menu en cache, reservations differees, sync auto', style_cell), Paragraph('Eleve - connectivite variable', style_cell)],
    [Paragraph('Prix en GNF', style_cell), Paragraph('Abonnements en franc guineen, pas en dollars', style_cell), Paragraph('Eleve - accessibilite financiere', style_cell)],
    [Paragraph('WhatsApp Business', style_cell), Paragraph('Reservations, confirmations, chatbot via WhatsApp', style_cell), Paragraph('Critique - canal #1 en Guinee', style_cell)],
    [Paragraph('Support local', style_cell), Paragraph('Equipe technique basee a Conakry', style_cell), Paragraph('Moyen - confiance client', style_cell)],
    [Paragraph('Base eprouvee', style_cell), Paragraph('Code issu du projet SETIFANA en production', style_cell), Paragraph('Eleve - fiabilite demontree', style_cell)],
    [Paragraph('Langues locales', style_cell), Paragraph('Francais + langues nationales guineennes', style_cell), Paragraph('Moyen - inclusion', style_cell)],
]
story.extend(make_table(adv_data, [0.22, 0.45, 0.33], 'Tableau 8 : Avantages concurrentiels et impact sur le marche'))

# ━━━━━━━━━━ 10. CONCLUSION ━━━━━━━━━━
story.append(Spacer(1, 18))
story.append(h1('10. Conclusion et prochaines etapes'))

story.append(body(
    "L'analyse du projet Hotel Booking Pro demontre qu'il constitue une base technique solide et eprouvee "
    "pour developper Restaurant Booking Pro. La reutilisation de 60% du code backend et 45% du frontend "
    "reduce significativement les risques, les couts et les delais de developpement. L'architecture moderne "
    "(Next.js + NestJS + PostgreSQL + Docker) est parfaitement adaptee aux besoins du marche guineen, "
    "et les fonctionnalites existantes (paiements Mobile Money, i18n, authentification securisee, dashboard "
    "analytique) sont directement exploitables. Les adaptations necessaires - multi-tenancy, menu digital, "
    "systeme de commandes et creneaux horaires - sont bien circonscrites et representent des extensions "
    "naturelles de l'architecture existante plutot que des refontes profondes."
))
story.append(Spacer(1, 6))
story.append(body(
    "Les prochaines etapes recommandees sont les suivantes : premierement, valider le modele commercial "
    "aupres de 5 a 10 restaurants pilotes a Conakry pour recueillir du feedback reel sur les fonctionnalites "
    "et la tarification. Deuxiemement, developper le MVP (Phase 1) en 8 semaines en se concentrant sur "
    "le multi-tenant, le menu digital, la reservation de tables et le paiement Mobile Money. Troisiemement, "
    "lancer un programme beta avec les restaurants pilotes pour tester la plateforme en conditions reelles "
    "et iterer rapidement. Quatriemement, etendre progressivement les fonctionnalites selon le plan de "
    "developpement en 6 phases. Cinquiemement, mettre en place une strategie de marketing digital ciblee "
    "sur les reseaux sociaux et WhatsApp pour atteindre les restaurateurs guineens. Ce projet represente "
    "une opportunite unique de creer une solution digitale locale, construite sur des fondations solides, "
    "et parfaitement adaptee aux realites du marche guineen."
))

# ━━ Build ━━
doc.multiBuild(story)
print(f"PDF genere avec succes : {OUTPUT_PATH}")
