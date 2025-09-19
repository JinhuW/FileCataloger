/**
 * @file fileTypeIcons.ts
 * @description Utility module for mapping file extensions to their corresponding icon assets
 */

// Import file type icons
import ExcelIcon from '@renderer/assets/icons/files/ic-excel.svg';
import TxtIcon from '@renderer/assets/icons/files/ic-txt.svg';
import FolderIcon from '@renderer/assets/icons/files/ic-folder.svg';
import AudioIcon from '@renderer/assets/icons/files/ic-audio.svg';
import PowerPointIcon from '@renderer/assets/icons/files/ic-power_point.svg';
import ImgIcon from '@renderer/assets/icons/files/ic-img.svg';
import VideoIcon from '@renderer/assets/icons/files/ic-video.svg';
import DocumentIcon from '@renderer/assets/icons/files/ic-document.svg';
import JsIcon from '@renderer/assets/icons/files/ic-js.svg';
import WordIcon from '@renderer/assets/icons/files/ic-word.svg';
import ZipIcon from '@renderer/assets/icons/files/ic-zip.svg';
import PdfIcon from '@renderer/assets/icons/files/ic-pdf.svg';
import AiIcon from '@renderer/assets/icons/files/ic-ai.svg';
import FileIcon from '@renderer/assets/icons/files/ic-file.svg';

/**
 * Map of file extensions to icon paths
 */
const extensionIconMap: Record<string, string> = {
  // Images
  jpg: ImgIcon,
  jpeg: ImgIcon,
  png: ImgIcon,
  gif: ImgIcon,
  bmp: ImgIcon,
  webp: ImgIcon,
  svg: ImgIcon,
  ico: ImgIcon,
  // Documents
  pdf: PdfIcon,
  doc: WordIcon,
  docx: WordIcon,
  xls: ExcelIcon,
  xlsx: ExcelIcon,
  ppt: PowerPointIcon,
  pptx: PowerPointIcon,
  txt: TxtIcon,
  md: TxtIcon,
  rtf: TxtIcon,
  // Archives
  zip: ZipIcon,
  rar: ZipIcon,
  '7z': ZipIcon,
  tar: ZipIcon,
  gz: ZipIcon,
  // Video
  mp4: VideoIcon,
  mov: VideoIcon,
  avi: VideoIcon,
  mkv: VideoIcon,
  webm: VideoIcon,
  flv: VideoIcon,
  // Audio
  mp3: AudioIcon,
  wav: AudioIcon,
  flac: AudioIcon,
  aac: AudioIcon,
  ogg: AudioIcon,
  m4a: AudioIcon,
  // Code
  js: JsIcon,
  jsx: JsIcon,
  ts: JsIcon,
  tsx: JsIcon,
  json: JsIcon,
  // Design
  ai: AiIcon,
  eps: AiIcon,
};

/**
 * Get the appropriate icon for a file based on its extension
 * @param filename - The name of the file
 * @returns The path to the icon SVG
 */
export function getFileIcon(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension && extensionIconMap[extension]) {
    return extensionIconMap[extension];
  }
  return FileIcon;
}

/**
 * Get the appropriate icon for a file type
 * @param type - The type of the item (file, folder, etc.)
 * @returns The path to the icon SVG
 */
export function getTypeIcon(type: string): string {
  switch (type) {
    case 'folder':
      return FolderIcon;
    case 'text':
      return TxtIcon;
    case 'url':
      return DocumentIcon;
    case 'image':
      return ImgIcon;
    default:
      return FileIcon;
  }
}