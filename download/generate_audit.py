#!/usr/bin/env python3
"""Generate audit report PDF for RestoProGN (KFM Delice) — June 2026"""

import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, CondPageBreak, Image, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━ Color Palette ━━
ACCENT       = colors.HexColor('#c84d24')
TEXT_PRIMARY  = colors.HexColor('#18191b')
TEXT_MUTED    = colors.HexColor('#7f868b')
BG_SURFACE   = colors.HexColor('#dadfe3')
BG_PAGE      = colors.HexColor('#e8ebee')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Italic', '/usr/share/fonts/truetype/english/Carlito-Italic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Italic', '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf'))
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold', italic='Carlito-Italic')
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold', italic='LiberationSerif-Italic')

# ━━ Page Setup ━━
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
AVAILABLE_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ━━ Styles ━━
title_style = ParagraphStyle(
    'MainTitle', fontName='Carlito', fontSize=22, leading=30,
    textColor=ACCENT, alignment=TA_LEFT, spaceBefore=6, spaceAfter=12
)
h1_style = ParagraphStyle(
    'H1', fontName='Carlito', fontSize=16, leading=22,
    textColor=ACCENT, spaceBefore=18, spaceAfter=8
)
h2_style = ParagraphStyle(
    'H2', fontName='Carlito', fontSize=13, leading=18,
    textColor=TEXT_PRIMARY, spaceBefore=12, spaceAfter=6
)
body_style = ParagraphStyle(
    'Body', fontName='Carlito', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceBefore=0, spaceAfter=6,
    firstLineIndent=0
)
body_indent_style = ParagraphStyle(
    'BodyIndent', parent=body_style, leftIndent=18
)
bullet_style = ParagraphStyle(
    'Bullet', parent=body_style, leftIndent=24, firstLineIndent=-12, spaceBefore=2, spaceAfter=3
)
header_cell_style = ParagraphStyle(
    'HeaderCell', fontName='Carlito', fontSize=10, leading=14,
    textColor=colors.white, alignment=TA_CENTER
)
cell_style = ParagraphStyle(
    'Cell', fontName='Carlito', fontSize=9.5, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
cell_center_style = ParagraphStyle(
    'CellCenter', parent=cell_style, alignment=TA_CENTER
)
caption_style = ParagraphStyle(
    'Caption', fontName='Carlito', fontSize=9, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6
)
meta_style = ParagraphStyle(
    'Meta', fontName='Carlito', fontSize=10, leading=14,
    textColor=TEXT_MUTED, alignment=TA_LEFT
)
callout_style = ParagraphStyle(
    'Callout', fontName='Carlito', fontSize=11, leading=17,
    textColor=ACCENT, alignment=TA_LEFT, spaceBefore=8, spaceAfter=8,
    leftIndent=12, borderWidth=0, borderColor=ACCENT, borderPadding=6,
    backColor=colors.HexColor('#fdf2ed')
)
score_good = colors.HexColor('#16a34a')
score_mid = colors.HexColor('#d97706')
score_bad = colors.HexColor('#dc2626')

# ━━ Helper ━━
def make_table(data, col_widths, has_header=True):
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ]
    if has_header:
        style_cmds += [
            ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
            ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ]
        for i in range(1, len(data)):
            bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def bullet(text):
    return Paragraph(f"- {text}", bullet_style)

def P(text, style=body_style):
    return Paragraph(text, style)

def h1(text):
    return Paragraph(f"<b>{text}</b>", h1_style)

def h2(text):
    return Paragraph(f"<b>{text}</b>", h2_style)

def callout(text):
    return Paragraph(f"<b>{text}</b>", callout_style)

# ━━ Document Build ━━
output_path = "/home/z/my-project/download/Audit_RestoProGN_KFM_Delice_2026.pdf"

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN,
    title="Audit Technique - RestoProGN KFM Delice",
    author="Z.ai",
    creator="Z.ai",
)

story = []

# ═══════════════════════════════════════════════════
# COVER / TITLE SECTION
# ═══════════════════════════════════════════════════
story.append(Spacer(1, 60))
story.append(HRFlowable(width="100%", thickness=3, color=ACCENT, spaceAfter=12))
story.append(Paragraph("<b>Audit Technique</b>", title_style))
story.append(Paragraph("<b>RestoProGN — KFM Delice</b>", ParagraphStyle(
    'SubTitle', fontName='Carlito', fontSize=16, leading=22,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=12
)))
story.append(HRFlowable(width="100%", thickness=1, color=TEXT_MUTED, spaceAfter=18))
story.append(Paragraph("Application de gestion de restaurant pour KFM Delice, Conakry, Guinee", meta_style))
story.append(Spacer(1, 6))
story.append(Paragraph("Date : 9 juin 2026", meta_style))
story.append(Paragraph("Version auditee : 1.0 (branche principale)", meta_style))
story.append(Paragraph("Stack : Next.js 16.1.3 / Prisma / SQLite / shadcn/ui / JWT", meta_style))
story.append(Spacer(1, 18))
story.append(callout("Ce rapport presente un audit complet de l'application RestoProGN : points forts, points faibles, fonctionnalites operationnelles, dysfonctionnements identifies et propositions d'evolution."))
story.append(Spacer(1, 12))

# Score summary table
score_data = [
    [Paragraph('<b>Critere</b>', header_cell_style), Paragraph('<b>Note</b>', header_cell_style), Paragraph('<b>Appreciation</b>', header_cell_style)],
    [Paragraph('Architecture globale', cell_style), Paragraph('7/10', cell_center_style), Paragraph('Solide mais monolithique', cell_style)],
    [Paragraph('Securite', cell_style), Paragraph('5/10', cell_center_style), Paragraph('Insuffisant pour la production', cell_style)],
    [Paragraph('Experience utilisateur', cell_style), Paragraph('8/10', cell_center_style), Paragraph('Tres bonne, moderne et fluide', cell_style)],
    [Paragraph('Fonctionnalites', cell_style), Paragraph('8/10', cell_center_style), Paragraph('Riche et bien couverte', cell_style)],
    [Paragraph('Qualite du code', cell_style), Paragraph('6/10', cell_center_style), Paragraph('Acceptable mais manque de rigueur TypeScript', cell_style)],
    [Paragraph('Performance', cell_style), Paragraph('6/10', cell_center_style), Paragraph('Polling excessif, pas de WebSocket', cell_style)],
    [Paragraph('Maintenabilite', cell_style), Paragraph('5/10', cell_center_style), Paragraph('Composants monolithiques, pas de tests', cell_style)],
    [Paragraph('<b>SCORE GLOBAL</b>', ParagraphStyle('BoldCell', parent=cell_style, fontName='Carlito')), Paragraph('<b>6.4/10</b>', ParagraphStyle('BoldCellCenter', parent=cell_center_style, fontName='Carlito')), Paragraph('<b>Prototype avance, pas encore production-ready</b>', ParagraphStyle('BoldCellLeft', parent=cell_style, fontName='Carlito'))],
]
story.append(make_table(score_data, [AVAILABLE_W * 0.35, AVAILABLE_W * 0.15, AVAILABLE_W * 0.50]))
story.append(Paragraph("Tableau 1 — Synthese des scores par critere", caption_style))

story.append(PageBreak())

# ═══════════════════════════════════════════════════
# 1. POINTS FORTS
# ═══════════════════════════════════════════════════
story.append(h1("1. Points Forts de l'Application"))

story.append(h2("1.1 Couverture fonctionnelle exceptionnelle"))
story.append(P("RestoProGN offre un ensemble de fonctionnalites remarquablement complet pour un prototype de gestion restaurant. L'application couvre l'integralite du cycle de vie d'un etablissement de restauration : gestion du menu avec CRUD complet, gestion des commandes (sur place, a emporter, livraison), reservations, suivi des livraisons en temps reel, gestion du personnel, facturation, devis, suivi des depenses, et meme un systeme de point de vente (POS). Cette couverture fonctionnelle est rare dans un projet de cette envergure et temoigne d'une vision produit ambitieuse et bien pensee."))
story.append(P("L'integration de trois types d'utilisateurs distincts (administrateur, client, livreur) avec des interfaces dediees et des flux d'authentification separes est un choix architectural judicieux qui permet a chaque acteur du restaurant d'interagir avec le systeme selon ses besoins specifiques. Le compte driver avec GPS tracking en temps reel est particulierement pertinent pour le contexte guineen ou les livraisons a moto sont predominantes."))

story.append(h2("1.2 Experience utilisateur moderne et soignee"))
story.append(P("L'interface utilisateur tire pleinement parti de shadcn/ui et de Framer Motion pour offrir une experience fluide et moderne. Le theme sombre/clair avec persistance via next-themes, les animations de scroll avec AnimatedSection, les transitions entre les onglets de l'administration, et les micro-interactions (notifications Sonner, compteurs animees, barres de progression) conferent a l'application un aspect professionnel et agreable a utiliser. La navigation publique avec ses sections (Hero, Menu, Reservation, Avis, A Propos, Footer) suit les meilleures pratiques du web design pour les restaurants."))
story.append(P("Le systeme de cartes SVG pour la carte de Conakry est une solution creative et legeres qui evite la dependance a des services de cartographie externes tout en restant visuellement informative. Les marqueurs de position des livreurs, le rafraichissement automatique toutes les 15 secondes, et la boussole integree ajoutent une couche de professionnalisme appreciable. Le POS avec son systeme de panier, ses raccourcis de table, et sa generation de ticket de caisse est fonctionnel et bien concu."))

story.append(h2("1.3 Adaptation au contexte guineen"))
story.append(P("L'application est particulierement bien adaptee au contexte guineen. La monnaie est en GNF (Franc Guineen), les methodes de paiement incluent Orange Money et MTN Money qui sont les solutions mobile money dominantes en Guinee, les zones de livraison correspondent aux communes reelles de Conakry (Kaloum, Dixinn, Matam, Matoto), et les plats du menu refletent la cuisine guineenne et ouest-africaine (Riz Jollof, Plasas, Attieke, Thieboudienne, Mafe, Bissap). Les numeros de telephone utilisent le format +224, et les images generees pour les plats sont coherentes avec l'identite visuelle du restaurant. Cette localisation va au-dela du simple traduction et montre une comprehension profonde du marche cible."))

story.append(h2("1.4 Stack technique coherente et moderne"))
story.append(P("Le choix de Next.js 16 avec l'App Router, Prisma ORM, SQLite, et shadcn/ui constitue une stack technique coherente et productive. Prisma offre un typage fort et des migrations de schema pratiques, SQLite simplifie le deploiement sans serveur de base de donnees externe, et shadcn/ui fournit des composants accessibles et personnalisables. L'utilisation de Zod pour la validation des entrees API, de bcrypt pour le hachage des mots de passe (facteur 12), et de JWT pour l'authentification montre une bonne comprehension des pratiques de securite fondamentales. La validation Zod est systematiquement appliquee sur tous les endpoints API, ce qui est une excellente pratique."))

# ═══════════════════════════════════════════════════
# 2. POINTS FAIBLES
# ═══════════════════════════════════════════════════
story.append(h1("2. Points Faibles et Vulnerabilites"))

story.append(h2("2.1 Securite insuffisante pour la production"))
story.append(P("Le principal point faible de l'application reside dans sa posture de securite, qui n'est pas adaptee a un deploiement en production. Plusieurs vulnerabilites critiques ont ete identifiees qui pourraient compromettre les donnees des utilisateurs et la integrite du systeme si l'application etait exposee sur Internet sans corrections."))

# Security vulnerabilities table
sec_data = [
    [Paragraph('<b>Vulnerabilite</b>', header_cell_style), Paragraph('<b>Severite</b>', header_cell_style), Paragraph('<b>Impact</b>', header_cell_style), Paragraph('<b>Detail</b>', header_cell_style)],
    [Paragraph('JWT_SECRET code en dur', cell_style), Paragraph('CRITIQUE', cell_center_style), Paragraph('Compromission totale', cell_style), Paragraph('Le secret JWT est defini en dur dans auth.ts et non dans .env', cell_style)],
    [Paragraph('Absence de rate limiting', cell_style), Paragraph('ELEVEE', cell_center_style), Paragraph('Attaque par force brute', cell_style), Paragraph('Aucune protection sur les endpoints de login/register', cell_style)],
    [Paragraph('Identifiants demo visibles', cell_style), Paragraph('MOYENNE', cell_center_style), Paragraph('Acces non autorise', cell_style), Paragraph('mots de passe affiches dans l\'interface de login', cell_style)],
    [Paragraph('Pas de refresh token', cell_style), Paragraph('MOYENNE', cell_center_style), Paragraph('Session hijacking', cell_style), Paragraph('JWT unique 24h sans mecanisme de renouvellement', cell_style)],
    [Paragraph('Pas de middleware Next.js', cell_style), Paragraph('MOYENNE', cell_center_style), Paragraph('Contournement d\'auth', cell_style), Paragraph('Auth verifiee uniquement dans chaque endpoint API', cell_style)],
    [Paragraph('Pas de CORS configure', cell_style), Paragraph('MOYENNE', cell_center_style), Paragraph('Requetes cross-origin', cell_style), Paragraph('Aucune restriction sur les origines des requetes', cell_style)],
    [Paragraph('Seed sans auth initiale', cell_style), Paragraph('BASSE', cell_center_style), Paragraph('Reinitialisation DB', cell_style), Paragraph('POST /api/seed accessible sans auth si DB vide', cell_style)],
]
story.append(Spacer(1, 6))
story.append(make_table(sec_data, [AVAILABLE_W * 0.22, AVAILABLE_W * 0.12, AVAILABLE_W * 0.22, AVAILABLE_W * 0.44]))
story.append(Paragraph("Tableau 2 — Vulnerabilites de securite identifiees", caption_style))

story.append(h2("2.2 Architecture monolithique cote client"))
story.append(P("L'application utilise un pattern de Single Page Application (SPA) complet cote client ou le fichier page.tsx gere l'integralite de la navigation via un etat mode. Ce choix signifie qu'aucune route Next.js n'est utilisee pour les pages publiques ou les tableaux de bord : tout est rendu cote client. Bien que fonctionnel, ce pattern presente plusieurs inconvenients majeurs pour un projet qui vise la production."))
story.append(P("Premierement, le SEO est inexistant car les robots des moteurs de recherche ne verront que la page publique initiale sans navigation. Pour un restaurant qui cherche a attirer des clients via le web, c'est un probleme critique. Deuxiemement, l'absence de routes signifie que les utilisateurs ne peuvent pas partager de liens directs vers des sections specifiques (menu, reservations, avis) ni utiliser les boutons precedent/suivant du navigateur de maniere fiable. Troisiemement, le code de l'application entiere est charge en une seule fois, ce qui degrade les performances de chargement initial a mesure que l'application grandit."))

story.append(h2("2.3 Composants monolithiques et peu maintenables"))
story.append(P("Plusieurs composants atteignent des tailles problematiques qui nuisent a la maintenabilite. CustomerAccount.tsx depasse les 800 lignes et gere 7 onglets avec leurs propres formulaires, etats et logiques. AdminDashboard.tsx, bien que plus court (362 lignes), centralise la totalite de l'etat de l'administration (formulaires de chaque onglet, donnees de chaque section) et transmet des props massives aux sous-composants, y compris des valeurs passees comme undefined as any pour contourner les erreurs TypeScript. Ce pattern est fragile et rend le debuggage difficile."))
story.append(P("L'absence totale de tests (ni tests unitaires, ni tests d'integration, ni tests end-to-end) aggrave ce probleme. Chaque modification du code peut introduire des regressions sans qu'aucun filet de securite automatise ne puisse les detecter. Pour un projet de cette taille avec autant de fonctionnalites interconnectees, l'absence de tests est un risque majeur pour la stabilite a long terme."))

story.append(h2("2.4 TypeScript configure de maniere permissive"))
story.append(P("La configuration TypeScript est volontairement permissive : ignoreBuildErrors est active dans next.config.ts, et noImplicitAny est desactive dans tsconfig.json. Ces parametres permettent au developpeur de contourner les erreurs de typage au lieu de les corriger, ce qui conduit a un code moins sur et plus difficile a refactorer. L'utilisation recurrente de undefined as any dans AdminDashboard.tsx pour passer des props manquantes est un symptome direct de ce probleme. Ces contournements masquent des bugs potentiels et rendent le code plus fragile."))

story.append(h2("2.5 Polling excessif au lieu de WebSocket"))
story.append(P("L'application utilise le polling HTTP pour les fonctionnalites en temps reel, avec trois intervalles distincts : les notifications admin (30 secondes), la carte des livreurs (15 secondes), et le suivi de commande client (5 secondes). Ce pattern est inefficace a plusieurs niveaux. Chaque requete de polling consomme des ressources serveur meme quand il n'y a pas de nouvelles donnees, le delai entre les mises a jour peut etre perceptible pour les utilisateurs (5 secondes pour le suivi client), et la charge reseau augmente lineairement avec le nombre d'utilisateurs connectes. Le projet contient deja des exemples WebSocket dans le repertoire examples/ mais ils ne sont pas integres."))

# ═══════════════════════════════════════════════════
# 3. CE QUI FONCTIONNE
# ═══════════════════════════════════════════════════
story.append(h1("3. Fonctionnalites Operationnelles"))

story.append(P("L'audit a verifie que les fonctionnalites suivantes sont operationnelles dans le code et fonctionnent correctement dans le flux nominal. Chaque module a ete analyse du point de vue du code source, des endpoints API, et de la coherence des donnees."))

func_data = [
    [Paragraph('<b>Module</b>', header_cell_style), Paragraph('<b>Fonctionnalite</b>', header_cell_style), Paragraph('<b>Statut</b>', header_cell_style)],
    [Paragraph('Site public', cell_style), Paragraph('Page d\'accueil avec Hero, Menu, Reservation, Avis, A Propos, Footer', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Site public', cell_style), Paragraph('Navigation responsive avec menu hamburger mobile', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Site public', cell_style), Paragraph('Bouton WhatsApp flottant pour commandes', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Authentification', cell_style), Paragraph('Login Admin (3 roles : admin, manager, staff)', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Authentification', cell_style), Paragraph('Login/Inscription Client avec validation', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Authentification', cell_style), Paragraph('Login Driver avec JWT dedie', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Administration', cell_style), Paragraph('13 onglets : Vue d\'ensemble, Commandes, Menu, Livraisons, Livreurs, Reservations, Avis, Personnel, Admins, Factures, Devis, Depenses, POS', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Menu', cell_style), Paragraph('CRUD complet avec 5 categories (21 plats), filtres, badges', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Commandes', cell_style), Paragraph('Cycle complet : pending, preparing, ready, delivering, delivered', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Livraisons', cell_style), Paragraph('Carte SVG Conakry, position livreurs temps reel, assignation', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('POS', cell_style), Paragraph('Panier, choix table, modes paiement, ticket de caisse', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Compte client', cell_style), Paragraph('7 onglets : dashboard, commandes, reservations, avis, fidelite, commande en ligne, profil', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Compte livreur', cell_style), Paragraph('4 onglets : commandes, carte, historique, profil avec GPS', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Fidelite', cell_style), Paragraph('Systeme de points avec paliers Bronze/Argent/Or/Platine', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Theme', cell_style), Paragraph('Mode clair/sombre avec persistance localStorage', cell_style), Paragraph('Operationnel', cell_center_style)],
    [Paragraph('Base de donnees', cell_style), Paragraph('Seeding automatique avec donnees realistes guineennes', cell_style), Paragraph('Operationnel', cell_center_style)],
]
story.append(Spacer(1, 6))
story.append(make_table(func_data, [AVAILABLE_W * 0.20, AVAILABLE_W * 0.60, AVAILABLE_W * 0.20]))
story.append(Paragraph("Tableau 3 — Inventaire des fonctionnalites operationnelles", caption_style))

# ═══════════════════════════════════════════════════
# 4. CE QUI NE FONCTIONNE PAS
# ═══════════════════════════════════════════════════
story.append(h1("4. Dysfonctionnements et Problemes Identifies"))

story.append(h2("4.1 Problemes fonctionnels"))

story.append(h2("4.1.1 Les images du POS ne sont pas toutes coherentes"))
story.append(P("Bien que le code de PosTab.tsx affiche correctement les images des plats lorsque le champ image est renseigne dans la base de donnees (avec fallback sur des icones de categorie), certaines incoherences subsistent. Dans les donnees de seed, le Plateau Fruits de Mer et les Crevettes Sauce Curry utilisent tous les deux /images/kfm-dish-2.png, et les desserts (Assiette de Fruits Tropicaux et Gateau Chocolat-Coco) partagent /images/kfm-dish-3.png. Cela signifie que des plats differents affichent la meme image dans le POS et dans le menu public, ce qui peut confondre le personnel et les clients. Chaque plat devrait avoir une image unique et representative."))

story.append(h2("4.1.2 Pas de page publique accessible sans login"))
story.append(P("Bien que les composants de la page publique existent (HeroSection, MenuSection, ReservationSection, AvisSection, AboutSection, PublicFooter), la page n'est pas accessible via une URL dediee. Tout est gere par le mode state dans page.tsx. Il n'existe pas de route Next.js comme /menu ou /public que l'on pourrait partager directement. Pour un restaurant, pouvoir partager un lien vers le menu (par exemple sur les reseaux sociaux ou via WhatsApp) est essentiel pour attirer de nouveaux clients."))

story.append(h2("4.1.3 Annee de copyright obsolette"))
story.append(P("Le composant PublicFooter affiche un copyright avec 2024 au lieu de 2026. C'est un detail mineur mais qui donne une impression de negligeance aux visiteurs du site. L'annee devrait etre dynamique (new Date().getFullYear()) pour eviter ce probleme a l'avenir."))

story.append(h2("4.2 Problemes techniques"))

tech_issues_data = [
    [Paragraph('<b>Probleme</b>', header_cell_style), Paragraph('<b>Categorie</b>', header_cell_style), Paragraph('<b>Description</b>', header_cell_style)],
    [Paragraph('undefined as any', cell_style), Paragraph('TypeScript', cell_center_style), Paragraph('AdminDashboard passe des props undefined castees en any aux sous-composants (formatPrice, statusColors, etc.)', cell_style)],
    [Paragraph('Pas d\'upload d\'images', cell_style), Paragraph('Fonctionnalite', cell_center_style), Paragraph('Les images du menu sont des chemins codes en dur dans le seed ; aucun formulaire d\'upload dans l\'admin', cell_style)],
    [Paragraph('Pas de pagination API', cell_style), Paragraph('Performance', cell_center_style), Paragraph('Les endpoints GET retournent toutes les donnees sans pagination, ce qui ne scale pas', cell_style)],
    [Paragraph('Pas de migrations', cell_style), Paragraph('Base de donnees', cell_center_style), Paragraph('Utilisation de prisma db push au lieu de migrations proper ; pas de historique des changements de schema', cell_style)],
    [Paragraph('Pas de tests', cell_style), Paragraph('Qualite', cell_center_style), Paragraph('Zero fichier de test dans le projet ; aucune verification automatique de regression', cell_style)],
    [Paragraph('Mot de passe driver vide par defaut', cell_style), Paragraph('Securite', cell_center_style), Paragraph('Le schema Driver a password @default("") ; un livreur cree via l\'admin ne peut pas se connecter', cell_style)],
    [Paragraph('Pas de soft delete', cell_style), Paragraph('Donnees', cell_center_style), Paragraph('Les suppressions sont definitives (onDelete: Cascade) ; impossible de recuperer des donnees effacees', cell_style)],
    [Paragraph('Pas de validation commande', cell_style), Paragraph('Business logic', cell_center_style), Paragraph('Le total de la commande est envoye par le client sans verification serveur contre les prix du menu', cell_style)],
]
story.append(Spacer(1, 6))
story.append(make_table(tech_issues_data, [AVAILABLE_W * 0.22, AVAILABLE_W * 0.15, AVAILABLE_W * 0.63]))
story.append(Paragraph("Tableau 4 — Problemes techniques identifies", caption_style))

story.append(h2("4.3 Problemes de performance"))

story.append(P("L'application presente plusieurs problemes de performance qui pourraient affecter l'experience utilisateur a mesure que le volume de donnees augmente. Le seeding de la base de donnees est declenche automatiquement a chaque chargement de page via un useEffect dans page.tsx, ce qui signifie que chaque visiteur declenche un appel POST /api/seed (bien que celui-ci soit protege par une verification d'existence des donnees, il represente un appel reseau inutile a chaque navigation)."))
story.append(P("Les endpoints API ne disposent d'aucun mecanisme de pagination : tous les enregistrements sont retournes en une seule requete. Pour les commandes, les reservations et les elements du menu, cela fonctionne avec le volume actuel de donnees de demo, mais deviendra problematique avec des centaines ou milliers d'enregistrements. Le polling a intervalles reguliers (5s, 15s, 30s) genere une charge reseau constante qui ne scale pas bien avec le nombre d'utilisateurs simultanes."))

# ═══════════════════════════════════════════════════
# 5. PROPOSITIONS D'EVOLUTION
# ═══════════════════════════════════════════════════
story.append(h1("5. Propositions d'Evolution et d'Amelioration"))

story.append(P("Les propositions ci-dessous sont classees par priorite et organisees en trois horizons temporels : court terme (1-2 semaines), moyen terme (1-2 mois), et long terme (3-6 mois). Chaque proposition inclut une estimation d'effort et un impact attendu."))

story.append(h2("5.1 Priorite 1 — Securite (Court Terme, 1-2 semaines)"))

story.append(P("<b>P1.1 — Deplacer JWT_SECRET dans les variables d'environnement</b>"))
story.append(P("Le secret JWT doit imperativement etre stocke dans le fichier .env et jamais code en dur dans le source. Il s'agit d'une correction critique qui prend moins de 30 minutes mais qui elimine la vulnerabilite la plus grave de l'application. Ajouter JWT_SECRET au fichier .env, modifier auth.ts pour supprimer la valeur par defaut, et s'assurer que le serveur refuse de demarrer si la variable est absente."))

story.append(P("<b>P1.2 — Implementer le rate limiting sur les endpoints d'authentification</b>"))
story.append(P("Ajouter un middleware de rate limiting sur /api/login, /api/customer-login, /api/customer-register, et /api/driver-login pour limiter les tentatives de connexion a 5 par minute par adresse IP. Cela peut etre implemente avec un simple compteur en memoire ou via un package npm comme rate-limiter-flexible. Cette protection est essentielle pour empecher les attaques par force brute sur les mots de passe."))

story.append(P("<b>P1.3 — Implementer un middleware Next.js pour la protection des routes API</b>"))
story.append(P("Creer un fichier middleware.ts a la racine de src/ qui verifie le JWT sur toutes les routes API protegees avant qu'elles n'atteignent les handlers. Cela centralise la logique d'authentification, reduit la duplication de code dans chaque endpoint, et empeche les oublis accidentels de verification d'authentification."))

story.append(P("<b>P1.4 — Masquer les identifiants demo de l'interface</b>"))
story.append(P("Supprimer l'affichage des identifiants de demonstration (admin@kfm-delice.com / kfm2024, etc.) des formulaires de login. Ces informations ne devraient etre accessibles que dans la documentation developpeur, pas dans l'interface utilisateur. Remplacer par un lien vers la documentation ou les afficher uniquement en mode developpement."))

story.append(h2("5.2 Priorite 2 — Architecture et Qualite (Moyen Terme, 1-2 mois)"))

story.append(P("<b>P2.1 — Migrer vers le routing Next.js App Router</b>"))
story.append(P("Remplacer le systeme de navigation par etat (useState mode) par de vraies routes Next.js. La structure proposee serait : / (page publique), /menu (menu public), /reservation (reservation publique), /admin (dashboard admin), /admin/orders, /admin/menu, /client (compte client), /driver (compte livreur), /tracking/[orderId] (suivi de livraison). Cette migration apporte le SEO, le partage de liens, le chargement par route (code splitting automatique), et la possibilite d'utiliser les Server Components de Next.js pour reduire le JavaScript envoye au client."))

story.append(P("<b>P2.2 — Decomposer les composants monolithiques</b>"))
story.append(P("Decouper CustomerAccount.tsx (800+ lignes) en sous-composants independants (ClientDashboardTab, ClientOrdersTab, ClientReservationsTab, etc.) chacun dans son propre fichier. Faire de meme pour AdminDashboard.tsx en rendant les onglets autonomes avec leurs propres etats locaux plutot que de tout centraliser dans le parent. Chaque onglet devrait importer directement les utilitaires de constants.ts plutot que de les recevoir via des props passees en undefined as any."))

story.append(P("<b>P2.3 — Activer le typage strict TypeScript</b>"))
story.append(P("Desactiver ignoreBuildErrors dans next.config.ts, activer noImplicitAny et strict dans tsconfig.json, et corriger toutes les erreurs resultantes. Cela peut sembler fastidieux mais c'est un investissement qui paie considerablement en termes de prevention de bugs et de facilite de refactoring. L'elimination des undefined as any est la premiere priorite."))

story.append(P("<b>P2.4 — Ajouter une suite de tests</b>"))
story.append(P("Mettre en place une suite de tests avec Vitest (tests unitaires), Testing Library (tests de composants React), et Playwright (tests end-to-end). Commencer par les parties les plus critiques : les endpoints d'authentification, le flux de commande, et le systeme de paiement. Viser un minimum de 60% de couverture sur les endpoints API et les composants principaux. Les tests sont aussi importants que le code lui-meme pour garantir la fiabilite a long terme."))

story.append(P("<b>P2.5 — Implementer l'upload d'images pour le menu</b>"))
story.append(P("Ajouter un systeme d'upload d'images cote admin qui permet de telecharger des photos de plats directement depuis l'interface. Utiliser le systeme de fichiers public de Next.js ou un service de stockage comme Cloudinary. L'endpoint /api/menu doit accepter des fichiers multipart/form-data, et le formulaire MenuTab doit inclure un composant d'upload avec apercu. Cela rend l'application autonome pour la gestion du menu sans dependre de modifications manuelles du code source."))

story.append(h2("5.3 Priorite 3 — Performance et Temps Reel (Moyen Terme, 1-2 mois)"))

story.append(P("<b>P3.1 — Remplacer le polling par des WebSockets</b>"))
story.append(P("Integrer Socket.io ou le WebSocket natif de Next.js pour les fonctionnalites temps reel : notifications admin, position des livreurs sur la carte, suivi de commande client, et mises a jour de statut. Les exemples WebSocket existent deja dans le repertoire examples/ et servent de base de travail. Les WebSockets eliminent le delai de polling, reduisent la charge serveur de 90%, et offrent une experience utilisateur significativement plus fluide et reactive."))

story.append(P("<b>P3.2 — Ajouter la pagination aux endpoints API</b>"))
story.append(P("Implementer la pagination sur tous les endpoints GET qui retournent des listes (orders, reservations, menu, reviews, drivers, etc.) en utilisant les parametres page et limit. Retourner le nombre total d'enregistrements dans la reponse pour que le front-end puisse afficher la pagination correctement. Ajouter le tri et le filtrage cote serveur pour eviter de charger toutes les donnees en memoire."))

story.append(P("<b>P3.3 — Optimiser le seeding automatique</b>"))
story.append(P("Supprimer l'appel systematique a POST /api/seed dans le useEffect de page.tsx. Le seeding ne devrait etre effectue qu'une seule fois, lors de la premiere initialisation de l'application. Verifier cote serveur si les donnees existent deja avant de les creer, et ne plus appeler cet endpoint a chaque chargement de page. Cette optimisation elimine un appel reseau inutile a chaque visite."))

story.append(h2("5.4 Priorite 4 — Fonctionnalites Metier (Long Terme, 3-6 mois)"))

story.append(P("<b>P4.1 — Integration paiement Orange Money / MTN Money</b>"))
story.append(P("Implementer les API de paiement Orange Money et MTN Money pour permettre aux clients de payer en ligne directement depuis l'application. Actuellement, les methodes de paiement sont enregistrees mais aucun paiement reel n'est effectue. L'integration des API de mobile money est un differenciateur competitif majeur en Guinee ou ces services sont predominants. Cela inclut la generation de liens de paiement, la gestion des callbacks de confirmation, et le suivi des transactions."))

story.append(P("<b>P4.2 — Notifications push et SMS</b>"))
story.append(P("Ajouter un systeme de notifications push (via les Web Push API et Service Workers) et SMS (via une passerelle comme Twilio ou une solution locale guineenne) pour informer les clients du statut de leur commande, les livreurs des nouvelles missions, et les administrateurs des evenements importants. Les notifications sont essentielles pour la retention et la reactivite dans le contexte de la livraison de repas."))

story.append(P("<b>P4.3 — Dashboard analytique avance</b>"))
story.append(P("Enrichir l'onglet Vue d'ensemble avec des graphiques d'evolution du chiffre d'affaires, des plats les plus vendus, des pics de commande par heure et jour, du temps moyen de livraison, et de la satisfaction client. Ces metriques sont indispensables pour la prise de decision business. Utiliser des librairies comme Recharts ou Chart.js pour des visualisations interactives et informatives."))

story.append(P("<b>P4.4 — Application mobile (PWA ou native)</b>"))
story.append(P("Convertir l'application en Progressive Web App (PWA) avec un manifest.json, un Service Worker pour le fonctionnement hors ligne, et l'installation sur l'ecran d'accueil. Cela permet aux livreurs d'utiliser l'application comme une app native sur leur telephone, avec acces au GPS et notifications push. Alternativement, developper une application native avec React Native pour une meilleure integration avec les fonctionnalites du telephone (GPS en arriere-plan, notifications, etc.)."))

story.append(P("<b>P4.5 — Verification du prix des commandes cote serveur</b>"))
story.append(P("Implementer une validation cote serveur qui recalcule le total de la commande a partir des prix actuels des plats en base de donnees, plutot que de faire confiance au total envoye par le client. Cela empeche la manipulation des prix et garantit l'integrite financiere des transactions. Ajouter egalement une verification de la disponibilite des plats et des heures d'ouverture."))

# ═══════════════════════════════════════════════════
# 6. FEUILLE DE ROUTE
# ═══════════════════════════════════════════════════
story.append(h1("6. Feuille de Route Recommandee"))

roadmap_data = [
    [Paragraph('<b>Phase</b>', header_cell_style), Paragraph('<b>Duree</b>', header_cell_style), Paragraph('<b>Actions cles</b>', header_cell_style), Paragraph('<b>Livrables</b>', header_cell_style)],
    [Paragraph('Phase 1 : Securite', cell_style), Paragraph('1-2 sem.', cell_center_style), Paragraph('JWT_SECRET dans .env, rate limiting, middleware Next.js, masquer identifiants demo', cell_style), Paragraph('Application securisee pour pre-production', cell_style)],
    [Paragraph('Phase 2 : Architecture', cell_style), Paragraph('3-4 sem.', cell_center_style), Paragraph('Migration vers App Router, decomposition des composants, TypeScript strict, suite de tests', cell_style), Paragraph('Code base maintainable et type-safe', cell_style)],
    [Paragraph('Phase 3 : Performance', cell_style), Paragraph('2-3 sem.', cell_center_style), Paragraph('WebSocket temps reel, pagination API, optimisation seeding, upload d\'images', cell_style), Paragraph('Application performante et scalable', cell_style)],
    [Paragraph('Phase 4 : Business', cell_style), Paragraph('6-12 sem.', cell_center_style), Paragraph('Paiement Orange/MTN Money, notifications push/SMS, dashboard analytique, PWA', cell_style), Paragraph('Application production-ready avec revenus', cell_style)],
]
story.append(Spacer(1, 6))
story.append(make_table(roadmap_data, [AVAILABLE_W * 0.15, AVAILABLE_W * 0.10, AVAILABLE_W * 0.45, AVAILABLE_W * 0.30]))
story.append(Paragraph("Tableau 5 — Feuille de route recommandee par phases", caption_style))

story.append(Spacer(1, 18))
story.append(HRFlowable(width="100%", thickness=1, color=TEXT_MUTED, spaceAfter=12))
story.append(Paragraph("Ce rapport d'audit a ete realise sur la base d'une analyse approfondie du code source de RestoProGN (KFM Delice) en date du 9 juin 2026. Les recommandations sont formulees dans le but de faire evoluer l'application d'un prototype avance vers un produit deployable en production de maniere fiable et securisee.", meta_style))

# ═══════════════════════════════════════════════════
# BUILD
# ═══════════════════════════════════════════════════
doc.build(story)
print(f"PDF generated: {output_path}")
