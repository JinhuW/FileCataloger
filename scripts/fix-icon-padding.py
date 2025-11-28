#!/usr/bin/env python3
"""
Fix icon padding to make it fill the entire rounded square like other macOS icons.
macOS icons should have minimal padding - about 5-8% margin from the edges.
"""

from PIL import Image
import sys

def fix_icon_padding(input_path, output_path):
    """Remove excess transparent padding and add appropriate margins for macOS icons."""

    # Open the image
    img = Image.open(input_path)

    # Get the bounding box of non-transparent pixels
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Get bounding box (crops to content)
    bbox = img.getbbox()

    if bbox:
        # Crop to content
        cropped = img.crop(bbox)

        # Calculate size with 5% padding on each side (10% total)
        # This matches how macOS icons typically look
        target_size = 1024
        content_size = int(target_size * 0.90)  # 90% of target, leaving 5% margin on each side

        # Resize the cropped content
        cropped_resized = cropped.resize((content_size, content_size), Image.Resampling.LANCZOS)

        # Create new image with full size
        final_img = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))

        # Calculate position to center the content (5% margin on each side)
        margin = (target_size - content_size) // 2
        final_img.paste(cropped_resized, (margin, margin), cropped_resized)

        # Save
        final_img.save(output_path, 'PNG')
        print(f"Icon fixed: {output_path}")
        print(f"Original bounding box: {bbox}")
        print(f"New size: {target_size}x{target_size} with {margin}px margins")
        return True
    else:
        print("Error: Could not find image content")
        return False

if __name__ == '__main__':
    input_file = 'assets/icon.png'
    output_file = 'assets/icon.png'

    try:
        if fix_icon_padding(input_file, output_file):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
