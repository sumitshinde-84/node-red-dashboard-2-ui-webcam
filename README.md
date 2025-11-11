Node-RED Dashboard 2.0 Webcam Widget
=======================

![](https://github.com/sumitshinde-84/node-red-dashboard-2-ui-webcam/assets/110285294/7f1d2ee2-add5-4405-ae5e-a1b86da13a4e)
![](https://github.com/sumitshinde-84/node-red-dashboard-2-ui-webcam/assets/110285294/be25b4e6-693b-445f-aa65-3f48da7fc367) 

The Node-RED Dashboard 2.0 Webcam Widget is a UI widget node designed to facilitate image capture directly from the Dashboard 2.0 interface. This widget enables users to capture images from their device's webcam seamlessly within Node-RED.

## Installation:
Ensure that you have previously installed Dashboard 2.0 before proceeding with the installation of the ui-webcam widget.

 ***Using the Node-RED Editor***:
- Navigate to Editor > Menu > Manage Palette > Install.
- Search for @sumit_shinde_84/node-red-dashboard-2-ui-webcam and install it.

***Using Command Line:***
- Run the following command in your Node-RED user directory (typically ~/.node-red):
  ```
  npm i @sumit_shinde_84/node-red-dashboard-2-ui-webcam
  ```

## Usage

The **ui-webcam** node provides the following functionalities:

* **Live Image Display:**
  Displays a live video feed from the device’s webcam in the Dashboard 2.0 interface.

* **Image Capture:**
  Users can click a capture button to take a snapshot.
  The captured image is sent as a **Node.js Buffer** object containing JPEG binary data with the following format:

  ```json
  {
    "image": <Buffer ff d8 ff e0 00 10 4a 46 49 46 ...>,
    "captureType": "manual",
    "timestamp": "2025-08-25T14:25:05.993Z",
    "mimeType": "image/jpeg",
    "sizeBytes": 45678
  }
  ```

* **Image Size Configuration:**
  Configure image dimensions and quality to optimize WebSocket transmission:
  * **Image Width/Height**: Set capture dimensions (default: 640x480). Smaller sizes reduce data transmission.
  * **Image Quality**: JPEG quality from 0.1 to 1.0 (default: 0.8). Lower values create smaller files.

  **Important**: Dashboard 2.0 has a default WebSocket message size limit of **1MB**. Keep image dimensions reasonable to avoid disconnections. For larger images, increase `maxHttpBufferSize` in your Node-RED `settings.js`:

  ```javascript
  ui: {
      path: "/dashboard",
      dashboard: {
          maxHttpBufferSize: 1e7  // 10MB example
      }
  }
  ```

* **Automated Image Capture:**
  Sending a `msg.payload` with the string `capture` will trigger an automatic image capture without user interaction.
  The output format will also include `"captureType": "manual"` since it is equivalent to a normal capture.

* **Automated Camera Control:**
  The widget can be turned on or off programmatically by sending a `msg.payload`:

  * To **turn on** the camera: `msg.payload = "on"`
  * To **turn off** the camera: `msg.payload = "off"`

* **Camera Selection:**
  Users can select a different camera by clicking the three-dot icon in the widget and choosing from available devices.

* **Mirror Image:**
  The camera view can be mirrored horizontally using the "Mirror Image" option in the three-dot menu. Front-facing cameras (on mobile devices) are automatically mirrored for a natural viewing experience, but this can be toggled on or off manually.

* **QR Code Auto-Detection:**
  When QR Detection is enabled in the node configuration, the widget can automatically detect and capture images when a QR code appears in the camera feed.
  The captured image will include `"captureType": "qr-detection"`:

  ```json
  {
    "image": <Buffer ff d8 ff e0 00 10 4a 46 49 46 ...>,
    "captureType": "qr-detection",
    "timestamp": "2025-08-25T14:25:05.993Z",
    "mimeType": "image/jpeg",
    "sizeBytes": 45678
  }
  ```

## Browser Support

The webcam widget is compatible with all modern browsers, except Internet Explorer. 

If you are accessing the Dashboard 2.0 remotely (not via `localhost`), then you must
use HTTPS otherwise the browser will block access to the webcam.

## Privacy

Before the webcam can be activated, the browser will ask the user's permission for
the page to access the device. The node cannot capture images until the user
has given their permission.

## License

Apache-2.0 
