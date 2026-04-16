import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { Env } from './index';

describe('worker', () => {
    describe('fetch handler', () => {
        it('should return a clean response', async () => {
            const response = await worker.fetch({} as Request, {} as Env, {} as any);
            expect(response.status).toBe(200);
            expect(await response.text()).toBe("Cron worker is active and running perfectly! 😊");
        });
    });

    describe('scheduled handler', () => {
        let mockWaitUntil: ReturnType<typeof vi.fn>;
        let ctx: any;

        beforeEach(() => {
            mockWaitUntil = vi.fn();
            ctx = { waitUntil: mockWaitUntil };
            global.fetch = vi.fn();
            vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should log an error if RENDER_HEALTHCHECK_URL is missing', async () => {
            const env: Env = { RENDER_HEALTHCHECK_URL: '', RENDER_WARMUP_KEY: 'test-key' };

            await worker.scheduled(null as any, env, ctx);

            expect(console.error).toHaveBeenCalledWith("Missing RENDER_HEALTHCHECK_URL in environment.");
            expect(mockWaitUntil).not.toHaveBeenCalled();
        });

        it('should log an error if response is not ok', async () => {
            const env: Env = { RENDER_HEALTHCHECK_URL: 'https://test.com', RENDER_WARMUP_KEY: 'test-key' };

            const mockResponse = {
                ok: false,
                status: 500
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            await worker.scheduled(null as any, env, ctx);

            expect(mockWaitUntil).toHaveBeenCalled();
            const promise = mockWaitUntil.mock.calls[0][0];
            await promise;

            expect(global.fetch).toHaveBeenCalledWith('https://test.com', {
                method: 'GET',
                headers: {
                    'x-warmup-key': 'test-key'
                }
            });
            expect(console.error).toHaveBeenCalledWith('Render ping failed with status: 500');
        });

        it('should log success if response is ok', async () => {
            const env: Env = { RENDER_HEALTHCHECK_URL: 'https://test.com', RENDER_WARMUP_KEY: 'test-key' };

            const mockResponse = {
                ok: true,
                status: 200
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            await worker.scheduled(null as any, env, ctx);

            expect(mockWaitUntil).toHaveBeenCalled();
            const promise = mockWaitUntil.mock.calls[0][0];
            await promise;

            expect(console.log).toHaveBeenCalledWith('Render ping successful: 200');
        });

        it('should log an error if fetch throws an exception', async () => {
            const env: Env = { RENDER_HEALTHCHECK_URL: 'https://test.com', RENDER_WARMUP_KEY: 'test-key' };

            const mockError = new Error("Network error");
            (global.fetch as any).mockRejectedValue(mockError);

            await worker.scheduled(null as any, env, ctx);

            expect(mockWaitUntil).toHaveBeenCalled();
            const promise = mockWaitUntil.mock.calls[0][0];
            await promise;

            expect(console.error).toHaveBeenCalledWith('Error pinging Render:', mockError);
        });

        it('should handle missing RENDER_WARMUP_KEY', async () => {
            const env: Env = { RENDER_HEALTHCHECK_URL: 'https://test.com', RENDER_WARMUP_KEY: '' };

            const mockResponse = {
                ok: true,
                status: 200
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            await worker.scheduled(null as any, env, ctx);

            expect(mockWaitUntil).toHaveBeenCalled();
            const promise = mockWaitUntil.mock.calls[0][0];
            await promise;

            expect(global.fetch).toHaveBeenCalledWith('https://test.com', {
                method: 'GET',
                headers: {
                    'x-warmup-key': ''
                }
            });
        });
    });
});
