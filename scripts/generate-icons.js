#!/usr/bin/env node

/**
 * Generate app icons from source image
 * Converts JPG to PNG, crops to square, and generates platform-specific icons
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_ICON = path.join(__dirname, '../assets/icon-source.png');
const OUTPUT_PNG = path.join(__dirname, '../assets/icon.png');
const ASSETS_DIR = path.join(__dirname, '../assets');

async function generateIcons() {
  console.log('🎨 Generating app icons...');

  try {
    // Get image metadata
    const metadata = await sharp(SOURCE_ICON).metadata();
    console.log(`📐 Source image: ${metadata.width}x${metadata.height}`);

    // Calculate square crop (center crop)
    const size = Math.min(metadata.width, metadata.height);
    const left = Math.floor((metadata.width - size) / 2);
    const top = Math.floor((metadata.height - size) / 2);

    console.log(`✂️  Cropping to ${size}x${size} (center crop)`);

    // Process and save as PNG (1024x1024 for high resolution)
    await sharp(SOURCE_ICON)
      .extract({ left, top, width: size, height: size })
      .resize(1024, 1024, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(OUTPUT_PNG);

    console.log(`✅ Created ${OUTPUT_PNG}`);

    console.log('\n📝 Next steps:');
    console.log('1. For macOS: Run `npx electron-icon-builder --input=./assets/icon.png --output=./assets --flatten`');
    console.log('2. For Windows/Linux: The PNG file will be used automatically');
    console.log('3. Update package.json to use the new icons');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
