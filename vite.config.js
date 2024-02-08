import { resolve } from 'path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'


const LIBRARY_NAME = 'ui-webcam'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue(), cssInjectedByJsPlugin()],
    build: {

        minify: process.env.NODE_ENV !== 'development',

        lib: {
            entry: resolve(__dirname, 'ui/index.js'),
            name: LIBRARY_NAME,
            formats: ['umd'],
            fileName: (format, entryName) => `${LIBRARY_NAME}.${format}.js`
        },

        outDir: './resources',

        rollupOptions: {

            external: ['vue', 'vuex'],
            output: {
               
                globals: {
                    vue: 'Vue',
                    vuex: 'vuex'
                }
            }
        }
    }
})
