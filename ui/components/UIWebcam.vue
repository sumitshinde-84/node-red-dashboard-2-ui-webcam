<template>
    <div class="ui-webcam-wrapper">
        <div class="video-wrapper">
            <video ref="video" width="100%" height="100%" playsinline webkit-playsinline muted />
            <canvas ref="canvas" class="canvas" />
            <button v-if="cameraIsOn === false" class="button power-button" @click="startWebcam">
                <img class="icon" src="../assets/camera-on.png" height="30px" width="30px" alt="Capture Image" @click="startWebcam">
            </button>
            <button v-if="cameraIsOn" class="button capture-button" @click="captureImage">
                <img class="icon" src="../assets/camera-icon.png" height="25px" width="25px" alt="Capture Image">
            </button>
            <div v-if="cameraIsOn" class="ellipsis" @click="toggleDropdown">
                <span />
                <span />
                <span />
            </div>
        </div>
        <div v-if="cameraIsOn" class="dropdown" :class="{ 'open': dropdownOpen }">
            <ul>
                <li @click="selectCamera('off')">Turn Camera Off</li>
                <li class="group-label">Select camera</li>
                <li v-for="device in cameraDevices" :key="device.deviceId" @click="selectCamera(device.deviceId)">{{ device.label }}</li>
            </ul>
        </div>
    </div>
</template>

<script>
import { mapState } from 'vuex'
import jsQR from 'jsqr'

export default {
    name: 'UIWebcam',
    inject: ['$socket'],
    props: {
        id: { type: String, required: true },
        props: { type: Object, default: () => ({}) },
        state: { type: Object, default: () => ({ enabled: false, visible: false }) }
    },
    data () {
        return {
            imageData: null,
            cameraDevices: [],
            selectedDevice: null,
            cameraIsOn: false,
            dropdownOpen: false,
            scanningInterval: null,
            lastQRCode: null,
            qrDetectionEnabled: true
        }
    },
    computed: {
        ...mapState('data', ['messages']),
        value: {
            get () {
                return this.messages[this.id]?.payload
            }
        }
    },
    mounted () {
    this.$socket.on('msg-input:' + this.id, async (msg) => {
        if (msg.payload === 'capture') {
            if (!this.cameraIsOn) {
                await this.startWebcam()
            }
            await this.captureImage()
        } else if (msg.payload === 'on') {
            await this.startWebcam()
        } else if (msg.payload === 'off') {
            this.stopWebcam()
        }
    })
    },
    beforeUnmount () {
        this.$socket?.off('widget-load:' + this.id)
        this.$socket?.off('msg-input:' + this.id)
        this.stopWebcam()
    },
    methods: {

        async startWebcam () {
            if (!this.cameraIsOn) {
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices()
                    const videoDevices = devices.filter(device => device.kind === 'videoinput')

                    if (videoDevices.length > 0) {
                        this.cameraDevices = videoDevices
                        this.selectedDevice = videoDevices[0].deviceId // Select the first camera by default
                        await this.openCamera()
                    } else {
                        console.error('No video input devices found.')
                    }
                } catch (error) {
                    console.error('Error accessing media devices:', error)
                }
            }
        },
        async openCamera () {
            if (this.selectedDevice === 'off') {
                this.stopWebcam()
                this.cameraIsOn = false
            } else {
                const video = this.$refs.video
                const constraints = { video: { deviceId: this.selectedDevice } }

                try {
                    const stream = await navigator.mediaDevices.getUserMedia(constraints)

                    if (video && video instanceof HTMLVideoElement) {
                        video.srcObject = stream
                        await video.play()
                        this.cameraIsOn = true
                        // Start QR scanning once video is ready
                        if (video.readyState >= video.HAVE_METADATA) {
                            // Video is already ready, start scanning immediately
                            this.startQRScanning()
                        } else {
                            // Wait for video to be ready before starting QR scanning
                            video.addEventListener('loadedmetadata', () => {
                                this.startQRScanning()
                            }, { once: true })
                        }
                    } else {
                        console.error('Video element not found or not an instance of HTMLVideoElement.')
                    }
                } catch (error) {
                    console.error('Error accessing webcam:', error)
                }
            }
        },
        stopWebcam () {
            const video = this.$refs.video
            if (video && video.srcObject) {
                const tracks = video.srcObject.getTracks()
                tracks.forEach(track => track.stop())
                video.srcObject = null
            }
            this.cameraIsOn = false
            this.stopQRScanning()
        },
        captureImage (isQRDetection = false) {
            const video = this.$refs.video
            const canvas = this.$refs.canvas
            const context = canvas.getContext('2d')

            if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
                // Set canvas size to match the video size
                const videoWidth = video.videoWidth
                const videoHeight = video.videoHeight
                canvas.width = videoWidth
                canvas.height = videoHeight

                context.drawImage(video, 0, 0, videoWidth, videoHeight)

                this.imageData = canvas.toDataURL('image/png')

                // Send image with capture type
                const payload = {
                    image: this.imageData,
                    captureType: isQRDetection ? 'qr-detection' : 'manual',
                    timestamp: new Date().toISOString()
                }

                this.send(payload)

                // Display the captured image for 0.5 seconds
                setTimeout(() => {
                    context.clearRect(0, 0, videoWidth, videoHeight)
                }, 500)
            } else {
                console.error('Video element not ready or not found.')
            }
        },
        send (msg) {
            this.$socket.emit('widget-action', this.id, {
                payload: msg
            })
        },
        async changeCamera () {
            this.stopWebcam()
            await this.openCamera()
        },
        toggleDropdown () {
            this.dropdownOpen = !this.dropdownOpen
        },
        selectCamera (deviceId) {
            this.selectedDevice = deviceId
            this.toggleDropdown()
            if (deviceId === 'off') {
                this.stopWebcam()
            } else {
                this.changeCamera()
            }
        },
        startQRScanning () {
            console.log('Starting QR scanning...')
            if (this.scanningInterval) {
                clearInterval(this.scanningInterval)
            }
            
            // Scan every 250ms instead of 100ms to reduce CPU load
            this.scanningInterval = setInterval(() => {
                this.scanForQRCode()
            }, 250)
            console.log('QR scanning interval started')
        },
        stopQRScanning () {
            if (this.scanningInterval) {
                clearInterval(this.scanningInterval)
                this.scanningInterval = null
            }
        },
        scanForQRCode () {
            if (!this.qrDetectionEnabled || !this.cameraIsOn) {
                console.log('Scanning skipped - QR detection:', this.qrDetectionEnabled, 'Camera on:', this.cameraIsOn)
                return
            }
            
            try {
                const video = this.$refs.video
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')
                
                if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth
                    canvas.height = video.videoHeight
                    context.drawImage(video, 0, 0, canvas.width, canvas.height)
                    
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
                    const code = jsQR(imageData.data, imageData.width, imageData.height)
                    
                    if (code && code.data) {
                        console.log('QR Code found:', code.data, 'Last QR:', this.lastQRCode)
                        if (code.data !== this.lastQRCode) {
                            this.lastQRCode = code.data
                            console.log('QR Code detected, capturing image')
                            // Capture image when QR code is detected (pass true for QR detection)
                            this.captureImage(true)
                            
                            setTimeout(() => {
                                console.log('Resetting QR code cooldown')
                                this.lastQRCode = null
                            }, 2000)
                        }
                    }
                } else {
                    console.log('Video not ready for scanning')
                }
            } catch (error) {
                console.error('Error scanning for QR code:', error)
            }
        }
    }
}
</script>

<style scoped>
.ui-webcam-wrapper {
    position: relative;
    border-radius: 5px;
    box-shadow: rgba(0, 0, 0, 0.9) 0px 2px 4px;
}

.video-wrapper {
    background: black;
    width: auto;
    height: 100%;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
}

.canvas {
    z-index: 1;
    position: absolute;
    width: 100%;
    height: 100%;
}

.button {
    position: absolute;
    margin-left: auto;
    width: 35px;
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    right: auto;
    background: rgb(255, 255, 255);
    border: none;
    padding: 10px;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px;
}

.dropdown ul li.group-label {
    padding: 5px 10px;
    cursor: default;
    font-weight: bold;
    color: #555;
    font-size: 0.75rem;
    display: flex;
    position: relative;
    white-space: nowrap;
    gap: 12px;
    background-color: rgb(var(--v-theme-background));
}

.dropdown ul li.group-label:after {
    content:" ";
    display: block;
    height: 2px;
    flex-grow: 1;
    width: 100%;
    margin-top: 9px;
    background: rgb(var(--v-theme-group-outline));
}

.dropdown ul li.group-label:hover {
    background-color: white;
    padding: 5px 10px;
    cursor: default;
    font-weight: bold;
    color: #555;
}

.icon .capture-button{
    width: 30px;
    height: 30px;
}

.button:hover {
    background-color: rgb(var(--v-theme-primary));
}

.capture-button {
    margin-top: 60%;
}

.ellipsis {
    position: absolute;
    left: 10px;
    top: 10px;
    cursor: pointer;
    z-index: 2;
    padding: 5px;
    box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px;
}

.ellipsis span {
    display: block;
    width: 4px;
    height: 4px;
    background-color: #fff;
    border-radius: 50%;
    margin-bottom: 3px;
}

.dropdown {
    position: absolute;
    top: 40px;
    right: 10px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 5px;
    z-index: 2;
    display: none;
}

.dropdown ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.dropdown ul li {
    padding: 5px 10px;
    cursor: pointer;
}

.dropdown ul li:hover {
    background-color: rgb(var(--v-theme-primary));
    color:white;
}

.dropdown.open {
    display: block;
}
</style>