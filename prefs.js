import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from "gi://GLib";

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const {
    build_filenamev,
    get_user_special_dir,
    UserDirectory,
    get_language_names,
} = GLib;

export default class TLPProfileSwitcherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create main page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic'
        });

        // Appearance settings group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance Settings',
            description: 'Configure how TLP Profile Switcher appears in Quick Settings'
        });

        // Widget width setting
        appearanceGroup.add(this._createWidthRow(settings));

        // File selector setting
        appearanceGroup.add(this._createFileSelectorRow(settings));

        page.add(appearanceGroup);
        window.add(page);
    }

    _createWidthRow(settings) {
        const widthRow = new Adw.ActionRow({
            title: 'Widget Width',
            subtitle: 'Choose how wide the widget should be in Quick Settings'
        });

        const widthDropdown = new Gtk.DropDown({
            model: Gtk.StringList.new(['1 column (standard)', '2 columns (wide)']),
            valign: Gtk.Align.CENTER
        });

        // Set current value (convert 1,2 to 0,1 for dropdown)
        const currentWidth = settings.get_int('widget-width');
        widthDropdown.selected = currentWidth - 1;

        // Connect to settings
        widthDropdown.connect('notify::selected', () => {
            const selectedWidth = widthDropdown.selected + 1; // Convert 0,1 to 1,2
            settings.set_int('widget-width', selectedWidth);
        });

        widthRow.add_suffix(widthDropdown);
        return widthRow;
    }


    _createFileSelectorRow(settings) {
        const fileRow = new Adw.ActionRow({
            title: 'Config File',
            subtitle: 'Select a configuration file for TLP'
        });

        const button = new Gtk.Button({
            label: 'Choose File…',
            valign: Gtk.Align.CENTER,
        });

        const fileDialog = new Gtk.FileDialog({
            title: 'Select Config File',
            modal: true,
        });

        // Restore previously selected file
        const currentFile = settings.get_string('config-file');
        if (currentFile) {
            try {
                const initFolder = Gio.File.new_for_path(currentFile).get_parent();
                if (initFolder)
                    fileDialog.set_initial_folder(initFolder);
            } catch (e) {
                logError(e, 'Failed to set initial folder');
            }
        }

        button.connect('clicked', () => {
            fileDialog.open(button.get_root(), null, (dialog, res) => {
                try {
                    const file = dialog.open_finish(res);
                    if (file) {
                        const path = file.get_path();
                        if (path)
                            settings.set_string('config-file', path);
                    }
                } catch (e) {
                    // User canceled or error occurred
                }
            });
        });

        fileRow.add_suffix(button);
        fileRow.activatable_widget = button;

        return fileRow;
    }

}
