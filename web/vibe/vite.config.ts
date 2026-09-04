import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'node:http'

function redirectBareVibePath(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
) {
    if (req.url === '/vibe' || req.url?.startsWith('/vibe?')) {
        const query = req.url.slice('/vibe'.length)
        res.statusCode = 302
        res.setHeader('Location', `/vibe/${query}`)
        res.end()
        return
    }

    next()
}

const bareVibeRedirect: Plugin = {
    name: 'redirect-bare-vibe-path',
    configureServer(server) {
        server.middlewares.use(redirectBareVibePath)
    },
    configurePreviewServer(server) {
        server.middlewares.use(redirectBareVibePath)
    },
}

// https://vitejs.dev/config/
export default defineConfig({
    // Mounted under strummer.fun/vibe — assets resolve to /vibe/assets/*.
    base: '/vibe/',
    plugins: [bareVibeRedirect, react()],
    build: {
        minify: 'esbuild',
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
})
