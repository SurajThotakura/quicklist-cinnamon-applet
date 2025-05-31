const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

// Custom Task Item class for individual to-do items
function TaskItem(applet, task) {
  this._init(applet, task);
}

TaskItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (applet, task) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

    this.applet = applet;
    this.task = task;

    // Create horizontal box layout
    this.box = new St.BoxLayout({
      style_class: "task-item-box",
      vertical: false,
      x_expand: true,
    });

    // Create checkbox
    this.checkbox = new St.Button({
      style_class:
        "task-checkbox " + (task.completed ? "task-completed" : "task-pending"),
      can_focus: true,
      toggle_mode: true,
      checked: task.completed,
    });

    // Checkbox icon
    this.checkIcon = new St.Icon({
      icon_name: task.completed
        ? "checkbox-checked-symbolic"
        : "checkbox-symbolic",
      icon_size: 16,
      style_class: "task-checkbox-icon",
    });
    this.checkbox.set_child(this.checkIcon);

    // Task text label
    this.label = new St.Label({
      text: task.text,
      style_class:
        "task-label " + (task.completed ? "task-completed-text" : ""),
      y_align: Clutter.ActorAlign.CENTER,
      x_expand: true,
    });

    // Delete button
    this.deleteButton = new St.Button({
      style_class: "task-delete-button",
      can_focus: true,
    });

    this.deleteIcon = new St.Icon({
      icon_name: "edit-delete-symbolic",
      icon_size: 14,
      style_class: "task-delete-icon",
    });
    this.deleteButton.set_child(this.deleteIcon);

    // Add components to box
    this.box.add_child(this.checkbox);
    this.box.add_child(this.label);
    this.box.add_child(this.deleteButton);

    this.addActor(this.box);

    // Connect signals
    this.checkbox.connect("clicked", Lang.bind(this, this._onToggleTask));
    this.deleteButton.connect("clicked", Lang.bind(this, this._onDeleteTask));
  },

  _onToggleTask: function () {
    this.task.completed = !this.task.completed;
    this._updateAppearance();
    this.applet.saveTasks();
    this.applet._updateFooter();
    this.applet._updateIcon();
  },

  _onDeleteTask: function () {
    this.applet.deleteTask(this.task.id);
  },

  _updateAppearance: function () {
    // Update checkbox icon
    this.checkIcon.icon_name = this.task.completed
      ? "checkbox-checked-symbolic"
      : "checkbox-symbolic";

    // Update styles
    if (this.task.completed) {
      this.checkbox.add_style_class_name("task-completed");
      this.checkbox.remove_style_class_name("task-pending");
      this.label.add_style_class_name("task-completed-text");
    } else {
      this.checkbox.add_style_class_name("task-pending");
      this.checkbox.remove_style_class_name("task-completed");
      this.label.remove_style_class_name("task-completed-text");
    }
  },
};

// Main Applet class
function TaskTabApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}

TaskTabApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function (orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(
      this,
      orientation,
      panel_height,
      instance_id
    );

    // Set applet icon
    this.set_applet_icon_symbolic_name("checkbox-checked-symbolic");
    this.set_applet_tooltip(_("Task Tab - Click to manage your to-do list"));

    // Initialize data
    this.tasks = [];
    this.nextTaskId = 1;
    this.dataDir = GLib.get_user_data_dir() + "/task-tab-applet";
    this.dataFile = this.dataDir + "/tasks.json";

    // Initialize menu item references
    this.taskItems = new Map(); // Map task ID to TaskItem
    this.footerItem = null;
    this.firstSeparator = null;
    this.secondSeparator = null;

    // Create data directory if it doesn't exist
    this._ensureDataDirectory();

    // Load existing tasks
    this.loadTasks();

    // Setup popup menu
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this._buildMenu();

    // Update applet icon based on task status
    this._updateIcon();
  },

  _ensureDataDirectory: function () {
    let dir = Gio.File.new_for_path(this.dataDir);
    if (!dir.query_exists(null)) {
      try {
        dir.make_directory_with_parents(null);
      } catch (e) {
        global.logError(
          "TaskTab: Failed to create data directory: " + e.message
        );
      }
    }
  },

  _buildMenu: function () {
    // Clear existing menu items
    this.menu.removeAll();
    this.taskItems.clear();

    // Add header
    let headerItem = new PopupMenu.PopupMenuItem("📋 Task Tab", {
      reactive: false,
    });
    headerItem.actor.add_style_class_name("task-header");
    this.menu.addMenuItem(headerItem);

    // Add separator
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Add input section for new tasks
    this._createAddTaskSection();

    // Add first separator if there are tasks
    if (this.tasks.length > 0) {
      this.firstSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(this.firstSeparator);
    }

    // Add task items
    this._addTaskItems();

    // Add footer with task count
    this._addFooter();
  },

  _createAddTaskSection: function () {
    // Create container for input section
    let inputContainer = new PopupMenu.PopupBaseMenuItem({ reactive: false });

    let inputBox = new St.BoxLayout({
      style_class: "task-input-box",
      vertical: false,
      x_expand: true,
    });

    // Text entry for new tasks
    this.newTaskEntry = new St.Entry({
      style_class: "task-entry",
      hint_text: "Add a new task...",
      can_focus: true,
      x_expand: true,
    });

    // Add button
    this.addButton = new St.Button({
      style_class: "task-add-button",
      can_focus: true,
    });

    let addIcon = new St.Icon({
      icon_name: "list-add-symbolic",
      icon_size: 16,
    });
    this.addButton.set_child(addIcon);

    inputBox.add_child(this.newTaskEntry);
    inputBox.add_child(this.addButton);
    inputContainer.addActor(inputBox);

    this.menu.addMenuItem(inputContainer);

    // Connect signals
    this.newTaskEntry.clutter_text.connect(
      "activate",
      Lang.bind(this, this._onAddTask)
    );
    this.addButton.connect("clicked", Lang.bind(this, this._onAddTask));
  },

  _addTaskItems: function () {
    // Sort tasks: incomplete first, then completed
    let sortedTasks = this.tasks.slice().sort((a, b) => {
      if (a.completed === b.completed) {
        return b.id - a.id; // Newer tasks first within each group
      }
      return a.completed - b.completed; // Incomplete tasks first
    });

    for (let task of sortedTasks) {
      let taskItem = new TaskItem(this, task);
      this.menu.addMenuItem(taskItem);
      this.taskItems.set(task.id, taskItem);
    }
  },

  _addFooter: function () {
    if (this.tasks.length > 0) {
      this.secondSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(this.secondSeparator);

      let completedCount = this.tasks.filter((task) => task.completed).length;
      let footerText = `${completedCount}/${this.tasks.length} completed`;
      this.footerItem = new PopupMenu.PopupMenuItem(footerText, {
        reactive: false,
      });
      this.footerItem.actor.add_style_class_name("task-footer");
      this.menu.addMenuItem(this.footerItem);
    }
  },

  _updateFooter: function () {
    if (this.footerItem && this.tasks.length > 0) {
      let completedCount = this.tasks.filter((task) => task.completed).length;
      let footerText = `${completedCount}/${this.tasks.length} completed`;
      this.footerItem.label.set_text(footerText);
    }
  },

  _reorderTasks: function () {
    // Only reorder if needed to avoid unnecessary rebuilds
    // For now, we'll keep the current order and only rebuild when tasks are added/removed
    // This prevents the menu from closing when toggling task completion
  },

  _onAddTask: function () {
    let taskText = this.newTaskEntry.get_text().trim();
    if (taskText === "") return;

    // Create new task
    let newTask = {
      id: this.nextTaskId++,
      text: taskText,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    this.tasks.push(newTask);
    this.saveTasks();

    // Clear input
    this.newTaskEntry.set_text("");

    // Store menu open state and rebuild
    let wasOpen = this.menu.isOpen;
    this._buildMenu();

    // Reopen menu and focus input if it was open
    if (wasOpen) {
      Mainloop.timeout_add(
        50,
        Lang.bind(this, function () {
          this.menu.open();
          if (this.newTaskEntry) {
            this.newTaskEntry.grab_key_focus();
          }
          return false;
        })
      );
    }

    this._updateIcon();
  },

  _addNewTaskItem: function (newTask) {
    // If this is the first task, we need to add separators and footer
    if (this.tasks.length === 1) {
      this.firstSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(this.firstSeparator);
    }

    // Create and add the new task item
    let taskItem = new TaskItem(this, newTask);

    // Insert at the right position (incomplete tasks go first)
    let insertIndex = this._findInsertIndex(newTask);
    this.menu.addMenuItem(taskItem, insertIndex);
    this.taskItems.set(newTask.id, taskItem);

    // Update or add footer
    if (this.tasks.length === 1) {
      this._addFooter();
    } else {
      this._updateFooter();
    }
  },

  _findInsertIndex: function (newTask) {
    // Find the correct position to insert the new task
    // New incomplete tasks should go at the beginning of the task list
    let menuItems = this.menu._getMenuItems();
    let taskStartIndex = -1;

    // Find where task items start
    for (let i = 0; i < menuItems.length; i++) {
      if (menuItems[i] instanceof TaskItem) {
        taskStartIndex = i;
        break;
      }
    }

    if (taskStartIndex === -1) {
      // No existing tasks, insert after the first separator
      for (let i = 0; i < menuItems.length; i++) {
        if (menuItems[i] instanceof PopupMenu.PopupSeparatorMenuItem) {
          return i + 1;
        }
      }
    }

    // Insert at the beginning of task items for incomplete tasks
    return taskStartIndex;
  },

  deleteTask: function (taskId) {
    // Remove from tasks array
    this.tasks = this.tasks.filter((task) => task.id !== taskId);
    this.saveTasks();

    // Rebuild menu to reflect changes
    // Store menu open state
    let wasOpen = this.menu.isOpen;
    this._buildMenu();

    // Reopen menu if it was open
    if (wasOpen) {
      Mainloop.timeout_add(
        50,
        Lang.bind(this, function () {
          this.menu.open();
          if (this.newTaskEntry) {
            this.newTaskEntry.grab_key_focus();
          }
          return false;
        })
      );
    }

    this._updateIcon();
  },

  loadTasks: function () {
    try {
      let file = Gio.File.new_for_path(this.dataFile);
      if (file.query_exists(null)) {
        let [success, contents] = file.load_contents(null);
        if (success) {
          let data = JSON.parse(contents);
          this.tasks = data.tasks || [];
          this.nextTaskId = data.nextTaskId || 1;

          // Ensure all tasks have required properties
          this.tasks.forEach((task) => {
            if (!task.hasOwnProperty("completed")) task.completed = false;
            if (!task.hasOwnProperty("createdAt"))
              task.createdAt = new Date().toISOString();
          });
        }
      }
    } catch (e) {
      global.logError("TaskTab: Failed to load tasks: " + e.message);
      this.tasks = [];
      this.nextTaskId = 1;
    }
  },

  saveTasks: function () {
    try {
      let data = {
        tasks: this.tasks,
        nextTaskId: this.nextTaskId,
        lastSaved: new Date().toISOString(),
      };

      let file = Gio.File.new_for_path(this.dataFile);
      let outputStream = file.replace(
        null,
        false,
        Gio.FileCreateFlags.NONE,
        null
      );
      let dataString = JSON.stringify(data, null, 2);

      outputStream.write(dataString, null);
      outputStream.close(null);
    } catch (e) {
      global.logError("TaskTab: Failed to save tasks: " + e.message);
    }
  },

  _updateIcon: function () {
    let pendingTasks = this.tasks.filter((task) => !task.completed).length;
    if (pendingTasks > 0) {
      this.set_applet_icon_symbolic_name("checkbox-symbolic");
      this.set_applet_tooltip(
        `Task Tab - ${pendingTasks} pending task${
          pendingTasks !== 1 ? "s" : ""
        }`
      );
    } else {
      this.set_applet_icon_symbolic_name("checkbox-checked-symbolic");
      this.set_applet_tooltip("Task Tab - All tasks completed!");
    }
  },

  on_applet_clicked: function () {
    this.menu.toggle();

    // Focus the input field when menu opens
    if (this.menu.isOpen && this.newTaskEntry) {
      Mainloop.timeout_add(
        100,
        Lang.bind(this, function () {
          this.newTaskEntry.grab_key_focus();
          return false;
        })
      );
    }
  },

  on_applet_removed_from_panel: function () {
    // Clean up when applet is removed
    this.saveTasks();
  },
};

function main(metadata, orientation, panel_height, instance_id) {
  return new TaskTabApplet(orientation, panel_height, instance_id);
}
