#!/usr/bin/env python3
"""Merge cover + body PDFs into final single PDF"""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

def normalize_page_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
        from pypdf import Transformation
        sx, sy = A4_W / w, A4_H / h
        page.add_transformation(Transformation().scale(sx=sx, sy=sy))
        page.mediabox.lower_left = (0, 0)
        page.mediabox.upper_right = (A4_W, A4_H)
    return page

cover_pdf = '/home/z/my-project/download/cover_restaurant_model.pdf'
body_pdf = '/home/z/my-project/download/restaurant_booking_pro_guinee.pdf'
output_pdf = '/home/z/my-project/download/Restaurant_Booking_Pro_Guinee.pdf'

writer = PdfWriter()
cover_page = PdfReader(cover_pdf).pages[0]
writer.add_page(normalize_page_to_a4(cover_page))

for page in PdfReader(body_pdf).pages:
    writer.add_page(normalize_page_to_a4(page))

writer.add_metadata({
    '/Title': 'Restaurant Booking Pro - Modele pour restaurants en Guinee',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Proposition commerciale - Plateforme digitale pour restaurants en Guinee'
})

with open(output_pdf, 'wb') as f:
    writer.write(f)

print(f"PDF final genere : {output_pdf}")

import os
size_mb = os.path.getsize(output_pdf) / (1024 * 1024)
print(f"Taille : {size_mb:.2f} MB")
total_pages = len(PdfReader(output_pdf).pages)
print(f"Pages : {total_pages}")
