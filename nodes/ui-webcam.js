module.exports = function (RED) {
    function UIExampleNode (config) {
        RED.nodes.createNode(this, config)

        const node = this

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group)

        // Get the dashboard base configuration to access maxHttpBufferSize
        let maxBufferSize = 1000000 // Default 1MB fallback
        if (group && group.ui) {
            // Dashboard 2.0 stores socket.io config in the ui-base node
            const uiBase = RED.nodes.getNode(group.ui)
            if (uiBase && uiBase.socketOptions && uiBase.socketOptions.maxHttpBufferSize) {
                maxBufferSize = uiBase.socketOptions.maxHttpBufferSize
            }
        }

        const webcamConfig = {
            ...config,
            qrDetection: config.qrDetection || false,
            imageWidth: config.imageWidth || 640,
            imageHeight: config.imageHeight || 480,
            imageQuality: config.imageQuality || 0.8,
            maxBufferSize: maxBufferSize
        }

        // server-side event handlers
        const evts = {
            // Dashboard 2.0 only checks that onAction is set; it then runs beforeSend()
            // and sends the result. All processing therefore lives in beforeSend.
            onAction: true,
            beforeSend: function (msg) {
                // beforeSend also runs for messages arriving on the node's input
                // (e.g. "on"/"off"/"capture"), which pass through untouched.
                const payload = msg && msg.payload
                if (!payload || typeof payload !== 'object') {
                    return msg
                }

                try {
                    // Camera could not be started in the browser (permission, device busy, insecure context...)
                    if (payload.type === 'camera-error') {
                        node.warn(`Dashboard client could not start the camera: ${payload.message} (${payload.name})`)
                        node.status({ fill: 'red', shape: 'ring', text: payload.name })
                        return msg
                    }

                    // Image exceeded the socket.io maxHttpBufferSize limit
                    if (payload.error && payload.maxSizeBytes) {
                        const sizeInMB = (payload.sizeBytes / 1000000).toFixed(2)
                        const maxSizeMB = (payload.maxSizeBytes / 1000000).toFixed(2)

                        node.warn(
                            `Image size (${sizeInMB}MB) exceeds Dashboard 2.0 maxHttpBufferSize limit (${maxSizeMB}MB). ` +
                            'This may cause socket disconnections. ' +
                            'Solutions: ' +
                            '(1) Reduce image dimensions in node settings, ' +
                            '(2) Lower image quality. ' +
                            'See: https://dashboard.flowfuse.com/getting-started.html#max-buffer-size'
                        )
                        return msg
                    }

                    // Normalise binary image data from the client to a Buffer
                    if (payload.image) {
                        if (Array.isArray(payload.image) || payload.image instanceof ArrayBuffer || ArrayBuffer.isView(payload.image)) {
                            payload.image = Buffer.from(payload.image)
                        }
                        node.status({})
                    }
                    return msg
                } catch (err) {
                    node.error('Error processing webcam message: ' + err.message, msg)
                    return {
                        payload: {
                            error: 'Processing error',
                            message: err.message,
                            timestamp: new Date().toISOString()
                        }
                    }
                }
            },
            onInput: function (msg, send) {
                try {
                    // Handle incoming messages to control the webcam
                } catch (err) {
                    node.error('Error handling input message: ' + err.message, msg)
                }
            }
        }

        // inform the dashboard UI that we are adding this node
        if (group) {
            group.register(node, webcamConfig, evts)
        } else {
            node.error('No group configured')
        }
    }

    RED.nodes.registerType('ui-webcam', UIExampleNode)
}
