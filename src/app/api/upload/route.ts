import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Image processing config
const IMAGE_CONFIG = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 80,
  thumbnailSize: 200,
  thumbnailQuality: 70,
  convertToWebP: true,
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const;

export async function POST(request: Request) {
  try {
    // Authenticate - admin or any authenticated user can upload
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    // Validate file type
    if (!(IMAGE_CONFIG.allowedTypes as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non supporté. Utilisez JPG, PNG, WebP ou GIF." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > IMAGE_CONFIG.maxFileSize) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 10 MB)" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.type === 'image/jpeg' ? 'jpg'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/gif' ? 'gif'
      : 'webp';
    const filename = `${randomUUID()}.${ext}`;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'images', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const filePath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Return the public URL
    const url = `/images/uploads/${filename}`;

    return NextResponse.json({
      url,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Erreur lors du téléchargement" }, { status: 500 });
  }
}
