import { NextRequest, NextResponse } from 'next/server';
import { extractGitHubRepoContent, isGitHubUrl } from '@/lib/github-extractor';

export async function POST(request: NextRequest) {
  try {
    const { url, branch } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid URL parameter' },
        { status: 400 }
      );
    }

    if (!isGitHubUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL format' },
        { status: 400 }
      );
    }

    const result = await extractGitHubRepoContent(url, { branch });

    return NextResponse.json({
      success: true,
      content: result.content,
      repo: result.repo,
      owner: result.owner,
      fileCount: result.fileCount,
    });
  } catch (error) {
    console.error('GitHub extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract repository' },
      { status: 500 }
    );
  }
}
