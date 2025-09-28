#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Clean up old and oversized log files from FileCataloger and Electron folders
 */
async function cleanupLogs() {
  const homeDir = os.homedir();
  const logDirectories = [
    path.join(homeDir, 'Library/Application Support/FileCataloger/logs'),
    path.join(homeDir, 'Library/Application Support/filecataloger/logs'),
    path.join(homeDir, 'Library/Logs/FileCataloger'),
    path.join(homeDir, 'Library/Logs/filecataloger'),
  ];

  console.log('🧹 Starting log cleanup...\n');

  for (const logDir of logDirectories) {
    if (!fs.existsSync(logDir)) {
      console.log(`⏭️  Skipping ${logDir} (doesn't exist)`);
      continue;
    }

    console.log(`📁 Checking ${logDir}`);

    try {
      const files = fs.readdirSync(logDir);
      let totalSize = 0;
      let deletedCount = 0;
      let deletedSize = 0;

      for (const file of files) {
        if (!file.endsWith('.log') && !file.endsWith('.log.gz')) continue;

        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        const sizeMB = stats.size / (1024 * 1024);
        const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

        // Delete if:
        // - File is larger than 10MB
        // - File is older than 7 days
        // - File is from September 2025 (old format)
        if (sizeMB > 10 || ageInDays > 7 || file.includes('2025-09')) {
          console.log(`  🗑️  Deleting ${file} (${sizeMB.toFixed(1)}MB, ${ageInDays.toFixed(1)} days old)`);
          fs.unlinkSync(filePath);
          deletedCount++;
          deletedSize += stats.size;
        } else {
          console.log(`  ✅ Keeping ${file} (${sizeMB.toFixed(1)}MB, ${ageInDays.toFixed(1)} days old)`);
        }
      }

      const totalSizeMB = totalSize / (1024 * 1024);
      const deletedSizeMB = deletedSize / (1024 * 1024);

      console.log(`  📊 Summary: ${deletedCount} files deleted (${deletedSizeMB.toFixed(1)}MB freed)`);
      console.log(`  📊 Total size: ${totalSizeMB.toFixed(1)}MB\n`);
    } catch (error) {
      console.error(`  ❌ Error processing ${logDir}:`, error);
    }
  }

  // Also clean up Electron app support folder if it exists
  const electronPaths = [
    path.join(homeDir, 'Library/Application Support/Electron'),
    path.join(homeDir, '.config/Electron'),
  ];

  for (const electronPath of electronPaths) {
    if (!fs.existsSync(electronPath)) continue;

    console.log(`📁 Checking Electron folder: ${electronPath}`);

    try {
      // Look for log files in Electron folder
      const walkDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            // Skip node_modules and other large directories
            if (['node_modules', 'Cache', 'GPUCache'].includes(entry.name)) continue;
            walkDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.log')) {
            const stats = fs.statSync(fullPath);
            const sizeMB = stats.size / (1024 * 1024);

            if (sizeMB > 5) {
              console.log(`  🗑️  Deleting large log: ${fullPath} (${sizeMB.toFixed(1)}MB)`);
              fs.unlinkSync(fullPath);
            }
          }
        }
      };

      walkDir(electronPath);
    } catch (error) {
      console.error(`  ❌ Error processing Electron folder:`, error);
    }
  }

  console.log('✨ Log cleanup completed!');
}

// Run the cleanup
cleanupLogs().catch(console.error);