#!/usr/bin/env python3
"""Generate radar chart for KFM Délice audit scores."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np

# Font setup
fm.fontManager.addfont('/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf')
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
plt.rcParams['font.sans-serif'] = ['Sarasa Mono SC', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# Data
categories = [
    'Architecture\nGlobale',
    'Securite',
    'Experience\nUtilisateur',
    'Fonctionnalites',
    'Qualite du\nCode',
    'Performance',
    'Maintenabilite'
]
scores = [7, 5, 8, 8, 6, 6, 5]

N = len(categories)
angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
scores_plot = scores + [scores[0]]
angles += angles[:1]

fig, ax = plt.subplots(figsize=(7, 7), subplot_kw=dict(polar=True))

# Style
ax.set_theta_offset(np.pi / 2)
ax.set_theta_direction(-1)
ax.set_rlabel_position(0)

# Draw grid
ax.set_ylim(0, 10)
ax.set_yticks([2, 4, 6, 8, 10])
ax.set_yticklabels(['2', '4', '6', '8', '10'], fontsize=9, color='#7a766e')
ax.set_xticks(angles[:-1])
ax.set_xticklabels(categories, fontsize=11, fontweight='bold', color='#22211e')

# Fill area
ax.fill(angles, scores_plot, color='#af4c2b', alpha=0.15)
ax.plot(angles, scores_plot, color='#af4c2b', linewidth=2.5, linestyle='-')

# Score points
ax.scatter(angles[:-1], scores, color='#af4c2b', s=80, zorder=5, edgecolors='white', linewidths=2)

# Add score labels
for angle, score, cat in zip(angles[:-1], scores, categories):
    offset = 1.15
    ax.text(angle, score * offset, f'{score}/10', ha='center', va='center',
            fontsize=12, fontweight='bold', color='#af4c2b')

# Title
ax.set_title('SCORES PAR CATEGORIE', fontsize=14, fontweight='bold',
             color='#22211e', pad=30)

# Remove outer frame
ax.spines['polar'].set_visible(False)
ax.grid(color='#dedbd6', linewidth=0.8)

plt.tight_layout()
plt.savefig('/home/z/my-project/download/radar_chart.png', dpi=200, bbox_inches='tight',
            facecolor='#efeeec', edgecolor='none')
plt.close()
print("Radar chart saved.")
