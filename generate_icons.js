import sharp from 'sharp';
import fs from 'fs';

async function generateIcons() {
  const svgBuffer = fs.readFileSync('./public/favicon.svg');
  
  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('./public/icon-192.png');
    
  console.log('Created icon-192.png');

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('./public/icon-512.png');
    
  console.log('Created icon-512.png');
  
  // apple-touch-icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile('./public/apple-touch-icon.png');
    
  console.log('Created apple-touch-icon.png');
}

generateIcons().catch(console.error);
