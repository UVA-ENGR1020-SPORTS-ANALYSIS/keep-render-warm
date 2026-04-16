import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from './index';

describe('worker', () => {
    describe('fetch handler', () => {
        it('responds with 200 and success message', async () => {
            const request = new Request('http://example.com');
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, env, ctx);
            await waitOnExecutionContext(ctx);

            expect(response.status).toBe(200);
            expect(await response.text()).toBe("Cron worker is active and running perfectly! 😊");
        });
    });
});
