Node-RED Dashboard 2.0 Webcam Widget
=======================
<p align="center">
  <img src="https://github.com/sumitshinde-84/node-red-dashboard-2-ui-webcam/assets/110285294/7f1d2ee2-add5-4405-ae5e-a1b86da13a4e" alt="HOME13" width="400" />
  <img src="https://github.com/sumitshinde-84/node-red-dashboard-2-ui-webcam/assets/110285294/be25b4e6-693b-445f-aa65-3f48da7fc367" alt="FlowFuse_Flow12" width="400" />
</p>
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

The ui-webcam node offers the following functionalities:
- Live Image Display: Renders a live image feed from the device's webcam within the Dashboard 2.0 interface.
- Image Capture: Users can click a designated button to capture an image, which is then transmitted by the node as a Base64 string containing the image in PNG format.
- Automated Image Capture: If a `msg.payload` is passed to the ui-webcam node with the  `capture` string , the node automatically captures an image without requiring user interaction.
- Camera Selection: Users have the option to select a different camera by clicking on the three-dot icon located in the top-right corner and choosing their preferred camera from the options.

## Browser Support

The webcam widget is compatible with all modern browsers, except Internet Explorer. 

If you are accessing the Dashboard 2.0 remotely (not via `localhost`), then you must
use HTTPS otherwise the browser will block access to the webcam.

## Privacy

Before the webcam can be activated, the browser will ask the user's permission for
the page to access the device. The node cannot capture images until the user
has given their permission. 
