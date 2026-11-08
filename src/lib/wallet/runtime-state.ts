type WorkerStatus={startedAt:string|null;lastTickAt:string|null;lastError:string|null};
const scope=globalThis as typeof globalThis & {bemsWalletWorkerStatus?:WorkerStatus};
export function walletWorkerStatus(){return scope.bemsWalletWorkerStatus||{startedAt:null,lastTickAt:null,lastError:null};}
export function updateWalletWorkerStatus(value:Partial<WorkerStatus>){scope.bemsWalletWorkerStatus={...walletWorkerStatus(),...value};}
