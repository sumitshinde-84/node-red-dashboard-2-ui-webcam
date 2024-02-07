/**
 * Used only for development (via `npm run dev`).
 *
 * This file is useful for testing your component in isolation from Node-RED.
 */
import { createApp } from 'vue'

import UIWebcam from './components/UIWebcam.vue'

createApp(UIWebcam).mount('#app')
