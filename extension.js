import St from 'gi://St';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// Quick Settings Toggle with Menu
const TLPProfileToggle = GObject.registerClass(
    class TLPProfileToggle extends QuickSettings.QuickMenuToggle {
        _init(metadata, settings) {
            super._init({
                title: 'TLP Profile',
                subtitle: 'Power Management',
                iconName: 'preferences-system-symbolic',
                toggleMode: false,
            });

            this.metadata = metadata;
            this.settings = settings;

            // Read user-configured profiles directory (fallback to ~/.tlp)
            let configuredPath = this.settings.get_string('config-file');
            if (!configuredPath) {
                configuredPath = GLib.build_filenamev([GLib.get_home_dir(), '.tlp']);
            }
            this.profilesPath = configuredPath;

            // Initialize components
            this._setupCustomIcon();
            this._ensureProfilesDirectory();
            this._setupMenuHeader();
            this._setupDirectoryMonitor();

            // Build initial menu
            this._buildMenu();
        }

        _setupCustomIcon() {
            try {
                const iconPath = GLib.build_filenamev([this.metadata.path, 'icons', 'speedometer5-symbolic.svg']);
                const iconFile = Gio.File.new_for_path(iconPath);

                if (iconFile.query_exists(null)) {
                    this.gicon = Gio.FileIcon.new(iconFile);
                    this.iconName = null; // Clear default icon
                }
            } catch (e) {
                logError(e, 'Failed to load custom icon, using fallback');
            }
        }

        _setupMenuHeader() {
            const headerIcon = this.gicon || 'preferences-system-symbolic';
            this.menu.setHeader(headerIcon, 'TLP Profile', 'Power Management');
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
                if (!profilesDir.query_exists(null)) return;

                this.monitor = profilesDir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
                this.monitor.connect('changed', this._onDirectoryChanged.bind(this));
            } catch (e) {
                logError(e, 'Failed to setup directory monitor');
            }
        }

        _onDirectoryChanged() {
            if (this._rebuildTimeout)
                GLib.source_remove(this._rebuildTimeout);

            this._rebuildTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                this._buildMenu();
                this._rebuildTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        }

        async _buildMenu() {
            this.menu.removeAll();

            const profiles = this._getProfiles();
            let currentProfile = null;

            try {
                currentProfile = await this._getCurrentActiveProfile();
            } catch (e) {
                logError(e, 'Failed to get current active profile');
            }

            this.subtitle = currentProfile ? `Active: ${currentProfile}` : 'Power Management';
            this._buildMenuContent(profiles, currentProfile);
        }

        _buildMenuContent(profiles, currentProfile) {
            if (profiles.length === 0) {
                this._addNoProfilesMessage();
                return;
            }

            const profilesSection = new PopupMenu.PopupMenuSection();

            profiles.forEach(profile => {
                const item = new PopupMenu.PopupMenuItem(profile.name);

                const radioIcon = new St.Icon({
                    icon_name: currentProfile === profile.name ? 'radio-checked-symbolic' : 'radio-symbolic',
                    style_class: 'popup-menu-icon',
                    icon_size: 14,
                });

                item.insert_child_at_index(radioIcon, 0);
                item.connect('activate', () => this._switchProfile(profile.path));

                profilesSection.addMenuItem(item);
            });

            this.menu.addMenuItem(profilesSection);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction('Open Profiles Folder', () => this._openProfilesFolder());
        }

        _addNoProfilesMessage() {
            const noProfilesItem = new PopupMenu.PopupMenuItem('No profiles found', {
                reactive: false,
                can_focus: false,
            });
            noProfilesItem.label.style_class = 'popup-inactive-text';
            this.menu.addMenuItem(noProfilesItem);

            const instructionItem = new PopupMenu.PopupMenuItem('Create .conf files in the selected folder', {
                reactive: false,
                can_focus: false,
            });
            instructionItem.label.style_class = 'popup-inactive-text';
            this.menu.addMenuItem(instructionItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction('Open Profiles Folder', () => this._openProfilesFolder());
        }

        async _getCurrentActiveProfile() {
            const tlpConfFile = Gio.File.new_for_path('/etc/tlp.conf');
            if (!tlpConfFile.query_exists(null))
                return null;

            const tlpContent = await this._loadFileContentsAsync(tlpConfFile);
            if (!tlpContent) return null;

            const profiles = this._getProfiles();

            for (const profile of profiles) {
                try {
                    const profileFile = Gio.File.new_for_path(profile.path);
                    const profileContent = await this._loadFileContentsAsync(profileFile);

                    if (profileContent && this._compareProfiles(tlpContent, profileContent)) {
                        return profile.name;
                    }
                } catch {
                    continue;
                }
            }

            return null;
        }

        _loadFileContentsAsync(file) {
            return new Promise((resolve, reject) => {
                file.load_contents_async(null, (src, res) => {
                    try {
                        const [ok, contents] = src.load_contents_finish(res);
                        resolve(ok ? new TextDecoder().decode(contents) : null);
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
                if (!profilesDir.query_exists(null))
                    return profiles;

                const enumerator = profilesDir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let fileInfo;
                while ((fileInfo = enumerator.next_file(null)) !== null) {
                    const name = fileInfo.get_name();
                    if (fileInfo.get_file_type() === Gio.FileType.REGULAR && name.endsWith('.conf')) {
                        profiles.push({
                            name: name.replace(/\.conf$/, ''),
                            path: profilesDir.get_child(name).get_path(),
                        });
                    }
                }
                enumerator.close(null);

                profiles.sort((a, b) => a.name.localeCompare(b.name));
            } catch (e) {
                logError(e, 'Failed to get profiles list');
            }
            return profiles;
        }

        _switchProfile(profilePath) {
            const cmd = ['pkexec', 'sh', '-c', `cp "${profilePath}" /etc/tlp.conf && tlp start`];

            try {
                const proc = Gio.Subprocess.new(cmd,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

                proc.wait_async(null, (src, res) => {
                    try {
                        if (src.wait_finish(res) && src.get_successful())
                            this._scheduleMenuUpdate();
                        else
                            logError(new Error('Profile switch failed'), `Failed: ${profilePath}`);
                    } catch (e) {
                        logError(e, 'Failed to switch profile');
                    }
                });
            } catch (e) {
                logError(e, 'Failed to run profile switch command');
            }
        }

        _scheduleMenuUpdate() {
            if (this._updateMenuTimeout)
                GLib.source_remove(this._updateMenuTimeout);

            this._updateMenuTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this._buildMenu();
                this._updateMenuTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        }

        _openProfilesFolder() {
            try {
                Gio.Subprocess.new(
                    ['xdg-open', this.profilesPath],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
            } catch (e) {
                logError(e, 'Failed to open profiles folder');
            }
        }

        _compareProfiles(content1, content2) {
            const normalize = c => c.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#') && l.includes('='))
                .sort()
                .join('\n');
            return normalize(content1) === normalize(content2);
        }

        destroy() {
            this.monitor?.cancel();
            this.monitor = null;

            [this._rebuildTimeout, this._updateMenuTimeout].forEach(t => {
                if (t) GLib.source_remove(t);
            });

            this._rebuildTimeout = this._updateMenuTimeout = null;
            super.destroy();
        }
    }
);

const TLPSystemIndicator = GObject.registerClass(
    class TLPSystemIndicator extends QuickSettings.SystemIndicator {
        _init(metadata, settings) {
            super._init();
            this._toggle = new TLPProfileToggle(metadata, settings);
            this.quickSettingsItems.push(this._toggle);
        }

        destroy() {
            this._toggle?.destroy();
            super.destroy();
        }
    }
);

export default class TLPProfileSwitcherExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._settings = null;
        this._widthChangedId = null;
    }

    enable() {
        this._settings = this.getSettings();
        this._indicator = new TLPSystemIndicator(this.metadata, this._settings);

        const widgetWidth = this._settings.get_int('widget-width');
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator, widgetWidth);

        this._widthChangedId = this._settings.connect('changed::widget-width', () => {
            this._recreateIndicator();
        });
    }

    _recreateIndicator() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = new TLPSystemIndicator(this.metadata, this._settings);
            const newWidth = this._settings.get_int('widget-width');
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator, newWidth);
        }
    }

    disable() {
        if (this._widthChangedId) {
            this._settings.disconnect(this._widthChangedId);
            this._widthChangedId = null;
        }
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}

