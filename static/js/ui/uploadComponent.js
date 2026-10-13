import { readFileAsArrayBuffer, parseExcelFile } from '../services/excelParser.js';

/**
 * Display file upload status notifications.
 * @param {string} message - Status text
 * @param {'success'|'error'|''} [type=''] - Styling state class
 */
export function showUploadStatus(message, type = '') {
  const container = document.getElementById('uploadStatus');
  if (!container) return;

  const statusEl =
    container.classList.contains('upload-status')
      ? container
      : container.querySelector('.upload-status') || container;

  statusEl.className = 'upload-status font-mono px-4 py-2 rounded-lg text-sm font-medium';
  if (type) statusEl.classList.add(type);
  statusEl.textContent = message;
  container.classList.remove('hidden');
}

/**
 * Initialize file selection input and upload action triggers.
 * @param {Object} options
 * @param {Function} options.onDataLoaded - Callback receiving { rows, source }
 */
export function initUpload({ onDataLoaded }) {
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const filenameSpan = document.getElementById('uploadFilename');

  if (!fileInput || !uploadBtn) return;

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      uploadBtn.disabled = false;
      uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      uploadBtn.classList.add(
        'hover:shadow-lg',
        'hover:shadow-sky-500/25',
        'hover:-translate-y-0.5'
      );

      if (filenameSpan) {
        filenameSpan.textContent = fileInput.files[0].name;
        filenameSpan.classList.remove('text-muted');
      }
    } else {
      uploadBtn.disabled = true;
      uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');
      uploadBtn.classList.remove(
        'hover:shadow-lg',
        'hover:shadow-sky-500/25',
        'hover:-translate-y-0.5'
      );

      if (filenameSpan) {
        filenameSpan.textContent = 'No file selected';
        filenameSpan.classList.add('text-muted');
      }
    }
  });

  uploadBtn.addEventListener('click', async function () {
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    if (!file.name.match(/\.xlsx?$/i)) {
      showUploadStatus('Please upload an .xlsx or .xls file.', 'error');
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');
    showUploadStatus(
      'Parsing Excel file (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)...',
      ''
    );

    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      showUploadStatus(
        'Processing ' +
          (arrayBuffer.byteLength / 1024 / 1024).toFixed(1) +
          ' MB of data...',
        ''
      );

      const result = parseExcelFile(arrayBuffer);

      if (typeof onDataLoaded === 'function') {
        onDataLoaded({ rows: result.rows, source: file.name });
      }

      showUploadStatus(
        '✓ Loaded ' +
          result.rows.length.toLocaleString('en-IN') +
          ' rows from ' +
          file.name,
        'success'
      );

      const emptyState = document.getElementById('emptyState');
      if (emptyState) emptyState.classList.add('hidden');

      const dashboardsGrid = document.getElementById('dashboardsGrid');
      if (dashboardsGrid) dashboardsGrid.classList.remove('hidden');
    } catch (e) {
      console.error('Upload error:', e);
      showUploadStatus('Error parsing file: ' + e.message, 'error');
      uploadBtn.disabled = false;
      uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
}
