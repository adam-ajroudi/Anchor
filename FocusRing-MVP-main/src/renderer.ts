// Declare the API exposed by preload.ts
interface ElectronAPI {
  onShowImage: (callback: (imageData: string) => void) => void;
  onStatusLog: (callback: (data: { message: string, type: string, timestamp: string }) => void) => void;
}

// Extend the Window interface
interface WindowWithElectron extends Window {
  electronAPI: ElectronAPI;
}

// Cast window to our extended interface using 'unknown' for type safety
// This is a safe type assertion since preload.ts adds electronAPI to window
const electronWindow = window as unknown as WindowWithElectron;

const focusImage = document.getElementById('focusImage') as HTMLImageElement;

if (focusImage) {
    console.log('✅ Found focusImage element');
    console.log('Current image dimensions:', focusImage.width, 'x', focusImage.height);
    
    // Add error listener to detect image loading issues
    focusImage.addEventListener('error', (event) => {
      console.error('❌ Error loading image:', (event.target as HTMLImageElement).src.substring(0, 100));
    });
    
    // Add load listener to confirm image loaded successfully
    focusImage.addEventListener('load', () => {
      console.log('✅ Image loaded successfully!');
      console.log('Image dimensions:', focusImage.naturalWidth, 'x', focusImage.naturalHeight);
      console.log('Display size:', focusImage.width, 'x', focusImage.height);
    });

    electronWindow.electronAPI.onShowImage((imageData: string) => {
        console.log('📥 Renderer received image data (length:', imageData.length, 'bytes)');
        console.log('Data URL prefix:', imageData.substring(0, 50));
        
        // Set the image source to the data URL
        focusImage.src = imageData;
        
        // Make sure the image is visible
        focusImage.style.display = 'block';
        console.log('✅ Image src set, waiting for load event...');
    });
} else {
    console.error("❌ Could not find 'focusImage' element.");
}