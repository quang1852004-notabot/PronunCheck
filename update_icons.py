import os
from PIL import Image

def generate_pwa_icons():
    source_icon = "app_icon.png"
    target_dir = "frontend-pronuncheck/public"
    
    if not os.path.exists(source_icon):
        print(f"Error: Could not find '{source_icon}'.")
        print("Please place your logo here and rename it to 'app_icon.png'")
        return

    if not os.path.exists(target_dir):
        print(f"Error: Target directory '{target_dir}' does not exist.")
        return

    try:
        img = Image.open(source_icon)
        img = img.convert("RGBA")

        sizes = [192, 512]

        for size in sizes:
            resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
            target_path = os.path.join(target_dir, f"icon-{size}x{size}.png")
            resized_img.save(target_path, "PNG")
            print(f"Successfully generated: {target_path}")
            
        print("\nIcons updated successfully! Next time you start the server, new icons will be used.")
    except Exception as e:
        print(f"An error occurred while processing the image: {e}")

if __name__ == "__main__":
    generate_pwa_icons()
