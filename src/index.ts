export interface Env {
	RENDER_HEALTHCHECK_URL: string;
	RENDER_WARMUP_KEY: string;
}

export default {
	// Provide a clean response if someone navigates to the public .workers.dev URL in their browser
	async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
		return new Response("Cron worker is active and running perfectly! 😊", { status: 200 });
	},

	// The scheduled handler is invoked at the interval set in our wrangler.toml's cron expression.
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		if (!env.RENDER_HEALTHCHECK_URL) {
			console.error("Missing RENDER_HEALTHCHECK_URL in environment.");
			return;
		}

		// ctx.waitUntil ensures the worker stays alive until the ping request strictly completes.
		console.log(`Pinging ${env.RENDER_HEALTHCHECK_URL}...`);
		ctx.waitUntil(
			fetch(env.RENDER_HEALTHCHECK_URL, {
				method: 'GET',
				headers: {
					'x-warmup-key': env.RENDER_WARMUP_KEY || ''
				}
			})
				.then((response) => {
					if (!response.ok) {
						console.error(`Render ping failed with status: ${response.status}`);
					} else {
						console.log(`Render ping successful: ${response.status}`);
					}
				})
				.catch((error) => {
					console.error("Error pinging Render:", error);
				})
		);
	},
};
