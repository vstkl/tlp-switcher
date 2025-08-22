
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TLPProfileSwitcherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create main page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });

        // Appearance settings group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance Settings',
            description: 'Configure how TLP Profile Switcher appears in Quick Settings',
        });

        // Widget width setting
        appearanceGroup.add(this._createWidthRow(settings));

        // Config folder selector
        appearanceGroup.add(this._createFolderSelectorRow(settings));

        page.add(appearanceGroup);
        window.add(page);
    }

    _createWidthRow(settings) {
        const widthRow = new Adw.ActionRow({
            title: 'Widget Width',
            subtitle: 'Choose how wide the widget should be in Quick Settings',
        });

        const widthDropdown = new Gtk.DropDown({
            model: Gtk.StringList.new(['1 column (standard)', '2 columns (wide)']),
            valign: Gtk.Align.CENTER,
        });

        // Set current value (convert 1,2 to 0,1 for dropdown)
        const currentWidth = settings.get_int('widget-width');
        widthDropdown.selected = Math.max(0, currentWidth - 1);

        // Connect to settings
        widthDropdown.connect('notify::selected', () => {
            const selectedWidth = widthDropdown.selected + 1; // Convert 0,1 to 1,2
            settings.set_int('widget-width', selectedWidth);
        });

        widthRow.add_suffix(widthDropdown);
        widthRow.activatable_widget = widthDropdown;

        return widthRow;
    }

    _createFolderSelectorRow(settings) {
        const folderRow = new Adw.ActionRow({
            title: 'Config Folder',
            subtitle: settings.get_string('config-file') || 'Select a configuration folder for TLP',
        });

        const button = new Gtk.Button({
            label: 'Choose Folder…',
            valign: Gtk.Align.CENTER,
        });

        const fileDialog = new Gtk.FileDialog({
            title: 'Select Config Folder',
            modal: true,
        });

        // Restore previously selected folder as initial folder
        const currentFolder = settings.get_string('config-file');
        if (currentFolder) {
            try {
                const initFolder = Gio.File.new_for_path(currentFolder);
                fileDialog.set_initial_folder(initFolder);
            } catch (e) {
                logError?.(e, 'Failed to set initial folder');
            }
        }

        button.connect('clicked', () => {
            fileDialog.select_folder(button.get_root(), null, (dialog, res) => {
                try {
                    const folder = dialog.select_folder_finish(res);
                    if (folder) {
                        const path = folder.get_path();
                        if (path) {
                            settings.set_string('config-file', path);
                            folderRow.subtitle = path; // show chosen folder in UI
                        }
                    }
                } catch (e) {
                    // User canceled or an error occurred; ignore
                }
            });
        });

        folderRow.add_suffix(button);
        folderRow.activatable_widget = button;

        return folderRow;
    }
}

