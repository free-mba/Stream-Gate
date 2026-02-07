# Stream Gate Troubleshooting Guide

## macOS: "App is damaged and can't be opened"

If you see this error message, it's because Stream Gate is not currently signed with an Apple Developer ID. macOS automatically flags unsigned apps downloaded from the internet as "damaged."

### The Fix

To resolve this, you need to remove the "quarantine" attribute using the Terminal:

1.  Open the **Terminal** app (found in Applications > Utilities).
2.  Copy and paste the following command, then press Entry:
    ```bash
    cat << 'EOF' > fix-stream-gate.sh
    #!/bin/bash
    sudo xattr -rd com.apple.quarantine /Applications/Stream\ Gate.app
    sudo xattr -cr /Applications/Stream\ Gate.app
    EOF
    chmod +x fix-stream-gate.sh
    ./fix-stream-gate.sh
    ```
    *Note: You will be asked for your Mac password. Typing will not show characters, just press Enter when done.*

### Alternative Method (Right-Click)

1.  Open your **Applications** folder in Finder.
2.  Find **Stream Gate**.
3.  **Right-click** (or Control-click) the app icon and select **Open**.
4.  In the dialog box that appears, click **Open** again.

---

## Windows: SmartScreen "Windows protected your PC"

Windows might block the installer because it's from an unknown publisher.

1.  Click **More info**.
2.  Click **Run anyway**.

## Linux: AppImage permission denied

If the AppImage won't start:
1.  Right-click the `.AppImage` file.
2.  Go to **Properties** > **Permissions**.
3.  Check **Allow executing file as program**.
4.  Or run in terminal: `chmod +x Stream-Gate-Linux-x64.AppImage && ./Stream-Gate-Linux-x64.AppImage`
