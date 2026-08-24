import { NextResponse } from 'next/server';
import { getDefaultFormat, getImageFormats } from '@/lib/imageFormats';

/** Catálogo de formatos para la UI (el middleware exige sesión). */
export async function GET() {
  return NextResponse.json({
    formats: getImageFormats(),
    default: getDefaultFormat(),
  });
}
