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
            onAction: function (conn, id, msg, send, done) {
                try {
                    // Check if this is an error message about API limit exceeded
                    if (msg.payload && msg.payload.error) {
                        const sizeInMB = (msg.payload.sizeBytes / 1000000).toFixed(2)
                        const maxSizeMB = (msg.payload.maxSizeBytes / 1000000).toFixed(2)

                        node.warn(
                            `Image size (${sizeInMB}MB) exceeds Dashboard 2.0 maxHttpBufferSize limit (${maxSizeMB}MB). ` +
                            'This may cause socket disconnections. ' +
                            'Solutions: ' +
                            '(1) Reduce image dimensions in node settings, ' +
                            '(2) Lower image quality. ' +
                            'See: https://dashboard.flowfuse.com/getting-started.html#max-buffer-size'
                        )

                        // Send the error message to the output so users can handle it in their flow
                        send(msg)
                        return
                    }

                    // Handle binary image data from client
                    if (msg.payload && msg.payload.image) {
                        if (Array.isArray(msg.payload.image)) {
                            msg.payload.image = Buffer.from(msg.payload.image)
                        } else if (msg.payload.image instanceof ArrayBuffer || ArrayBuffer.isView(msg.payload.image)) {
                            msg.payload.image = Buffer.from(msg.payload.image)
                        }
                    }
                    // Send the message to the output
                    send(msg)
                } catch (err) {
                    // Log error but don't crash Node-RED
                    node.error('Error processing webcam message: ' + err.message, msg)
                    // Send error message to output for flow handling
                    send({
                        payload: {
                            error: 'Processing error',
                            message: err.message,
                            timestamp: new Date().toISOString()
                        }
                    })
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
