# File Last Updated Date Plugin

A FileCataloger plugin that adds the file's last modification date as a component for renaming files.

## Features

- **Multiple Date Formats**: Choose from 10+ predefined date formats or create your own custom format
- **Prefix/Suffix Support**: Add custom text before or after the date
- **Timezone Support**: Use local time or UTC
- **Real-time Preview**: See how the date will look in your rename pattern
- **Batch Processing**: Efficiently handles multiple files
- **Error Handling**: Graceful handling of invalid dates and formats

## Installation

1. Download or clone this plugin directory
2. Install via FileCataloger's Plugin Manager:
   - Open FileCataloger
   - Go to Preferences → Plugins
   - Click "Install Local Plugin"
   - Select the plugin directory

## Configuration Options

### Date Format
Choose from predefined formats:
- `YYYYMMDD` → 20250122
- `YYYY-MM-DD` → 2025-01-22
- `DD/MM/YYYY` → 22/01/2025
- `MM/DD/YYYY` → 01/22/2025
- `YYYY-MM-DD_HH-mm-ss` → 2025-01-22_14-30-45
- `MMM DD, YYYY` → Jan 22, 2025
- `DD MMM YYYY` → 22 Jan 2025
- `YYYY/MM/DD` → 2025/01/22
- `YYMMDD` → 250122
- `DDMMYYYY` → 22012025
- **Custom Format** → Define your own pattern

### Custom Format Patterns
When using custom format, you can use these patterns:
- `YYYY` → Full year (2025)
- `YY` → Short year (25)
- `MM` → Month with leading zero (01-12)
- `MMM` → Short month name (Jan, Feb, etc.)
- `DD` → Day with leading zero (01-31)
- `HH` → Hour with leading zero (00-23)
- `mm` → Minute with leading zero (00-59)
- `ss` → Second with leading zero (00-59)

### Additional Options
- **Prefix**: Text to add before the date (e.g., "lastmod_", "updated_")
- **Suffix**: Text to add after the date (e.g., "_backup", "_v")
- **Timezone**: Choose between Local Time or UTC

## Examples

With a file last modified on January 22, 2025 at 2:30:45 PM:

| Format | Prefix | Suffix | Result |
|--------|--------|--------|--------|
| `YYYYMMDD` | `lastmod_` | | `lastmod_20250122` |
| `YYYY-MM-DD` | | `_backup` | `2025-01-22_backup` |
| `MMM DD, YYYY` | `updated_` | `_v` | `updated_Jan 22, 2025_v` |
| Custom: `[Last modified] YYYY-MM-DD` | | | `Last modified 2025-01-22` |

## Use Cases

- **Version Control**: Add modification dates to track file versions
- **Backup Organization**: Include last modified dates in backup filenames
- **Archive Management**: Organize files by their last update time
- **Document Tracking**: Track when documents were last edited
- **Media Organization**: Sort photos/videos by modification date

## API

The plugin exposes several API methods:

```javascript
// Get available date formats
plugin.api.getAvailableFormats()

// Get available timezones
plugin.api.getTimezones()

// Format a file date with a specific format
plugin.api.formatFileDate(timestamp, format)

// Check if a timestamp is valid
plugin.api.isValidDate(timestamp)
```

## Technical Details

- **Plugin ID**: `file-last-updated`
- **Version**: 1.0.0
- **Type**: Naming Component
- **Requirements**: FileCataloger 2.0.0+

## Development

This plugin is written in JavaScript using the FileCataloger Plugin SDK. The main entry point is `index.js`.

### File Structure
```
file-last-updated-plugin/
├── index.js          # Main plugin code
├── package.json      # Plugin manifest
└── README.md         # This file
```

## License

MIT License

## Support

For issues, feature requests, or contributions, please visit the [FileCataloger Plugins Repository](https://github.com/filecataloger/plugins).