import { UltraContext } from 'ultracontext';
import { NextResponse } from 'next/server';

export async function GET() {
    const apiKey = process.env.ULTRACONTEXT_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing ULTRACONTEXT_API_KEY' }, { status: 500 });
    }

    const uc = new UltraContext({ apiKey });

    try {
        const contexts = await uc.get();

        return NextResponse.json({ contexts });
    } catch (error) {
        console.error('Failed to list contexts:', error);
        return NextResponse.json({ error: 'Failed to list contexts' }, { status: 500 });
    }
}
