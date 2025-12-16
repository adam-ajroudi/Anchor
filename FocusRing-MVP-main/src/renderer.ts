// Declare the API exposed by preload.ts
interface ElectronAPI {
  onShowImage: (callback: (imageData: string) => void) => void;
  onShowQuote: (callback: (quote: string) => void) => void;
  onShowMetric: (callback: (data: { value: number; label: string }) => void) => void;
  onClearOverlay: (callback: () => void) => void;
  onStatusLog: (callback: (data: { message: string, type: string, timestamp: string }) => void) => void;
}

// Extend the Window interface
interface WindowWithElectron extends Window {
  electronAPI: ElectronAPI;
}

// Cast window to our extended interface
const electronWindow = window as unknown as WindowWithElectron;

// Get DOM elements
const imageContainer = document.getElementById('imageContainer');
const quoteContainer = document.getElementById('quoteContainer');
const metricContainer = document.getElementById('metricContainer');
const focusImage = document.getElementById('focusImage') as HTMLImageElement;
const quoteText = document.getElementById('quoteText');
const metricValue = document.getElementById('metricValue');
const metricLabel = document.getElementById('metricLabel');

/**
 * Hide all containers and show only the specified one
 */
function showContainer(type: 'image' | 'quote' | 'metric') {
  imageContainer?.classList.remove('active');
  quoteContainer?.classList.remove('active');
  metricContainer?.classList.remove('active');

  switch (type) {
    case 'image':
      imageContainer?.classList.add('active');
      break;
    case 'quote':
      quoteContainer?.classList.add('active');
      break;
    case 'metric':
      metricContainer?.classList.add('active');
      break;
  }
}

/**
 * Clear all content and hide all containers (prevents flash of old content)
 */
function clearAll() {
  imageContainer?.classList.remove('active');
  quoteContainer?.classList.remove('active');
  metricContainer?.classList.remove('active');

  // Clear content
  if (focusImage) focusImage.src = '';
  if (quoteText) quoteText.textContent = '';
  if (metricValue) metricValue.textContent = '';
}

// Image handler
if (focusImage) {
  console.log('✅ Overlay renderer initialized');

  focusImage.addEventListener('error', (event) => {
    console.error('❌ Error loading image:', (event.target as HTMLImageElement).src.substring(0, 100));
  });

  focusImage.addEventListener('load', () => {
    console.log('✅ Image loaded successfully!');
    console.log('Image dimensions:', focusImage.naturalWidth, 'x', focusImage.naturalHeight);
  });

  electronWindow.electronAPI.onShowImage((imageData: string) => {
    console.log('📥 Showing IMAGE anchor');
    showContainer('image');
    focusImage.src = imageData;
    focusImage.style.display = 'block';
  });
} else {
  console.error("❌ Could not find 'focusImage' element.");
}

// Quote handler
if (quoteText) {
  electronWindow.electronAPI.onShowQuote((quote: string) => {
    console.log('📥 Showing QUOTE anchor:', quote.substring(0, 50));
    showContainer('quote');
    quoteText.textContent = quote;
  });
} else {
  console.error("❌ Could not find 'quoteText' element.");
}

// Metric handler
if (metricValue && metricLabel) {
  electronWindow.electronAPI.onShowMetric((data: { value: number; label: string }) => {
    console.log('📥 Showing METRIC anchor:', data.value, data.label);
    showContainer('metric');
    metricValue.textContent = data.value.toString();
    if (data.label) {
      metricLabel.textContent = data.label;
    }
  });
} else {
  console.error("❌ Could not find metric elements.");
}

// Clear overlay handler (prevents flash of old content when showing new)
electronWindow.electronAPI.onClearOverlay(() => {
  console.log('🧹 Clearing overlay content');
  clearAll();
});

console.log('✅ Multi-modal overlay renderer ready');