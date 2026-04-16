import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from './index';
import { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';

describe('Cloudflare Worker', () => {
    let mockCtx: ExecutionContext;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockCtx = {
            waitUntil: vi.fn(),
            passThroughOnException: vi.fn(),
        } as unknown as ExecutionContext;
        vi.stubGlobal('fetch', vi.fn());
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetch handler', () => {
        it('should return 200 OK with correct message', async () => {
            const request = new Request('http://localhost');
            const env = { RENDER_HEALTHCHECK_URL: 'https://test.com', RENDER_WARMUP_KEY: 'secret' };

            const response = await worker.fetch(request, env, mockCtx);

            expect(response.status).toBe(200);
            expect(await response.text()).toBe("Cron worker is active and running perfectly! 😊");
        });
    });

    describe('scheduled handler', () => {
        it('should log error and exit early if RENDER_HEALTHCHECK_URL is missing', async () => {
            const event = { cron: '* * * * *', type: 'scheduled', scheduledTime: Date.now() } as ScheduledEvent;
            const env = { RENDER_HEALTHCHECK_URL: '', RENDER_WARMUP_KEY: '' };

            await worker.scheduled(event, env, mockCtx);

            expect(consoleErrorSpy).toHaveBeenCalledWith("Missing RENDER_HEALTHCHECK_URL in environment.");
            expect(mockCtx.waitUntil).not.toHaveBeenCalled();
        });

        it('should successfully ping the URL when provided', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('OK', { status: 200 }));

            const event = { cron: '* * * * *', type: 'scheduled', scheduledTime: Date.now() } as ScheduledEvent;
            const env = { RENDER_HEALTHCHECK_URL: 'https://test.render.com', RENDER_WARMUP_KEY: 'my-secret' };

            await worker.scheduled(event, env, mockCtx);

            expect(mockCtx.waitUntil).toHaveBeenCalled();

            // Wait for the waitUntil promise to resolve
            const waitUntilPromise = (mockCtx.waitUntil as any).mock.calls[0][0];
            await waitUntilPromise;

            expect(fetchSpy).toHaveBeenCalledWith('https://test.render.com', {
                method: 'GET',
                headers: {
                    'x-warmup-key': 'my-secret'
                }
            });
            expect(consoleLogSpy).toHaveBeenCalledWith('Pinging https://test.render.com...');
            expect(consoleLogSpy).toHaveBeenCalledWith('Render ping successful: 200');
        });

        it('should handle non-200 responses correctly', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Error', { status: 500 }));

            const event = { cron: '* * * * *', type: 'scheduled', scheduledTime: Date.now() } as ScheduledEvent;
            const env = { RENDER_HEALTHCHECK_URL: 'https://test.render.com', RENDER_WARMUP_KEY: 'my-secret' };

            await worker.scheduled(event, env, mockCtx);

            const waitUntilPromise = (mockCtx.waitUntil as any).mock.calls[0][0];
            await waitUntilPromise;

            expect(consoleErrorSpy).toHaveBeenCalledWith('Render ping failed with status: 500');
        });

        it('should handle missing RENDER_WARMUP_KEY gracefully', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('OK', { status: 200 }));

            const event = { cron: '* * * * *', type: 'scheduled', scheduledTime: Date.now() } as ScheduledEvent;
            const env = { RENDER_HEALTHCHECK_URL: 'https://test.render.com', RENDER_WARMUP_KEY: '' };

            await worker.scheduled(event, env, mockCtx);

            const waitUntilPromise = (mockCtx.waitUntil as any).mock.calls[0][0];
            await waitUntilPromise;

            expect(fetchSpy).toHaveBeenCalledWith('https://test.render.com', {
                method: 'GET',
                headers: {
                    'x-warmup-key': ''
                }
            });
        });

        it('should catch network errors thrown by fetch', async () => {
            const mockError = new Error('Network timeout');
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(mockError);

            const event = { cron: '* * * * *', type: 'scheduled', scheduledTime: Date.now() } as ScheduledEvent;
            const env = { RENDER_HEALTHCHECK_URL: 'https://test.render.com', RENDER_WARMUP_KEY: 'my-secret' };

            await worker.scheduled(event, env, mockCtx);

            const waitUntilPromise = (mockCtx.waitUntil as any).mock.calls[0][0];
            await waitUntilPromise;

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error pinging Render:', mockError);
        });
    });
});
