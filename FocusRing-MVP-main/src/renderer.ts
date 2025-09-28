// Declare the API exposed by preload.ts
interface ElectronAPI {
  onShowImage: (callback: (imageData: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const focusImage = document.getElementById('focusImage') as HTMLImageElement;

if (focusImage) {
    console.log('Found focusImage element');
    
    // Add error listener to detect image loading issues
    focusImage.addEventListener('error', (event) => {
      console.error('Error loading image:', (event.target as HTMLImageElement).src);
    });
    
    // Add load listener to confirm image loaded successfully
    focusImage.addEventListener('load', () => {
      console.log('Image loaded successfully!');
    });

    window.electronAPI.onShowImage((imageData: string) => {
        console.log('Renderer received image data');
        // For data URLs, we can just set the src directly
        focusImage.src = imageData;
    });
} else {
    console.error("Could not find 'focusImage' element.");
}

// Add this line to ensure the file is treated as a module
export {};