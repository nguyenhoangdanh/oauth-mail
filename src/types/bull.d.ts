// src/types/bull.d.ts
declare module 'bull' {
  interface QueueOptions {
    redis?: {
      host?: string;
      port?: number;
      password?: string;
      db?: number;
      tls?: any;
    };
    limiter?: {
      max: number;
      duration: number;
    };
    defaultJobOptions?: {
      attempts?: number;
      backoff?: number | { type: string; delay: number };
      delay?: number;
      removeOnComplete?: boolean | number;
      removeOnFail?: boolean | number;
    };
    settings?: {
      maxStalledCount?: number;
      stalledInterval?: number;
      lockDuration?: number;
      lockRenewTime?: number;
    };
  }

  interface JobOptions {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: number | { type: string; delay: number };
    lifo?: boolean;
    timeout?: number;
    jobId?: string;
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    stackTraceLimit?: number;
  }

  class Queue<T = any> {
    constructor(name: string, url?: string, opts?: QueueOptions);
    constructor(name: string, opts?: QueueOptions);

    add(data: T, opts?: JobOptions): Promise<Job<T>>;
    process(concurrency: number, callback: (job: Job<T>) => Promise<any>): void;
    process(callback: (job: Job<T>) => Promise<any>): void;
    on(event: string, callback: (...args: any[]) => void): this;
    getJob(jobId: string): Promise<Job<T> | null>;
    getJobs(
      types: string[],
      start?: number,
      end?: number,
      asc?: boolean,
    ): Promise<Array<Job<T>>>;
    getActive(start?: number, end?: number): Promise<Array<Job<T>>>;
    getWaiting(start?: number, end?: number): Promise<Array<Job<T>>>;
    getDelayed(start?: number, end?: number): Promise<Array<Job<T>>>;
    getCompleted(start?: number, end?: number): Promise<Array<Job<T>>>;
    getFailed(start?: number, end?: number): Promise<Array<Job<T>>>;
    close(): Promise<void>;
  }

  interface Job<T = any> {
    id: string;
    data: T;
    opts: JobOptions;
    attemptsMade: number;
    queue: Queue;
    update(data: T): Promise<void>;
    remove(): Promise<void>;
    retry(): Promise<void>;
    discard(): Promise<void>;
    finished(): Promise<any>;
    moveToCompleted(returnValue?: any, ignoreLock?: boolean): Promise<any>;
    moveToFailed(errorInfo: Error, ignoreLock?: boolean): Promise<any>;
  }

  namespace Bull {
    export type Job<T> = import('bull').Job<T>;
    export type Queue<T> = import('bull').Queue<T>;
    export type JobOptions = import('bull').JobOptions;
    export type QueueOptions = import('bull').QueueOptions;
  }

  export = Queue;
}
