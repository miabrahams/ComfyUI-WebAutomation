#!/usr/bin/env python3
"""
Batch processor for ComfyUI image generation.
Scans a directory for image/text pairs and processes them through the ComfyUI API.
"""

import os
import sys
import argparse
import time
import json
import requests
from pathlib import Path
from PIL import Image


def find_image_text_pairs(directory):
    """
    Scan directory for image files and their corresponding text files.
    Returns list of (image_path, text_path) tuples for valid pairs.
    """
    directory = Path(directory)
    if not directory.exists():
        raise ValueError(f"Directory does not exist: {directory}")

    # Find all image files
    image_extensions = {'.png', '.jpg', '.jpeg'}
    image_files = []
    for ext in image_extensions:
        image_files.extend(directory.glob(f"*{ext}"))
        image_files.extend(directory.glob(f"*{ext.upper()}"))

    # Find corresponding text files
    pairs = []
    missing_text = []

    for image_path in image_files:
        # Look for corresponding .txt file
        text_path = image_path.with_suffix('.txt')
        if text_path.exists():
            pairs.append((image_path, text_path))
        else:
            missing_text.append(image_path)

    return pairs, missing_text


def get_image_resolution(image_path):
    """Get image resolution using PIL."""
    try:
        with Image.open(image_path) as img:
            return img.size  # Returns (width, height)
    except Exception as e:
        print(f"Error reading image {image_path}: {e}")
        return None


def read_prompt_file(text_path):
    """Read prompt from text file."""
    try:
        with open(text_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        print(f"Error reading text file {text_path}: {e}")
        return None


def send_prompt_replace(base_url, prompt, resolution):
    """Send promptReplace event to ComfyUI."""
    url = f"{base_url}/rebase/forward"
    payload = {
        "event": "promptReplace",
        "data": {
            "positive_prompt": prompt,
            "resolution": {
                "width": resolution[0],
                "height": resolution[1]
            }
        }
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error sending promptReplace: {e}")
        return False


def send_generate_images(base_url, count):
    """Send generateImages event to ComfyUI."""
    url = f"{base_url}/rebase/forward"
    payload = {
        "event": "generateImages",
        "data": {
            "count": count
        }
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error sending generateImages: {e}")
        return False


def process_batch(directory, base_url, gens_per_image, randomize, delay_between_batches):
    """Process all image/text pairs in the directory."""

    # Find pairs
    print(f"Scanning directory: {directory}")
    pairs, missing_text = find_image_text_pairs(directory)

    if randomize:
        import random
        random.shuffle(pairs)

    # Report findings
    print(f"\nFound {len(pairs)} valid image/text pairs")
    if missing_text:
        print(f"Found {len(missing_text)} images without corresponding text files:")
        for img in missing_text[:5]:  # Show first 5
            print(f"  - {img.name}")
        if len(missing_text) > 5:
            print(f"  ... and {len(missing_text) - 5} more")

    if not pairs:
        print("No valid pairs found. Exiting.")
        return

    # Show what will be processed
    print(f"\nPairs to process:")
    for i, (img_path, txt_path) in enumerate(pairs[:5]):  # Show first 5
        print(f"  {i+1}. {img_path.name} + {txt_path.name}")
    if len(pairs) > 5:
        print(f"  ... and {len(pairs) - 5} more")

    print(f"\nGenerations per image: {gens_per_image}")
    print(f"Total generations: {len(pairs) * gens_per_image}")

    # Confirm with user
    try:
        confirm = input(f"\nProcess {len(pairs)} pairs? (y/N): ").strip().lower()
        if confirm not in ['y', 'yes']:
            print("Cancelled.")
            return
    except KeyboardInterrupt:
        print("\nCancelled.")
        return

    # Process each pair
    print(f"\nStarting batch processing...")
    successful = 0
    failed = 0

    for i, (image_path, text_path) in enumerate(pairs, 1):
        print(f"\n[{i}/{len(pairs)}] Processing {image_path.name}")

        # Get image resolution
        resolution = get_image_resolution(image_path)
        if not resolution:
            print(f"  ❌ Failed to read image resolution")
            failed += 1
            continue

        # Read prompt
        prompt = read_prompt_file(text_path)
        if not prompt:
            print(f"  ❌ Failed to read prompt")
            failed += 1
            continue

        print(f"  📏 Resolution: {resolution[0]}x{resolution[1]}")
        print(f"  📝 Prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}")

        # Send promptReplace
        print(f"  🔄 Sending prompt and resolution...")
        if not send_prompt_replace(base_url, prompt, resolution):
            print(f"  ❌ Failed to send promptReplace")
            failed += 1
            continue

        # Small delay
        time.sleep(0.5)

        # Send generateImages
        print(f"  🎨 Requesting {gens_per_image} generation(s)...")
        if not send_generate_images(base_url, gens_per_image):
            print(f"  ❌ Failed to send generateImages")
            failed += 1
            continue

        print(f"  ✅ Batch submitted successfully")
        successful += 1

        # Delay between batches (except for the last one)
        if i < len(pairs):
            print(f"  ⏸️  Waiting {delay_between_batches}s before next batch...")
            time.sleep(delay_between_batches)

    # Final report
    print(f"\n{'='*50}")
    print(f"Batch processing complete!")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Total pairs processed: {successful + failed}")


def main():
    parser = argparse.ArgumentParser(description="Batch process image/text pairs for ComfyUI generation")
    parser.add_argument("directory", help="Directory containing image and text files")
    parser.add_argument("--url", default="http://localhost:8191", help="ComfyUI server URL (default: http://localhost:8191)")
    parser.add_argument("--gens", type=int, help="Number of generations per image (will prompt if not specified)")
    parser.add_argument("--delay", type=float, default=3.0, help="Delay between batches in seconds (default: 3.0)")
    parser.add_argument("--randomize", action="store_true", help="Randomize the order of image/text pairs before processing")

    args = parser.parse_args()

    # Validate directory
    if not os.path.isdir(args.directory):
        print(f"Error: '{args.directory}' is not a valid directory")
        sys.exit(1)

    # Get generations per image
    gens_per_image = args.gens
    if gens_per_image is None:
        try:
            gens_per_image = int(input("How many generations per image? (1-8): "))
            if gens_per_image < 1 or gens_per_image > 8:
                print("Error: Generations per image must be between 1 and 8")
                sys.exit(1)
        except (ValueError, KeyboardInterrupt):
            print("\nInvalid input or cancelled.")
            sys.exit(1)

    # Validate gens_per_image
    if gens_per_image < 1 or gens_per_image > 8:
        print("Error: Generations per image must be between 1 and 8")
        sys.exit(1)

    try:
        process_batch(args.directory, args.url, gens_per_image, args.randomize, args.delay)
    except KeyboardInterrupt:
        print("\n\nProcessing interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nError during processing: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()