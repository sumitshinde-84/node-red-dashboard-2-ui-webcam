<template>
    <div class="ui-webcam-wrapper">
      <div style="background:black;min-height: 100%; width:100%; display: flex; align-items: center; justify-content: center; position: relative;">
        <video width="100%" height="100%" ref="video" playsinline webkit-playsinline muted></video>
        <canvas style="z-index: 1; position: absolute; width: 100%; height: 100%;" ref="canvas"></canvas>
        <button v-if="cameraIsOn==false"  style="
        position: absolute;
      margin-left: auto;
      z-index: 2;
      right: auto;
      background: rgb(255, 255, 255);
      border: none;
      padding: 10px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px;" @click="captureImage">
        <img @click="startWebcam" src="https://www.freepnglogos.com/uploads/camera-logo-png/camera-symbol-icon-25.png" height="20" width="20" alt="Capture Image">
      </button>
      <button v-if="cameraIsOn" style="
        position: absolute;
      margin-left: auto;
      z-index: 2;
      margin-top:60%;
      right: auto;
      background: rgb(255, 255, 255);
      border: none;
      padding: 10px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px;" @click="captureImage">
        <img @click="captureImage" src="https://www.freepnglogos.com/uploads/camera-logo-png/camera-symbol-icon-25.png" height="20" width="20" alt="Capture Image">
      </button>
      </div>
        <select v-if="cameraDevices.length > 1" v-model="selectedDevice" @change="changeCamera">
          <option v-for="device in cameraDevices" :key="device.deviceId" :value="device.deviceId">{{ device.label }}</option>
          <option value="off">Off Camera</option>
        </select>
    </div>
  </template>
  
  <script>
  import { mapState } from 'vuex';
  
  export default {
    name: 'UIWebcam',
    inject: ['$socket'],
    props: {
      id: { type: String, required: true },
      props: { type: Object, default: () => ({}) },
      state: { type: Object, default: () => ({ enabled: false, visible: false }) }
    },
    data() {
      return {
        imageData: null,
        cameraDevices: [],
        selectedDevice: null,
        cameraIsOn:false
      };
    },
    computed: {
      ...mapState('data', ['messages']),
    },
    methods: {
      async startWebcam() {
        
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
  
          if (videoDevices.length > 0) {
            this.cameraIsOn=true;
            this.cameraDevices = videoDevices;
            this.selectedDevice = videoDevices[0].deviceId; // Select the first camera by default
            await this.openCamera();
          } else {
            console.error('No video input devices found.');
          }
        } catch (error) {
          console.error('Error accessing media devices:', error);
        }
      },
      async openCamera() {
  
        if (this.selectedDevice === 'off') {
          this.stopWebcam();
          this.cameraIsOn = false;
        }else{
        const video = this.$refs.video;
        const constraints = { video: { deviceId: this.selectedDevice } };
  
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          
          if (video && video instanceof HTMLVideoElement) {
            video.srcObject = stream;
            video.play();
          } else {
            console.error('Video element not found or not an instance of HTMLVideoElement.');
          }
        } catch (error) {
          console.error('Error accessing webcam:', error);
        }}
      },
      
      stopWebcam() {
        const tracks = this.$refs.video.srcObject?.getTracks();
        if (tracks) {
          tracks.forEach(track => track.stop());
        }
      },
      captureImage() {
        const video = this.$refs.video;
        const canvas = this.$refs.canvas;
        const context = canvas.getContext('2d');
  
        if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
          // Set canvas size to match the video size
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;
          canvas.width = videoWidth;
          canvas.height = videoHeight;
  
          context.drawImage(video, 0, 0, videoWidth, videoHeight);
  
          this.imageData = canvas.toDataURL('image/png');
  
          this.send(this.imageData);
  
          // Display the captured image for 0.5 seconds
          setTimeout(() => {
            context.clearRect(0, 0, videoWidth, videoHeight);
          }, 500);
        } else {
          console.error('Video element not ready or not found.');
        }
      },
      send(msg) {
        this.$socket.emit('widget-action', this.id, {
          payload: msg
        });
      },
      async changeCamera() {
        this.stopWebcam();
        await this.openCamera();
      },
    },
    mounted() {
    },
    beforeUnmount() {
      this.$socket?.off('widget-load:' + this.id);
      this.$socket?.off('msg-input:' + this.id);
      this.stopWebcam();
    },
  };
  </script>
  
  