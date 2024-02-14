module.exports = function (RED) {
    function UIExampleNode (config) {
        RED.nodes.createNode(this, config)

        const node = this

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group)

        // server-side event handlers
        const evts = {
            onAction: true,
            onInput: function (msg, send, done) {
                node.passthru = false
            }

        }

        // inform the dashboard UI that we are adding this node
        if (group) {
            group.register(node, config, evts)
        } else {
            node.error('No group configured')
        }
    }

    RED.nodes.registerType('ui-webcam', UIExampleNode)
}
