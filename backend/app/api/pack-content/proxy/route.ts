import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('=== PROXY ENDPOINT CALLED ===');
  console.log('Request URL:', request.url);
  console.log('Request method:', request.method);
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const token = searchParams.get('token');

    console.log('=== PROXY DEBUG ===');
    console.log('Target URL:', targetUrl);
    console.log('Token length:', token?.length);
    console.log('Token start:', token?.substring(0, 50));
    console.log('Token end:', token?.substring(token.length - 50));

    if (!targetUrl) {
      console.log('ERROR: No target URL provided');
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    if (!token) {
      console.log('ERROR: No token provided');
      return NextResponse.json({ error: 'Token parameter is required' }, { status: 400 });
    }

    console.log('Making request to Cloud Function...');
    
    // Make request to Cloud Function with JWT token in Authorization header
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Vixter-Proxy/1.0'
      }
    });

    console.log('Cloud Function response status:', response.status);
    console.log('Cloud Function response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloud Function error:', response.status, response.statusText);
      console.error('Cloud Function error body:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch content', status: response.status, details: errorText },
        { status: response.status }
      );
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    console.log('Content-Type:', contentType);
    console.log('Starting to stream response...');
    
    // Stream the response back to the client
    const stream = new ReadableStream({
      start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          console.log('ERROR: No response body reader available');
          controller.close();
          return;
        }

        console.log('Response body reader created, starting to pump...');

        function pump(): Promise<void> {
          return reader!.read().then(({ done, value }) => {
            if (done) {
              console.log('Stream completed successfully');
              controller.close();
              return;
            }
            console.log('Pumping chunk of size:', value?.length);
            controller.enqueue(value);
            return pump();
          });
        }

        return pump();
      }
    });

    console.log('Returning streamed response...');
    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Disposition': 'inline'
      }
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
