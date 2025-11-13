import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// Mark as dynamic route (uses search params)
export const dynamic = 'force-dynamic'
// Enable ISR with long revalidation for images (1 day)
export const revalidate = 86400

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const imagePath = searchParams.get('path')

    if (!imagePath) {
      return NextResponse.json(
        { error: 'Image path is required' },
        { status: 400 }
      )
    }

    // Clean up the path - remove ../ prefix if present
    let cleanPath = imagePath.replace(/^\.\.\//, '')

    // Construct full path - images are typically relative to project root
    const fullPath = path.join(process.cwd(), cleanPath)

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'Image not found', path: fullPath },
        { status: 404 }
      )
    }

    // Read file
    const fileBuffer = fs.readFileSync(fullPath)

    // Determine content type based on extension
    const ext = path.extname(fullPath).toLowerCase()
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    }

    const contentType = contentTypeMap[ext] || 'image/jpeg'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    )
  }
}
