# QuickList Applet - Installation & Usage Guide

<img src="./QuickList-Banner.png" alt="QuickList Banner" style="height:240px">

## 📁 Directory Structure

Create the following directory structure in your home folder:

```text
~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet/
├── applet.js
├── metadata.json
└── stylesheet.css
```

## 🚀 Installation Steps

### Step 1: Create the Applet Directory

```bash
mkdir -p ~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet
```

### Step 2: Copy the Files

Save each of the provided files into the applet directory:

1. Copy `applet.js` to `~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet/applet.js`
2. Copy `metadata.json` to `~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet/metadata.json`
3. Copy `stylesheet.css` to `~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet/stylesheet.css`
4. Copy `icon.png` to `~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet/icon.png`

### Step 3: Set Permissions

```bash
chmod +x ~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet/applet.js
```

### Step 4: Reload Cinnamon

Press `Alt + F2`, type `r`, and press Enter to reload Cinnamon.

Alternatively, you can restart Cinnamon by logging out and logging back in.

### Step 5: Add the Applet to Panel

1. Right-click on the Cinnamon panel
2. Select "Applets"
3. In the "Manage" tab, look for "QuickList" in the list
4. Click the "+" button to add it to your panel
5. Close the applet manager

## 🎯 Usage

### Basic Operations

- **Click the applet icon** in the panel to open the task menu
- **Add new tasks**: Type in the input field at the top and press Enter or click the "+" button
- **Mark tasks complete**: Click the checkbox next to any task
- **Delete tasks**: Click the red delete button (×) next to any task
- **View progress**: Hover on the applet icon to view the number of pending tasks

### Features

- **Persistent Storage**: Tasks are automatically saved to `~/.local/share/task-tab-applet/tasks.json`
- **Smart Sorting**: Incomplete tasks appear first, followed by completed tasks
- **Visual Feedback**: Completed tasks are grayed out
- **Auto-focus**: Input field is automatically focused when menu opens

## 🔧 Troubleshooting

### Applet Not Appearing

1. Check file permissions: `ls -la ~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet/`
2. Verify the UUID matches the directory name exactly
3. Restart Cinnamon completely (log out/in)

### Menu Not Opening

1. Check the Looking Glass for errors: Press `Alt + F2`, type `lg`, press Enter
2. Look in the "Errors" tab for any JavaScript errors
3. Ensure all three files are present in the correct directory

### Tasks Not Saving

1. Check if the data directory exists: `ls -la ~/.local/share/task-tab-applet/`
2. Verify write permissions to your data directory
3. Check Looking Glass for file system errors

### Styling Issues

1. Ensure `stylesheet.css` is in the correct location
2. Try reloading the applet by removing and re-adding it
3. Check if system theme conflicts with custom styles

## 🛠️ Development & Customization

### Modifying the Applet

1. **Change the icon**: Edit the `set_applet_icon_symbolic_name()` calls in `applet.js`
2. **Adjust colors**: Modify the CSS classes in `stylesheet.css`
3. **Add features**: Extend the `QuickListApplet` class in `applet.js`

### Data Storage Location

Tasks are stored in: `~/.local/share/task-tab-applet/tasks.json`

The JSON structure:

```json
{
  "tasks": [
    {
      "id": 1,
      "text": "Sample task",
      "completed": false,
      "createdAt": "2025-05-31T10:30:00.000Z"
    }
  ],
  "nextTaskId": 2,
  "lastSaved": "2025-05-31T10:30:00.000Z"
}
```

### Debugging

Enable debug logging by opening Looking Glass (`Alt + F2`, type `lg`):

- Monitor the "Errors" tab for JavaScript errors
- Use `global.log()` in the code for custom debug messages
- Check system logs: `journalctl -f` while testing

## 🔄 Updating the Applet

To update the applet:

1. Replace the files in the applet directory
2. Reload Cinnamon (`Alt + F2`, type `r`)
3. The applet will reload with your changes

## 🗑️ Uninstalling

1. Remove from panel via Applet Manager
2. Delete the directory: `rm -rf ~/.local/share/cinnamon/applets/task-tab-applet@cinnamon-applet/`
3. Optionally remove data: `rm -rf ~/.local/share/task-tab-applet/`

## 🎨 Customization Tips

- **Custom colors**: Update color values in the CSS file
- **Different icons**: Browse available icons with `gtk3-icon-browser` or similar tools

The applet is fully functional and ready to use! Click to add, check off, and manage your tasks directly from the panel
