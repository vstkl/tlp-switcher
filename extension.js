import St from 'gi://St';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Quick Settings Toggle with Menu
const TLPProfileToggle = GObject.registerClass(
    class TLPProfileToggle extends QuickSettings.QuickMenuToggle {
        _init(metadata) {
            super._init({
                title: 'TLP Profile',
                subtitle: 'Power Management',
                iconName: 'preferences-system-symbolic',
                toggleMode: false, // Не нужен переключатель, только меню
            });
            
            this.metadata = metadata;
            
            // Path to profiles folder
            this.profilesPath = GLib.get_home_dir() + '/.tlp';
            
            // Set up custom icon
            this._setupCustomIcon();
            
            // Create profiles directory if it doesn't exist
            this._ensureProfilesDirectory();
            
            // Set up menu header
            this.menu.setHeader('preferences-system-symbolic', 'TLP Profile', 'Power Management');
            
            // Build menu
            this._buildMenu();
            
            // Monitor changes in profiles folder
            this._setupDirectoryMonitor();
        }
        
        _setupCustomIcon() {
            try {
                const iconPath = this.metadata.path + '/icons/speedometer5-symbolic.svg';
                const iconFile = Gio.File.new_for_path(iconPath);
                
                if (iconFile.query_exists(null)) {
                    this.gicon = Gio.FileIcon.new(iconFile);
                    this.menu.setHeader(this.gicon, 'TLP Profile', 'Power Management');
                }
            } catch (e) {
                // Keep default icon on error
                logError(e, 'Failed to load custom icon, using fallback');
            }
        }
        
        _ensureProfilesDirectory() {
            const profilesDir = Gio.File.new_for_path(this.profilesPath);
            if (!profilesDir.query_exists(null)) {
                try {
                    profilesDir.make_directory_with_parents(null);
                } catch (e) {
                    logError(e, 'Failed to create profiles directory');
                }
            }
        }
        
        _setupDirectoryMonitor() {
            try {
                const profilesDir = Gio.File.new_for_path(this.profilesPath);
                if (profilesDir.query_exists(null)) {
                    this.monitor = profilesDir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
                    this.monitor.connect('changed', () => {
                        // Debounce menu rebuilding
                        if (this.rebuildTimeout) {
                            GLib.source_remove(this.rebuildTimeout);
                        }
                        this.rebuildTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                            this._buildMenu();
                            this.rebuildTimeout = null;
                            return GLib.SOURCE_REMOVE;
                        });
                    });
                }
            } catch (e) {
                logError(e, 'Failed to setup directory monitor');
            }
        }
        
        _buildMenu() {
            // Clear existing menu items (except header)
            this.menu.removeAll();
            
            // Get profiles list
            const profiles = this._getProfiles();
            
            // Get current profile asynchronously
            this._getCurrentActiveProfile().then(currentProfile => {
                // Clear menu again in case it was rebuilt while we were waiting
                this.menu.removeAll();
                
                // Update subtitle with current profile
                if (currentProfile) {
                    this.subtitle = `Active: ${currentProfile}`;
                } else {
                    this.subtitle = 'Power Management';
                }
                
                if (profiles.length === 0) {
                    const noProfilesItem = new PopupMenu.PopupMenuItem('No profiles found', {
                        reactive: false,
                        can_focus: false
                    });
                    noProfilesItem.label.style_class = 'popup-inactive-text';
                    this.menu.addMenuItem(noProfilesItem);
                    
                    // Add instruction item
                    const instructionItem = new PopupMenu.PopupMenuItem('Create .conf files in ~/.tlp/', {
                        reactive: false,
                        can_focus: false
                    });
                    instructionItem.label.style_class = 'popup-inactive-text';
                    this.menu.addMenuItem(instructionItem);
                } else {
                    // Add profiles section
                    this._profilesSection = new PopupMenu.PopupMenuSection();
                    
                    profiles.forEach(profile => {
                        const item = new PopupMenu.PopupMenuItem(profile.name);
                        
                        // Create radio button using icon
                        const radioIcon = new St.Icon({
                            icon_name: currentProfile === profile.name ? 'radio-checked-symbolic' : 'radio-symbolic',
                            style_class: 'popup-menu-icon',
                            icon_size: 14
                        });
                        
                        // Add radio button to the beginning of the item
                        item.insert_child_at_index(radioIcon, 0);
                        
                        item.connect('activate', () => {
                            this._switchProfile(profile.path);
                        });
                        
                        this._profilesSection.addMenuItem(item);
                    });
                    
                    this.menu.addMenuItem(this._profilesSection);
                }
                
                // Add separator
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                
                // Button to open profiles folder
                const openFolderItem = this.menu.addAction('Open Profiles Folder', () => {
                    this._openProfilesFolder();
                });
                
                // Add settings button (if you have preferences)
                // const settingsItem = this.menu.addAction('Settings', () => {
                //     this.extensionObject.openPreferences();
                // });
                
            }).catch(e => {
                logError(e, 'Failed to get current active profile');
                // Build menu without current profile indication
                this._buildMenuWithoutCurrentProfile(profiles);
            });
        }
        
        _buildMenuWithoutCurrentProfile(profiles) {
            this.menu.removeAll();
            
            if (profiles.length === 0) {
                const noProfilesItem = new PopupMenu.PopupMenuItem('No profiles found', {
                    reactive: false,
                    can_focus: false
                });
                noProfilesItem.label.style_class = 'popup-inactive-text';
                this.menu.addMenuItem(noProfilesItem);
                
                // Add instruction item
                const instructionItem = new PopupMenu.PopupMenuItem('Create .conf files in ~/.tlp/', {
                    reactive: false,
                    can_focus: false
                });
                instructionItem.label.style_class = 'popup-inactive-text';
                this.menu.addMenuItem(instructionItem);
            } else {
                // Add profiles section
                this._profilesSection = new PopupMenu.PopupMenuSection();
                
                profiles.forEach(profile => {
                    const item = new PopupMenu.PopupMenuItem(profile.name);
                    item.connect('activate', () => {
                        this._switchProfile(profile.path);
                    });
                    this._profilesSection.addMenuItem(item);
                });
                
                this.menu.addMenuItem(this._profilesSection);
            }
            
            // Add separator
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            // Button to open profiles folder
            const openFolderItem = this.menu.addAction('Open Profiles Folder', () => {
                this._openProfilesFolder();
            });
        }
        
        async _getCurrentActiveProfile() {
            try {
                const tlpConfFile = Gio.File.new_for_path('/etc/tlp.conf');
                if (!tlpConfFile.query_exists(null)) {
                    return null;
                }
                
                const tlpContent = await this._loadFileContentsAsync(tlpConfFile);
                if (!tlpContent) {
                    return null;
                }
                
                const profiles = this._getProfiles();
                
                for (const profile of profiles) {
                    try {
                        const profileFile = Gio.File.new_for_path(profile.path);
                        const profileContent = await this._loadFileContentsAsync(profileFile);
                        if (!profileContent) {
                            continue;
                        }
                        
                        if (this._compareProfiles(tlpContent, profileContent)) {
                            return profile.name;
                        }
                    } catch (e) {
                        // Ignore errors reading individual files
                        continue;
                    }
                }
                
                return null;
            } catch (e) {
                throw new Error('Failed to get current active profile: ' + e.message);
            }
        }
        
        _loadFileContentsAsync(file) {
            return new Promise((resolve, reject) => {
                file.load_contents_async(null, (file, result) => {
                    try {
                        const [success, contents] = file.load_contents_finish(result);
                        if (success) {
                            const content = new TextDecoder().decode(contents);
                            resolve(content);
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        }
        
        _getProfiles() {
            const profiles = [];
            try {
                const profilesDir = Gio.File.new_for_path(this.profilesPath);
                if (!profilesDir.query_exists(null)) {
                    return profiles;
                }
                
                const enumerator = profilesDir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );
                
                let fileInfo;
                while ((fileInfo = enumerator.next_file(null)) !== null) {
                    const name = fileInfo.get_name();
                    const type = fileInfo.get_file_type();
                    
                    if (type === Gio.FileType.REGULAR && name.endsWith('.conf')) {
                        profiles.push({
                            name: name.replace('.conf', ''),
                            path: GLib.build_filenamev([this.profilesPath, name])
                        });
                    }
                }
                
                enumerator.close(null);
                
                // Sort by name
                profiles.sort((a, b) => a.name.localeCompare(b.name));
            } catch (e) {
                logError(e, 'Failed to get profiles list');
            }
            
            return profiles;
        }
        
        _switchProfile(profilePath) {
            try {
                const command = [
                    'pkexec',
                    'sh', '-c',
                    `cp "${profilePath}" /etc/tlp.conf && systemctl restart tlp`
                ];
                
                const proc = Gio.Subprocess.new(
                    command,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                
                proc.wait_async(null, (proc, result) => {
                    try {
                        const success = proc.wait_finish(result);
                        if (success && proc.get_successful()) {
                            // Update menu after a short delay
                            if (this.updateMenuTimeout) {
                                GLib.source_remove(this.updateMenuTimeout);
                            }
                            this.updateMenuTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                                this._buildMenu();
                                this.updateMenuTimeout = null;
                                return GLib.SOURCE_REMOVE;
                            });
                        }
                    } catch (e) {
                        logError(e, 'Failed to switch profile');
                    }
                });
            } catch (e) {
                logError(e, 'Failed to execute profile switch command');
            }
        }
        
        _openProfilesFolder() {
            try {
                const command = ['xdg-open', this.profilesPath];
                Gio.Subprocess.new(
                    command,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
            } catch (e) {
                logError(e, 'Failed to open profiles folder');
            }
        }
        
        _compareProfiles(content1, content2) {
            const normalize = (content) => {
                return content
                    .split('\n')
                    .filter(line => {
                        const trimmed = line.trim();
                        return trimmed && !trimmed.startsWith('#') && trimmed.includes('=');
                    })
                    .map(line => line.trim())
                    .sort()
                    .join('\n');
            };
            
            return normalize(content1) === normalize(content2);
        }
        
        destroy() {
            // Clean up monitor
            if (this.monitor) {
                this.monitor.cancel();
                this.monitor = null;
            }
            
            // Clean up all timeouts
            if (this.rebuildTimeout) {
                GLib.source_remove(this.rebuildTimeout);
                this.rebuildTimeout = null;
            }
            
            if (this.updateMenuTimeout) {
                GLib.source_remove(this.updateMenuTimeout);
                this.updateMenuTimeout = null;
            }
            
            super.destroy();
        }
    }
);

// System Indicator for Quick Settings
const TLPSystemIndicator = GObject.registerClass(
    class TLPSystemIndicator extends QuickSettings.SystemIndicator {
        _init(metadata) {
            super._init();
            
            // Create toggle for quick settings
            this._toggle = new TLPProfileToggle(metadata);
            this.quickSettingsItems.push(this._toggle);
            
            // Optionally add a panel indicator (small icon in top bar)
            // this._indicator = this._addIndicator();
            // this._indicator.icon_name = 'preferences-system-symbolic';
            // this._indicator.visible = true;
        }
        
        destroy() {
            this._toggle.destroy();
            super.destroy();
        }
    }
);

// Main extension class
export default class TLPProfileSwitcherExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this.indicator = null;
    }
    
    enable() {
        this.indicator = new TLPSystemIndicator(this.metadata);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this.indicator, 2);
    }
    
    disable() {
        if (this.indicator) {
            this.indicator.destroy();
            this.indicator = null;
        }
    }
}