const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

// Constants
const STYLE_CLASSES = {
  TASK_BOX: "task-item-box",
  CHECKBOX_COMPLETED: "task-checkbox task-completed",
  CHECKBOX_PENDING: "task-checkbox task-pending",
  CHECKBOX_ICON: "task-checkbox-icon",
  LABEL: "task-label",
  LABEL_COMPLETED: "task-label task-completed-text",
  DELETE_BUTTON: "task-delete-button",
  DELETE_ICON: "task-delete-icon",
  INPUT_BOX: "task-input-box",
  ENTRY: "task-entry",
  ADD_BUTTON: "task-add-button",
};

const ICONS = {
  CHECKED: "checkbox-checked-symbolic",
  UNCHECKED: "checkbox-symbolic",
  ADD: "list-add-symbolic",
  DELETE: "edit-delete-symbolic",
};

const TIMEOUTS = {
  FOCUS_DELAY: 50,
  MENU_FOCUS_DELAY: 100,
};

// Custom Task Item class for individual to-do items
function TaskItem(applet, task) {
  this._init(applet, task);
}

TaskItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (applet, task) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, { reactive: false });

    this.applet = applet;
    this.task = task;
    this._createUI();
    this._connectSignals();
  },

  _createUI: function () {
    // Create main container
    this.box = new St.BoxLayout({
      style_class: STYLE_CLASSES.TASK_BOX,
      vertical: false,
      x_expand: true,
    });

    // Create and configure checkbox
    this._createCheckbox();

    // Create task label
    this._createLabel();

    // Create delete button
    this._createDeleteButton();

    // Assemble UI
    this.box.add_child(this.checkbox);
    this.box.add_child(this.label);
    this.box.add_child(this.deleteButton);
    this.addActor(this.box);
  },

  _createCheckbox: function () {
    this.checkbox = new St.Button({
      style_class: this.task.completed
        ? STYLE_CLASSES.CHECKBOX_COMPLETED
        : STYLE_CLASSES.CHECKBOX_PENDING,
      can_focus: true,
      toggle_mode: true,
      checked: this.task.completed,
    });

    this.checkIcon = new St.Icon({
      icon_name: this.task.completed ? ICONS.CHECKED : ICONS.UNCHECKED,
      icon_size: 16,
      style_class: STYLE_CLASSES.CHECKBOX_ICON,
    });

    this.checkbox.set_child(this.checkIcon);
  },

  _createLabel: function () {
    this.label = new St.Label({
      text: this.task.text,
      style_class: this.task.completed
        ? STYLE_CLASSES.LABEL_COMPLETED
        : STYLE_CLASSES.LABEL,
      y_align: Clutter.ActorAlign.CENTER,
      x_expand: true,
    });
  },

  _createDeleteButton: function () {
    this.deleteButton = new St.Button({
      style_class: STYLE_CLASSES.DELETE_BUTTON,
      can_focus: true,
    });

    const deleteIcon = new St.Icon({
      icon_name: ICONS.DELETE,
      icon_size: 14,
      style_class: STYLE_CLASSES.DELETE_ICON,
    });

    this.deleteButton.set_child(deleteIcon);
  },

  _connectSignals: function () {
    this.checkbox.connect("clicked", Lang.bind(this, this._onToggleTask));
    this.deleteButton.connect("clicked", Lang.bind(this, this._onDeleteTask));
  },

  _onToggleTask: function () {
    this.task.completed = !this.task.completed;
    this._updateAppearance();
    this.applet.saveTasks();
    this.applet._updateIcon();
    this.applet._reorderTasksInPlace();
  },

  _onDeleteTask: function () {
    this.applet.deleteTask(this.task.id);
  },

  _updateAppearance: function () {
    // Update checkbox icon and styles efficiently
    const isCompleted = this.task.completed;

    this.checkIcon.icon_name = isCompleted ? ICONS.CHECKED : ICONS.UNCHECKED;

    // Update checkbox styles
    this.checkbox.style_class = isCompleted
      ? STYLE_CLASSES.CHECKBOX_COMPLETED
      : STYLE_CLASSES.CHECKBOX_PENDING;

    // Update label styles
    this.label.style_class = isCompleted
      ? STYLE_CLASSES.LABEL_COMPLETED
      : STYLE_CLASSES.LABEL;
  },
};

// Main Applet class
function QuickListApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}

QuickListApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function (orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(
      this,
      orientation,
      panel_height,
      instance_id
    );

    this._initializeProperties();
    this._setupDataHandling();
    this._setupMenu(orientation);
    this._updateIcon();
  },

  _initializeProperties: function () {
    this.tasks = [];
    this.nextTaskId = 1;
    this.taskItems = new Map();
    this.firstSeparator = null;

    // Set applet appearance
    this.set_applet_icon_path(__meta.path + "/icon.png");
    this.set_applet_tooltip(_("QuickList - Click to manage your to-do list"));
  },

  _setupDataHandling: function () {
    this.dataDir = GLib.get_user_data_dir() + "/task-tab-applet";
    this.dataFile = this.dataDir + "/tasks.json";

    this._ensureDataDirectory();
    this.loadTasks();
  },

  _setupMenu: function (orientation) {
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this._buildMenu();
  },

  _ensureDataDirectory: function () {
    const dir = Gio.File.new_for_path(this.dataDir);
    if (!dir.query_exists(null)) {
      try {
        dir.make_directory_with_parents(null);
      } catch (e) {
        global.logError(
          "QuickList: Failed to create data directory: " + e.message
        );
      }
    }
  },

  _buildMenu: function () {
    this.menu.removeAll();
    this.taskItems.clear();

    // Add components in order
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    this._createAddTaskSection();

    if (this.tasks.length > 0) {
      this.firstSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(this.firstSeparator);
      this._addTaskItems();
    }
  },

  _createAddTaskSection: function () {
    const inputContainer = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    const inputBox = new St.BoxLayout({
      style_class: STYLE_CLASSES.INPUT_BOX,
      vertical: false,
      x_expand: true,
    });

    this._createTaskEntry();
    this._createAddButton();

    inputBox.add_child(this.newTaskEntry);
    inputBox.add_child(this.addButton);
    inputContainer.addActor(inputBox);
    this.menu.addMenuItem(inputContainer);
  },

  _createTaskEntry: function () {
    this.newTaskEntry = new St.Entry({
      style_class: STYLE_CLASSES.ENTRY,
      hint_text: "Add a new task...",
      can_focus: true,
      x_expand: true,
    });

    this.newTaskEntry.clutter_text.connect(
      "activate",
      Lang.bind(this, this._onAddTask)
    );
  },

  _createAddButton: function () {
    this.addButton = new St.Button({
      style_class: STYLE_CLASSES.ADD_BUTTON,
      can_focus: true,
    });

    const addIcon = new St.Icon({
      icon_name: ICONS.ADD,
      icon_size: 16,
    });

    this.addButton.set_child(addIcon);
    this.addButton.connect("clicked", Lang.bind(this, this._onAddTask));
  },

  _addTaskItems: function () {
    const sortedTasks = this._getSortedTasks();

    for (const task of sortedTasks) {
      const taskItem = new TaskItem(this, task);
      this.menu.addMenuItem(taskItem);
      this.taskItems.set(task.id, taskItem);
    }
  },

  _getSortedTasks: function () {
    return this.tasks.slice().sort((a, b) => {
      if (a.completed === b.completed) {
        return b.id - a.id; // Newer tasks first within each group
      }
      return a.completed - b.completed; // Incomplete tasks first
    });
  },

  _reorderTasksInPlace: function () {
    const sortedTasks = this._getSortedTasks();

    // Remove all task items from menu efficiently
    for (const [taskId, taskItem] of this.taskItems) {
      this.menu.box.remove_child(taskItem.actor);
    }

    // Find insertion point and re-add items
    const insertIndex = this._findInsertionIndex();
    if (insertIndex !== -1) {
      sortedTasks.forEach((task, i) => {
        const taskItem = this.taskItems.get(task.id);
        if (taskItem) {
          this.menu.box.insert_child_at_index(taskItem.actor, insertIndex + i);
        }
      });
    }
  },

  _findInsertionIndex: function () {
    if (!this.firstSeparator) return -1;
    const menuItems = this.menu._getMenuItems();
    return menuItems.findIndex((item) => item === this.firstSeparator) + 1;
  },

  _onAddTask: function () {
    const taskText = this.newTaskEntry.get_text().trim();
    if (!taskText) return;

    const newTask = this._createTask(taskText);
    this.tasks.push(newTask);
    this.saveTasks();

    this.newTaskEntry.set_text("");
    this._addNewTaskItem(newTask);
    this._focusInputDelayed();
    this._updateIcon();
  },

  _createTask: function (text) {
    return {
      id: this.nextTaskId++,
      text: text,
      completed: false,
      createdAt: new Date().toISOString(),
    };
  },

  _addNewTaskItem: function (newTask) {
    // If this is the first task and no separator exists, add one
    if (this.tasks.length === 1 && !this.firstSeparator) {
      this.firstSeparator = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(this.firstSeparator);
    }

    const taskItem = new TaskItem(this, newTask);
    const insertIndex = this._findInsertionIndex();

    if (insertIndex !== -1) {
      this.menu.addMenuItem(taskItem, insertIndex);
    } else {
      this.menu.addMenuItem(taskItem);
    }

    this.taskItems.set(newTask.id, taskItem);
  },

  _focusInputDelayed: function () {
    Mainloop.timeout_add(
      TIMEOUTS.FOCUS_DELAY,
      Lang.bind(this, function () {
        if (this.newTaskEntry) {
          this.newTaskEntry.grab_key_focus();
        }
        return false;
      })
    );
  },

  deleteTask: function (taskId) {
    this.tasks = this.tasks.filter((task) => task.id !== taskId);
    this.saveTasks();

    const taskItem = this.taskItems.get(taskId);
    if (taskItem) {
      this.menu.box.remove_child(taskItem.actor);
      this.taskItems.delete(taskId);
    }

    // If no tasks remain, remove the first separator
    if (this.tasks.length === 0 && this.firstSeparator) {
      this.menu.box.remove_child(this.firstSeparator.actor);
      this.firstSeparator = null;
    }

    this._focusInputDelayed();
    this._updateIcon();
  },

  loadTasks: function () {
    try {
      const file = Gio.File.new_for_path(this.dataFile);
      if (!file.query_exists(null)) return;

      const [success, contents] = file.load_contents(null);
      if (success) {
        const data = JSON.parse(contents);
        this.tasks = data.tasks || [];
        this.nextTaskId = data.nextTaskId || 1;
        this._validateTasks();
      }
    } catch (e) {
      global.logError("QuickList: Failed to load tasks: " + e.message);
      this._resetTasks();
    }
  },

  _validateTasks: function () {
    this.tasks.forEach((task) => {
      if (!task.hasOwnProperty("completed")) task.completed = false;
      if (!task.hasOwnProperty("createdAt"))
        task.createdAt = new Date().toISOString();
    });
  },

  _resetTasks: function () {
    this.tasks = [];
    this.nextTaskId = 1;
  },

  saveTasks: function () {
    try {
      const data = {
        tasks: this.tasks,
        nextTaskId: this.nextTaskId,
        lastSaved: new Date().toISOString(),
      };

      const file = Gio.File.new_for_path(this.dataFile);
      const outputStream = file.replace(
        null,
        false,
        Gio.FileCreateFlags.NONE,
        null
      );
      const dataString = JSON.stringify(data, null, 2);

      outputStream.write(dataString, null);
      outputStream.close(null);
    } catch (e) {
      global.logError("QuickList: Failed to save tasks: " + e.message);
    }
  },

  _updateIcon: function () {
    const pendingCount = this.tasks.filter((task) => !task.completed).length;
    const tooltip =
      pendingCount > 0
        ? `QuickList - ${pendingCount} pending task${
            pendingCount !== 1 ? "s" : ""
          }`
        : "QuickList - All tasks completed!";

    this.set_applet_tooltip(tooltip);
  },

  on_applet_clicked: function () {
    this.menu.toggle();

    if (this.menu.isOpen && this.newTaskEntry) {
      Mainloop.timeout_add(
        TIMEOUTS.MENU_FOCUS_DELAY,
        Lang.bind(this, function () {
          this.newTaskEntry.grab_key_focus();
          return false;
        })
      );
    }
  },

  on_applet_removed_from_panel: function () {
    this.saveTasks();
  },
};

function main(metadata, orientation, panel_height, instance_id) {
  return new QuickListApplet(orientation, panel_height, instance_id);
}
