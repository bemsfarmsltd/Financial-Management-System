export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if(process.env.NEXT_PHASE!=='phase-production-build'){
      const {startWalletWorker}=await import('./lib/wallet/runtime-worker');
      startWalletWorker();
    }
    // Prevent unhandled server.close() errors during Hostinger Passenger / worker shutdown
    process.on('uncaughtException', (err: any) => {
      if (
        err?.code === 'ERR_SERVER_NOT_RUNNING' ||
        err?.message?.includes('Server is not running') ||
        err?.message?.includes('ECONNRESET')
      ) {
        return;
      }
      console.error('[runtime] Uncaught exception:', err);
    });

    process.on('unhandledRejection', (reason: any) => {
      console.error('[runtime] Unhandled rejection:', reason);
    });
  }
}
