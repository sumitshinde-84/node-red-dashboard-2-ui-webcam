<template>
    <div class="ui-webcam-wrapper">
        <div class="video-wrapper" :class="{ 'mirrored': shouldMirror }">
            <video ref="video" width="100%" height="100%" playsinline webkit-playsinline muted />
            <canvas ref="canvas" class="canvas" />
            <button v-if="cameraIsOn === false" class="button power-button" @click="startWebcam">
                <img class="icon" src="../assets/camera-on.png" height="30px" width="30px" alt="Capture Image" @click="startWebcam">
            </button>
            <button v-if="cameraIsOn" class="button capture-button" @click="captureImage(false)">
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
                <li @click="toggleMirror">
                    {{ manualMirror ? '✓ Mirror Image' : 'Mirror Image' }}
                </li>
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
            isFrontCamera: true,
            manualMirror: false,
            errorMessage: null
        }
    },
    computed: {
        ...mapState('data', ['messages']),
        value: {
            get () {
                return this.messages[this.id]?.payload
            }
        },
        qrDetectionEnabled () {
            return this.props.qrDetection || false
        },
        imageWidth () {
            return this.props.imageWidth || 640
        },
        imageHeight () {
            return this.props.imageHeight || 480
        },
        imageQuality () {
            return this.props.imageQuality || 0.8
        },
        maxBufferSize () {
            // Use the Dashboard 2.0 configured buffer size, default to 1MB
            return this.props.maxBufferSize || 1000000
        },
        shouldMirror () {
            // Manual mirror setting takes precedence
            return this.manualMirror || (this.isFrontCamera && !this.manualMirror)
        }
    },
    mounted () {
        try {
            if (!this.$socket) {
                console.error('[ui-webcam] Socket not available in mounted')
                return
            }
            this.$socket.on('msg-input:' + this.id, async (msg) => {
                try {
                    if (msg.payload === 'capture') {
                        if (!this.cameraIsOn) {
                            await this.startWebcam()
                        }
                        // Explicitly pass false to mark as manual capture
                        await this.captureImage(false)
                    } else if (msg.payload === 'on') {
                        await this.startWebcam()
                    } else if (msg.payload === 'off') {
                        this.stopWebcam()
                    }
                } catch (err) {
                    console.error('[ui-webcam] Error handling message input:', err)
                    this.send({
                        error: 'Message handling error',
                        message: err.message,
                        timestamp: new Date().toISOString()
                    })
                }
            })
        } catch (err) {
            console.error('[ui-webcam] Error in mounted hook:', err)
        }
    },
    beforeUnmount () {
        try {
            this.$socket?.off('widget-load:' + this.id)
            this.$socket?.off('msg-input:' + this.id)
            this.stopWebcam()
        } catch (err) {
            console.error('[ui-webcam] Error in beforeUnmount hook:', err)
        }
    },
    methods: {

        async startWebcam () {
            if (!this.cameraIsOn) {
                try {
                    // First, request permission by opening any camera
                    // This is required to get proper device labels
                    const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true })

                    // Stop the permission stream immediately
                    permissionStream.getTracks().forEach(track => track.stop())

                    // NOW enumerate devices - labels will be available after permission granted
                    const devices = await navigator.mediaDevices.enumerateDevices()
                    const videoDevices = devices.filter(device => device.kind === 'videoinput')

                    if (videoDevices.length > 0) {
                        this.cameraDevices = videoDevices
                        this.selectedDevice = videoDevices[0].deviceId // Select the first camera by default
                        await this.openCamera()
                    } else {
                        console.error('[ui-webcam] No video input devices found.')
                    }
                } catch (error) {
                    console.error('[ui-webcam] Error accessing media devices:', error)
                }
            }
        },
        async openCamera () {
            if (this.selectedDevice === 'off') {
                this.stopWebcam()
                this.cameraIsOn = false
            } else {
                const video = this.$refs.video

                // Stop existing stream before requesting new one
                if (video && video.srcObject) {
                    const tracks = video.srcObject.getTracks()
                    tracks.forEach(track => track.stop())
                    video.srcObject = null
                }

                // Try exact constraint first, then fallback to ideal
                let stream = null
                let constraints = null

                if (this.selectedDevice) {
                    // First attempt: exact constraint
                    constraints = {
                        video: {
                            deviceId: { exact: this.selectedDevice }
                        }
                    }
                } else {
                    // No specific device selected, use any available
                    constraints = { video: true }
                }

                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints)
                } catch (error) {
                    console.error('[ui-webcam] Error accessing webcam:', error)

                    // If exact constraint fails, try with ideal constraint
                    if ((error.name === 'OverconstrainedError' || error.name === 'NotFoundError') && this.selectedDevice) {
                        console.warn('[ui-webcam] Exact device constraint failed, trying ideal constraint')
                        try {
                            const idealConstraints = {
                                video: {
                                    deviceId: { ideal: this.selectedDevice }
                                }
                            }
                            stream = await navigator.mediaDevices.getUserMedia(idealConstraints)
                        } catch (idealError) {
                            console.warn('[ui-webcam] Ideal constraint failed, using any available camera')
                            // Last resort: any available camera
                            try {
                                stream = await navigator.mediaDevices.getUserMedia({ video: true })
                            } catch (fallbackError) {
                                console.error('[ui-webcam] All camera access attempts failed:', fallbackError)
                                return
                            }
                        }
                    } else {
                        // Not a device constraint error, or no fallback possible
                        return
                    }
                }

                // At this point we should have a stream (from initial try or fallback)
                if (!stream) {
                    console.error('[ui-webcam] No stream available')
                    return
                }

                // Check camera facing mode
                const videoTracks = stream.getVideoTracks()
                if (videoTracks.length > 0) {
                    const track = videoTracks[0]
                    const settings = track.getSettings()
                    // Only auto-detect on mobile devices, not desktop/USB cameras
                    const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent)
                    this.isFrontCamera = isMobile && settings.facingMode !== 'environment'
                }

                if (video && video instanceof HTMLVideoElement) {
                    video.srcObject = stream
                    await video.play()
                    this.cameraIsOn = true
                    // Start QR scanning once video is ready (only if enabled)
                    if (this.qrDetectionEnabled) {
                        if (video.readyState >= video.HAVE_METADATA) {
                            // Video is already ready, start scanning immediately
                            this.startQRScanning()
                        } else {
                            // Wait for video to be ready before starting QR scanning
                            video.addEventListener('loadedmetadata', () => {
                                this.startQRScanning()
                            }, { once: true })
                        }
                    }
                } else {
                    console.error('[ui-webcam] Video element not found or not an instance of HTMLVideoElement.')
                    // Clean up stream if we can't use it
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop())
                    }
                }
            }
        },
        stopWebcam () {
            try {
                const video = this.$refs.video
                if (video && video.srcObject) {
                    const tracks = video.srcObject.getTracks()
                    tracks.forEach(track => {
                        try {
                            track.stop()
                        } catch (err) {
                            console.error('[ui-webcam] Error stopping track:', err)
                        }
                    })
                    video.srcObject = null
                }
                this.cameraIsOn = false
                this.stopQRScanning()
            } catch (err) {
                console.error('[ui-webcam] Error stopping webcam:', err)
                // Ensure camera state is reset even if error occurs
                this.cameraIsOn = false
            }
        },
        captureImage (isQRDetection = false) {
            try {
                const video = this.$refs.video
                const canvas = this.$refs.canvas

                if (!video || !canvas) {
                    console.error('[ui-webcam] Video or canvas element not found.')
                    return
                }

                const context = canvas.getContext('2d')
                if (!context) {
                    console.error('[ui-webcam] Failed to get canvas context.')
                    return
                }

                if (video.readyState !== video.HAVE_ENOUGH_DATA) {
                    console.error('[ui-webcam] Video element not ready.')
                    return
                }

                // Use configured dimensions instead of full video size
                const targetWidth = this.imageWidth
                const targetHeight = this.imageHeight

                canvas.width = targetWidth
                canvas.height = targetHeight

                // Draw the video frame scaled to target dimensions
                context.drawImage(video, 0, 0, targetWidth, targetHeight)

                canvas.toBlob(async (blob) => {
                    try {
                        if (!blob) {
                            console.error('[ui-webcam] Failed to create image blob')
                            return
                        }

                        // Check size against Dashboard 2.0 configured limit
                        const sizeInBytes = blob.size
                        const sizeInMB = (sizeInBytes / 1000000).toFixed(2)
                        const maxSizeBytes = this.maxBufferSize
                        const maxSizeMB = (maxSizeBytes / 1000000).toFixed(2)

                        if (sizeInBytes > maxSizeBytes) {
                            const errorMsg = `[ui-webcam] Image size (${sizeInMB}MB) exceeds Dashboard 2.0 limit (${maxSizeMB}MB). ` +
                                'This may cause disconnections. ' +
                                'Solutions:\n' +
                                `  1. Reduce image dimensions (current: ${targetWidth}x${targetHeight})\n` +
                                `  2. Lower image quality (current: ${this.imageQuality})\n` +
                                '  See: https://dashboard.flowfuse.com/getting-started.html#max-buffer-size'
                            console.error(errorMsg)

                            // Still send but warn user
                            this.send({
                                error: 'Image size exceeds recommended limit',
                                sizeBytes: sizeInBytes,
                                maxSizeBytes: maxSizeBytes,
                                timestamp: new Date().toISOString()
                            })
                            return
                        }

                        // Convert blob to ArrayBuffer for transmission
                        const imageBuffer = await blob.arrayBuffer()

                        // Send binary image with metadata
                        const payload = {
                            image: imageBuffer,
                            captureType: isQRDetection ? 'qr-detection' : 'manual',
                            timestamp: new Date().toISOString(),
                            mimeType: blob.type,
                            sizeBytes: sizeInBytes
                        }

                        this.send(payload)

                        // Display the captured image for 0.5 seconds
                        setTimeout(() => {
                            context.clearRect(0, 0, targetWidth, targetHeight)
                        }, 500)
                    } catch (err) {
                        console.error('[ui-webcam] Error processing captured image:', err)
                        this.send({
                            error: 'Image processing error',
                            message: err.message,
                            timestamp: new Date().toISOString()
                        })
                    }
                }, 'image/jpeg', this.imageQuality)
            } catch (err) {
                console.error('[ui-webcam] Error capturing image:', err)
                this.send({
                    error: 'Image capture error',
                    message: err.message,
                    timestamp: new Date().toISOString()
                })
            }
        },
        send (msg) {
            try {
                if (!this.$socket) {
                    console.error('[ui-webcam] Socket not available')
                    return
                }
                this.$socket.emit('widget-action', this.id, {
                    payload: msg
                })
            } catch (err) {
                console.error('[ui-webcam] Error sending message:', err)
            }
        },
        async changeCamera () {
            try {
                this.stopWebcam()
                await this.openCamera()
            } catch (err) {
                console.error('[ui-webcam] Error changing camera:', err)
            }
        },
        toggleDropdown () {
            this.dropdownOpen = !this.dropdownOpen
        },
        async selectCamera (deviceId) {
            try {
                this.selectedDevice = deviceId
                this.toggleDropdown()
                if (deviceId === 'off') {
                    this.stopWebcam()
                } else {
                    await this.changeCamera()
                }
            } catch (err) {
                console.error('[ui-webcam] Error selecting camera:', err)
            }
        },
        toggleMirror () {
            this.manualMirror = !this.manualMirror
            this.toggleDropdown()
        },
        startQRScanning () {
            try {
                if (this.scanningInterval) {
                    clearInterval(this.scanningInterval)
                }

                // Scan every 250ms instead of 100ms to reduce CPU load
                this.scanningInterval = setInterval(() => {
                    this.scanForQRCode()
                }, 250)
            } catch (err) {
                console.error('[ui-webcam] Error starting QR scanning:', err)
            }
        },
        stopQRScanning () {
            try {
                if (this.scanningInterval) {
                    clearInterval(this.scanningInterval)
                    this.scanningInterval = null
                }
            } catch (err) {
                console.error('[ui-webcam] Error stopping QR scanning:', err)
            }
        },
        scanForQRCode () {
            if (!this.cameraIsOn) {
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
                        if (code.data !== this.lastQRCode) {
                            this.lastQRCode = code.data
                            // Capture image when QR code is detected (pass true for QR detection)
                            this.captureImage(true)

                            setTimeout(() => {
                                this.lastQRCode = null
                            }, 2000)
                        }
                    }
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
}

.video-wrapper.mirrored {
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
    right: 10px;
    top: 10px;
    cursor: pointer;
    z-index: 2;
    padding: 5px;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 4px;
    box-shadow: rgba(0, 0, 0, 0.3) 0px 2px 4px;
}

/* Counter-mirror the ellipsis when video is mirrored */
.video-wrapper.mirrored .ellipsis {
    transform: scaleX(-1);
}

/* Counter-mirror the buttons when video is mirrored */
.video-wrapper.mirrored .button {
    transform: scaleX(-1);
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
    top: 45px;
    right: 10px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 5px;
    z-index: 3;
    display: none;
    min-width: 200px;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: rgba(0, 0, 0, 0.2) 0px 4px 8px;
}

.dropdown ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.dropdown ul li {
    padding: 10px 15px;
    cursor: pointer;
    white-space: nowrap;
    font-size: 14px;
}

.dropdown ul li:hover {
    background-color: rgb(var(--v-theme-primary));
    color:white;
}

.dropdown.open {
    display: block;
}
</style>