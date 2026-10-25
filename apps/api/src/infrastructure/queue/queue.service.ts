import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { loadConfig } from '../../config/env';

/**
 * Background job abstraction. Uses BullMQ repeatable jobs when REDIS_URL is configured
 * (multi-instance safe); otherwise an in-process interval keeps local development working.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private timers: NodeJS.Timeout[] = [];
  private queues: Queue[] = [];
  private workers: Worker[] = [];

  async schedule(name: string, everyMs: number, handler: () => Promise<unknown>) {
    const redisUrl = loadConfig().redisUrl;
    if (redisUrl) {
      const url = new URL(redisUrl);
      const connection = { host: url.hostname, port: Number(url.port || 6379), password: url.password || undefined, tls: url.protocol === 'rediss:' ? {} : undefined };
      const queue = new Queue(name, { connection });
      await queue.upsertJobScheduler(`${name}-repeat`, { every: everyMs }, { name });
      const worker = new Worker(name, async () => handler(), { connection });
      worker.on('failed', (_job, err) => this.logger.error(`${name} failed: ${err.message}`));
      this.queues.push(queue);
      this.workers.push(worker);
      this.logger.log(`Scheduled ${name} every ${everyMs / 60000} min via BullMQ`);
    } else {
      const run = () => handler().catch((e: Error) => this.logger.error(`${name} failed: ${e.message}`));
      this.timers.push(setInterval(run, everyMs));
      setTimeout(run, 10_000).unref();
      this.logger.log(`Scheduled ${name} every ${everyMs / 60000} min (in-process; set REDIS_URL for BullMQ)`);
    }
  }

  async close() {
    this.timers.forEach(clearInterval);
    await Promise.all([...this.workers.map((w) => w.close()), ...this.queues.map((q) => q.close())]);
  }
}
