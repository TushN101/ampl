import { store } from './state/store.js';
import { alertRegistry } from './alerts/alertRegistry.js';
import { DEFAULT_ALERTS } from './alerts/alertDefinitions.js';
import { searchService } from './services/searchService.js';
import { initTheme } from './ui/themeManager.js';
import { initModal, openModal } from './ui/modalComponent.js';
import { renderSummary } from './ui/summaryComponent.js';
import { initSearch } from './ui/searchComponent.js';
import {
  buildDashboardCards,
  renderAlert,
  renderAllAlerts,
} from './ui/cardsComponent.js';
import { initUpload, showUploadStatus } from './ui/uploadComponent.js';

/**
 * Main application bootstrap function.
 */
function init() {
  console.log('[SOQ Dashboard] Initializing client-side application...');

  // Initialize alert rules
  alertRegistry.registerAll(DEFAULT_ALERTS);

  // Initialize theme
  initTheme();

  // Initialize detail modal listeners
  initModal();

  // Build alert cards grid
  buildDashboardCards({
    registry: alertRegistry,
    onThresholdChange: (alertId) => {
      renderAlert({
        alertId,
        registry: alertRegistry,
        data: store.getData(),
        onItemClick: openModal,
      });
    },
  });

  // Initialize search component
  initSearch({
    searchService,
    getData: () => store.getData(),
    onSelectResult: openModal,
  });

  // Initialize upload component
  initUpload({
    onDataLoaded: ({ rows, source }) => {
      store.setData(rows, source);
    },
  });

  // Subscribe UI updates to store changes
  store.subscribe(({ data, dataSource }) => {
    searchService.init(data);
    renderSummary(data, dataSource);
    renderAllAlerts({
      registry: alertRegistry,
      data,
      onItemClick: openModal,
    });
  });

  // Verify external library dependencies
  if (typeof XLSX === 'undefined') {
    console.error('[SOQ Dashboard] ERROR: SheetJS (XLSX) library not loaded!');
    showUploadStatus(
      'Error: Excel library failed to load. Please refresh the page.',
      'error'
    );
    return;
  }

  if (typeof Fuse === 'undefined') {
    console.warn(
      '[SOQ Dashboard] WARNING: Fuse.js not loaded. Fuzzy search will be limited.'
    );
  }

  console.log('[SOQ Dashboard] Ready! Waiting for file upload.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
