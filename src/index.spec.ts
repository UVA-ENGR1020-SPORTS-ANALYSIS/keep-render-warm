import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, { Env } from './index';

// Mock ExecutionContext
const createMockCtx = () => ({
	waitUntil: vi.fn(),
	passThroughOnException: vi.fn(),
});

describe('worker', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		globalThis.fetch = vi.fn();
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	describe('fetch', () => {
		it('returns a 200 response with success message', async () => {
			const env = {} as Env;
			const ctx = createMockCtx();
			const request = new Request('http://localhost');

			// Use type casting to handle the ExecutionContext type difference between vitest node and cloudflare workers
			const response = await worker.fetch(request, env, ctx as any);

			expect(response.status).toBe(200);
			expect(await response.text()).toBe('Cron worker is active and running perfectly! 😊');
		});
	});

	describe('scheduled', () => {
		it('should log error and return if RENDER_HEALTHCHECK_URL is missing', async () => {
			const env = { RENDER_WARMUP_KEY: 'test-key' } as Env;
			const ctx = createMockCtx();

			await worker.scheduled({} as any, env, ctx as any);

			expect(console.error).toHaveBeenCalledWith('Missing RENDER_HEALTHCHECK_URL in environment.');
			expect(ctx.waitUntil).not.toHaveBeenCalled();
		});

		it('should call fetch and waitUntil on successful ping', async () => {
			const env = {
				RENDER_HEALTHCHECK_URL: 'https://test.render.com',
				RENDER_WARMUP_KEY: 'test-key'
			};
			const ctx = createMockCtx();

			const mockResponse = { ok: true, status: 200 };
			globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

			await worker.scheduled({} as any, env, ctx as any);

			expect(console.log).toHaveBeenCalledWith('Pinging https://test.render.com...');

			// Verify fetch was called with correct arguments
			expect(globalThis.fetch).toHaveBeenCalledWith('https://test.render.com', {
				method: 'GET',
				headers: {
					'x-warmup-key': 'test-key'
				}
			});

			// Verify waitUntil was called with a Promise
			expect(ctx.waitUntil).toHaveBeenCalled();
			const waitUntilPromise = ctx.waitUntil.mock.calls[0][0];
			expect(waitUntilPromise).toBeInstanceOf(Promise);

			// Wait for the promise to resolve to check logs
			await waitUntilPromise;
			expect(console.log).toHaveBeenCalledWith('Render ping successful: 200');
		});

		it('should log error on failed ping response', async () => {
			const env = {
				RENDER_HEALTHCHECK_URL: 'https://test.render.com',
				RENDER_WARMUP_KEY: 'test-key'
			};
			const ctx = createMockCtx();

			const mockResponse = { ok: false, status: 500 };
			globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

			await worker.scheduled({} as any, env, ctx as any);

			const waitUntilPromise = ctx.waitUntil.mock.calls[0][0];
			await waitUntilPromise;

			expect(console.error).toHaveBeenCalledWith('Render ping failed with status: 500');
		});

		it('should handle missing RENDER_WARMUP_KEY correctly', async () => {
			const env = {
				RENDER_HEALTHCHECK_URL: 'https://test.render.com'
			} as Env;
			const ctx = createMockCtx();

			const mockResponse = { ok: true, status: 200 };
			globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

			await worker.scheduled({} as any, env, ctx as any);

			expect(globalThis.fetch).toHaveBeenCalledWith('https://test.render.com', {
				method: 'GET',
				headers: {
					'x-warmup-key': ''
				}
			});
		});

		it('should log error on fetch exception', async () => {
			const env = {
				RENDER_HEALTHCHECK_URL: 'https://test.render.com',
				RENDER_WARMUP_KEY: 'test-key'
			};
			const ctx = createMockCtx();

			const networkError = new Error('Network failure');
			globalThis.fetch = vi.fn().mockRejectedValue(networkError);

			await worker.scheduled({} as any, env, ctx as any);

			const waitUntilPromise = ctx.waitUntil.mock.calls[0][0];
			await waitUntilPromise;

			expect(console.error).toHaveBeenCalledWith('Error pinging Render:', networkError);
		});
	});
});
