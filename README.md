# TLP Profile Switcher

A simple GNOME Shell extension that allows you to easily switch between TLP power management profiles directly from the top panel.

## Features

- 🔋 Quick switching between TLP profiles with a single click
- 📁 Automatically detects profiles from `~/.tlp/` directory
- ✅ Shows current active profile with a checkmark
- 🎯 Minimal and clean interface
- 📂 Quick access to profiles folder

## Prerequisites

- TLP (The Linux Laptop) must be installed and configured
- GNOME Shell 42", "43", "44", "45", "46", "47, 48
- `pkexec` (usually comes with PolicyKit)

## Installation

### From GNOME Extensions Website
1. Visit [extensions.gnome.org](https://extensions.gnome.org)
2. Search for "TLP Profile Switcher"
3. Click "Install"

### Manual Installation
1. Download the extension files
2. Extract to `~/.local/share/gnome-shell/extensions/tlp-switcher@mahaon.dev/`
3. Restart GNOME Shell (Alt+F2, type `r`, press Enter)
4. Enable the extension using GNOME Extensions app

## Usage

### Setting Up Profiles
1. Create profile files in `~/.tlp/` directory
2. Name them with `.conf` extension (e.g., `performance.conf`, `battery.conf`)
3. Copy your TLP configuration settings to these files

Example profile structure:
```
~/.tlp/
├── performance.conf
├── battery.conf
└── balanced.conf
```

### Switching Profiles
1. Click the speedometer icon in the top panel
2. Select desired profile from the dropdown menu
3. Enter your password when prompted (for sudo access)
4. The active profile will be marked with a checkmark

### Creating Profile Files
You can create profiles by:
1. Copying `/etc/tlp.conf` as a base: `cp /etc/tlp.conf ~/.tlp/myprofile.conf`
2. Editing the copied file with your preferred settings
3. Or clicking "Open Profiles Folder" from the extension menu

## Troubleshooting

### Extension doesn't appear in panel
- Make sure TLP is installed: `sudo apt install tlp` (Ubuntu/Debian)
- Restart GNOME Shell: Alt+F2, type `r`, press Enter
- Check if extension is enabled in GNOME Extensions app

### "No profiles found" message
- Create the profiles directory: `mkdir -p ~/.tlp`
- Add at least one `.conf` file to the directory
- Or click "Open Profiles Folder" to access the directory

### Profile switching fails
- Make sure you have sudo privileges
- Ensure TLP service is running: `sudo systemctl status tlp`
- Check that profile files have correct TLP syntax

## License

This extension is released under the GPL-2.0+ license.

## Contributing

Feel free to report issues or submit pull requests on the project repository.

## Changelog

### Version 1
- Initial release
- Basic profile switching functionality
- Profile detection and menu generation
- Integration with GNOME Shell panel