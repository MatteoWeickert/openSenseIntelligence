import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import preserveDirectives from 'rollup-preserve-directives'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
	// Make .env variables available in tests
	// Might be required only because reactRouter() is disabled in test mode
	if (mode === 'test') {
		// Loads .env, .env.test, etc.
		const env = loadEnv(mode, process.cwd(), '')
		Object.assign(process.env, env)
	}

	return {
		server: {
			port: 3000,
			// Pre-transform entry files so the first request is fast
			warmup: {
				clientFiles: ['./app/entry.client.tsx', './app/root.tsx'],
				ssrFiles: ['./app/entry.server.tsx', './app/root.tsx'],
			},
		},
		plugins: [
			tailwindcss(),
			// https://github.com/remix-run/remix/issues/9871 prevents this from
			// being enabled in test mode...
			mode === 'test' ? null : reactRouter(),
			preserveDirectives(), // makes sure directives such as "use client" are present in the output bundle
		],
		// Pre-bundle deps at startup so the first browser request doesn't trigger
		// an on-the-fly re-optimization and full-page reload.
		optimizeDeps: {
			include: [
				'react',
				'react-dom',
				'react/jsx-runtime',
				'react-i18next',
				'i18next',
				'react-router',
				'@radix-ui/react-slot',
				'@radix-ui/react-toast',
				'class-variance-authority',
				'clsx',
				'i18next-browser-languagedetector',
				'i18next-http-backend',
				'lucide-react',
				'remix-i18next/client',
				'tailwind-merge',
				'tiny-invariant',
			],
		},
		test: {
			globals: true,
			environment: 'jsdom',
			setupFiles: ['./vitest.setup.ts'],
			include: ['**/*.{test,spec}.{ts,tsx}'],
			coverage: {
				reporter: ['text', 'json-summary', 'json'],
			},
			testTimeout: 10_000,
			hookTimeout: process.env.CI ? 30_000 : 10_000,
		},
		resolve: {
			tsconfigPaths: true,
		},
	}
})
