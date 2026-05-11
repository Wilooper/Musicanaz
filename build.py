import os

# Path to the library file causing the build error
file_path = "lib/yt-client.ts"

def fix_missing_exports():
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found. Please run this script from your project root.")
        return

    with open(file_path, "r") as f:
        content = f.read()

    # Define the missing functions to be appended
    # We use 'export' so the component can find them
    missing_functions = """
// Added by fix_build.py to resolve Vercel build errors
export const saveCookies = async (cookies: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('yt-cookies', cookies);
    return { success: true };
  }
};

export const removeCookies = async () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('yt-cookies');
    return { success: true };
  }
};

export const cookiesAreSet = () => {
  if (typeof window !== 'undefined') {
    return !!localStorage.getItem('yt-cookies');
  }
  return false;
};
"""

    # Check if they are already there to avoid duplicates
    if "export const saveCookies" in content:
        print("Functions already appear to exist in yt-client.ts. Checking for typos...")
    else:
        print(f"Appending missing exports to {file_path}...")
        with open(file_path, "a") as f:
            f.write(missing_functions)
        print("Successfully updated lib/yt-client.ts")

if __name__ == "__main__":
    fix_missing_exports()
