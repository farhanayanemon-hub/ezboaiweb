import type { RequestHandler } from './$types.js';
import fs from 'node:fs';
import path from 'node:path';

export const GET: RequestHandler = async () => {
  const apkPath = path.resolve('static/downloads/ezboai.apk');

  if (!fs.existsSync(apkPath)) {
    return new Response('APK file not found', { status: 404 });
  }

  const stat = fs.statSync(apkPath);
  const stream = fs.createReadStream(apkPath);

  // Convert Node ReadStream to web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    }
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="EzboAI.apk"',
      'Content-Length': stat.size.toString(),
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
