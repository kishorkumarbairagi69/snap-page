# 📸 SnapPage

### Full-page screenshots. One click. Zero clutter.

**SnapPage** is a lightweight Chrome extension that captures entire webpages as screenshots — not just the visible viewport.

Capture → Edit → Save → Copy → Export.

Everything happens **locally on your device**, with privacy at the core.

---

<p align="center">

**⚡ Fast** &nbsp; • &nbsp; **🔒 Private** &nbsp; • &nbsp; **🎨 Editable** &nbsp; • &nbsp; **🧩 Lightweight**

</p>

---

## ✨ What is SnapPage?

Taking a screenshot of a long webpage shouldn't require stitching together multiple images or installing complicated desktop software.

**SnapPage turns an entire webpage into one clean screenshot.**

Whether you're saving a reference, documenting a webpage, sharing a design, collecting research, or archiving content, SnapPage keeps the workflow simple.

```text
Open webpage
     ↓
Capture full page
     ↓
Edit screenshot
     ↓
Save / Copy / Export
```

---

## 🚀 Features

### 🖼️ Full-Page Capture

Capture the **entire webpage**, even when the page is much longer than your screen.

No scrolling manually.  
No stitching screenshots together.

---

### ✏️ Built-in Editing

Capture first, edit immediately.

SnapPage includes an editing workflow so you can work with your screenshot before saving or exporting it.

---

### 📋 Copy Instantly

Need to paste the screenshot somewhere?

Copy your captured image and paste it directly into:

- Slack
- Discord
- Email
- Documents
- Chat applications
- Design tools

---

### 💾 Save & Export

Keep your captures locally and export them whenever you need.

Designed for a simple:

> **Capture → Edit → Save**

workflow.

---

### ⌨️ Keyboard Shortcut

SnapPage supports a keyboard shortcut for fast full-page capture.

**Default shortcut:**

```text
Alt + Shift + P
```

You can also access the extension directly from Chrome.

---

### 🔒 Privacy First

SnapPage is designed around a simple principle:

> **Your screenshots should stay yours.**

SnapPage does not require an external account or cloud upload for its core screenshot workflow.

Your captured content stays on your device.

---

## 🎯 Why SnapPage?

Most screenshot tools are either too basic or overloaded with features.

SnapPage focuses on the things you actually need:

| Problem | SnapPage |
|---|---|
| Capture only visible screen | ❌ |
| Capture entire webpage | ✅ |
| Manually stitch screenshots | ❌ |
| Edit captures | ✅ |
| Copy captures | ✅ |
| Export captures | ✅ |
| Cloud account required | ❌ |
| Lightweight workflow | ✅ |

---

## 🧩 Extension Architecture

SnapPage is built as a **Chrome Manifest V3 extension**.

```text
SnapPage
│
├── manifest.json
│
├── background.js
│
├── content.js
│
├── popup.html
│
├── editor.html
│
├── result.html
│
├── files.html
│
├── options.html
│
├── onboarding.html
│
├── assets/
│
└── icons/
```

### Core Components

**Background Service Worker**

Handles extension-level background functionality and commands.

**Content Script**

Interacts with the active webpage and supports the capture workflow.

**Popup**

Provides the primary extension interface.

**Editor**

Provides the screenshot editing experience.

**Result**

Handles the captured screenshot workflow and available actions.

**Files**

Provides access to saved captures.

**Options**

Contains extension settings and configuration.

---

## 🛠️ Tech Stack

SnapPage is built using web technologies supported natively by modern Chrome extensions.

| Technology | Purpose |
|---|---|
| JavaScript | Extension logic |
| HTML | Extension UI |
| CSS | Styling & interface |
| Chrome Extensions API | Browser integration |
| Manifest V3 | Extension architecture |
| Chrome Storage API | Local extension data |
| Chrome Downloads API | Local file downloads |

No backend is required for the core extension workflow.

---

# 🧪 Installation — Developer Mode

You can run SnapPage locally without installing it from the Chrome Web Store.

### 1. Clone the repository

```bash
git clone https://github.com/kishorkumarbairagi69/snap-page.git
```

### 2. Open Chrome Extensions

Go to:

```text
chrome://extensions/
```

### 3. Enable Developer Mode

Turn on:

```text
Developer mode
```

usually located in the top-right corner.

### 4. Load the extension

Click:

```text
Load unpacked
```

Then select the:

```text
dist/
```

directory from the cloned repository.

### 5. Start using SnapPage

Pin SnapPage to your Chrome toolbar and open any webpage.

You're ready.

---

# ⚡ Keyboard Shortcut

Default shortcut:

```text
Alt + Shift + P
```

This triggers:

```text
Capture Full Page
```

You can change extension shortcuts through Chrome's extension shortcut settings.

---

# 🖥️ Supported Environment

SnapPage currently targets:

- Google Chrome
- Chromium-based browsers supporting Manifest V3
- Chrome 102+

The extension declares:

```json
"minimum_chrome_version": "102"
```

---

# 🔐 Permissions

SnapPage requests only the permissions required for its functionality.

```text
activeTab
scripting
storage
downloads
```

### Why?

| Permission | Purpose |
|---|---|
| `activeTab` | Access the currently active webpage |
| `scripting` | Run required capture functionality |
| `storage` | Store extension data/settings |
| `downloads` | Save screenshots locally |

SnapPage does **not** require an account for its core functionality.

---

# 📸 Product Screenshots

Add screenshots here to showcase the extension.

Recommended structure:

```text
docs/
└── screenshots/
    ├── popup.png
    ├── capture.png
    ├── editor.png
    └── result.png
```

Then add them to this section:

```markdown
## 📸 Screenshots

### Capture

![SnapPage Capture](docs/screenshots/capture.png)

### Editor

![SnapPage Editor](docs/screenshots/editor.png)

### Result

![SnapPage Result](docs/screenshots/result.png)
```

---

# 🗺️ Roadmap

SnapPage is actively evolving.

Potential future improvements include:

- [ ] Improved annotation tools
- [ ] More export formats
- [ ] Better image compression
- [ ] Custom keyboard shortcuts
- [ ] Screenshot organization
- [ ] Enhanced editor tools
- [ ] Dark mode improvements
- [ ] Performance optimizations
- [ ] Chrome Web Store release

Have an idea?

Open an issue and share it.

---

# 🤝 Contributing

Contributions are welcome.

### Fork

Create your own fork of the repository.

### Clone

```bash
git clone https://github.com/kishorkumarbairagi69/snap-page.git
```

### Create a branch

```bash
git checkout -b feature/my-feature
```

### Make your changes

Test the extension locally using Chrome Developer Mode.

### Commit

```bash
git add .
git commit -m "Add my feature"
```

### Push

```bash
git push origin feature/my-feature
```

Then open a Pull Request.

---

# 🐛 Bug Reports

Found a problem?

Please open a GitHub issue and include:

- Chrome version
- Operating system
- SnapPage version
- URL where the problem occurred
- Steps to reproduce
- Screenshots or screen recordings
- Console errors, if available

The more detail you provide, the easier it is to reproduce and fix the issue.

---

# 💡 Feature Requests

Have an idea for SnapPage?

Open a feature request and explain:

**What problem does it solve?**

**How should the feature work?**

**Why would it be useful?**

Good ideas can become future SnapPage features.

---

# 🔒 Privacy

SnapPage is designed with a **local-first approach**.

The core screenshot workflow is designed to operate on your device rather than requiring screenshot uploads to a remote server.

For complete details about data handling, permissions, and privacy practices, see the project's privacy documentation.

---

# 📄 License

License information will be added to this repository.

---

## 🌟 Support the Project

If SnapPage is useful to you:

⭐ **Star the repository**

🐛 **Report bugs**

💡 **Suggest features**

🤝 **Contribute**

Sharing the project also helps more people discover it.

---

<p align="center">

### 📸 Capture the whole page.

### ✏️ Make it yours.

### 🔒 Keep it private.

**SnapPage**

</p>

---

<p align="center">
Built with ❤️ for a simpler screenshot workflow.
</p>
